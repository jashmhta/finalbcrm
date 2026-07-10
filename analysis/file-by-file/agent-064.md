# Agent 064 — Extreme detail analysis

Batch files: `src/db/schema/auth.ts`, `src/db/schema/compliance.ts`, `src/db/schema/contact.ts`, `src/db/schema/credit.ts`

Auth.js identity, DPDP consent/DSR, natural-person contacts, and the full credit subsystem schema.

---

## `src/db/schema/auth.ts`

- **Lines:** 160 | **Role:** Auth.js v5 / `@auth/drizzle-adapter` tables
- **Exports:** tables `users`, `accounts`, `sessions`, `verificationTokens`, `authenticators`; types `AuthUser`, `AuthUserInsert`, `AuthAccount`, `AuthSession`, `AuthVerificationToken`, `Authenticator` (+ Insert variants)
- **Imports:** drizzle pg-core only — **deliberately no `./rbac` import** to avoid TS 7022 circular inference with contact
- **Business purpose:** Identity store separate from CRM profile (`app_user`). Link: `users.app_user_id` → `app_user.user_id` as plain uuid (FK via migration SQL)
- **Key shapes:**
  - `users`: text PK `id` (default crypto.randomUUID), name, unique email, emailVerified, image, appUserId
  - `accounts`: composite PK (provider, providerAccountId); OAuth tokens snake_case as adapter expects
  - `sessions`: sessionToken PK, userId cascade, expires — **production target** DB sessions + Redis; currently JWT strategy so table may be idle
  - `verificationTokens`: PK (identifier, token)
  - `authenticators`: WebAuthn for director role (§4.7); composite PK (userId, credentialID)
- **Side effects:** Adapter writes; credentials provider primarily uses `app_user` (see features/admin comments)
- **Security:** Cascade delete accounts/sessions on user delete; mfa secrets live on app_user not here
- **Coupling:** Auth.js adapter; app_user via migration FK
- **Risks / TODOs:** Dual identity (users vs app_user) can desync; JWT strategy loses server-side revoke until Redis cutover

---

## `src/db/schema/compliance.ts`

- **Lines:** 176 | **Role:** DPDP consent + data subject request tables
- **Exports:** `consentRecord`, `dataSubjectRequest`, relations, types
- **Tables:**
  ### `consent_record` (§2.21)
  - PK `consent_record_id`
  - Principal: nullable `party_id` and/or `contact_id` (cascade)
  - `purpose` consentPurposeEnum: marketing, advisory_engagement, kyc_processing, credit_analysis, data_sharing_with_rating_agency, data_sharing_with_investors, regulatory_reporting, portfolio_management, secondary_trading_contact
  - `purpose_description`, `consent_given_at`, `consent_withdrawn_at` (null = active)
  - `consent_method`: digital_sign | checkbox_email | physical_signed | verbal_recorded
  - `data_categories` text[], `retention_until` date, `version_of_policy`
  - Soft delete + timestamps
  - Partial index `consent_record_active_idx` WHERE withdrawn/deleted null
  ### `data_subject_request` (§2.23.8)
  - PK `dsr_id`
  - party/contact principals; CHECK at least one non-null
  - `request_type` dsrTypeEnum: access | erasure | rectification | restriction | portability | withdraw_consent
  - `status` dsrStatusEnum: received | in_review | fulfilled | rejected | cancelled
  - requestedAt, completedAt, notes, handledByUserId, triggeringConsentRecordId
- **Business purpose:** Purpose-bound consent (marketing ≠ rating-agency share); withdrawal spawns DSR workflow; erasure feeds retention purge §5.6
- **Side effects:** Walled via RLS (`consent_record` in WALLED_TABLES)
- **Security:** Cascade delete with party/contact; audit via feature actions
- **Coupling:** features/compliance/{consent,actions,queries}
- **Risks / TODOs:** No DSR type `nomination` (DPDP §11(d)) — tracked in consent.ts comments

---

## `src/db/schema/contact.ts`

- **Lines:** 180 | **Role:** Natural persons + role intervals on parties
- **Exports:** `contact`, `partyContact`, relations, types
- **Tables:**
  ### `contact` (§2.4)
  - PK contact_id; `full_name` citext NOT NULL; salutation enum; primary_email citext; phone; designation; linkedin
  - `is_kyc_individual`, convenience `pan` char(10) — **canonical PAN is party_identifier**
  - `pep_status` pepEnum: none | suspected | confirmed | family_member | close_associate
  - FEMA: is_nri, fema_residential_status text
  - Audit: created/updated by user; soft delete
  - Unique partial indexes on email, pan WHERE not deleted; name index; trgm migration note
  ### `party_contact` (§2.5)
  - Links party↔contact with `role` contactRoleEnum (director, promoter, md_ceo, cfo, treasurer, compliance, rm_broker, ifa, relationship_manager, authorised_signatory, beneficial_owner, other)
  - Interval valid_from NOT NULL / valid_to null = current
  - Self-FK `reporting_to_party_contact_id` (org chart per party)
  - Partial unique primary per (party, role) WHERE is_primary AND valid_to null
  - Migration note: gist exclusion no-overlap on (party, contact, role, tstzrange)
- **Business purpose:** Contacts never deleted when leaving firm — close interval; multi-employer same person
- **Security:** Soft delete; PAN uniqueness partial
- **Coupling:** KYC BOs, interactions, app_user.contact_id
- **Risks / TODOs:** Exclusion constraint not in Drizzle; fema_residential_status text vs femaResidentialStatusEnum elsewhere

---

## `src/db/schema/credit.ts`

- **Lines:** 990 | **Role:** Entire credit analysis domain (largest schema module)
- **Exports:** tables + relations + types for:
  `sectorCode`, `creditAnalysis`, `financialStatement`, `creditAnalysisFsLink`, `ratioResult`, `scorecardTemplate`, `scorecard`, `creditScore`, `externalRating`, `ratingLadder`, `exposure`, `creditLimit`, `kycRecord`, `kycBeneficialOwner`
- **Business purpose:** CREDIT_ANALYSIS_SPEC + DATA_MODEL §2.12–2.16, §2.20 — internal credit files, FS, ratios, scorecards, CRA ratings, limits, KYC

### Core table semantics
| Table | Role | Notable columns |
|-------|------|-----------------|
| `sector_code` | Hierarchical industry taxonomy | code (e.g. `infra.roads`), nic_code, rbi_sectoral_deployment_code, parent (plain uuid self-FK via migration), segment_class, level |
| `credit_analysis` | PIT credit work, version-chained | deal_id nullable, party_id, obligor_type, analyst/reviewer, analysis_type, internal_rating_short/long/action, pd_1y, pd_5y, lgd_pct, ead, **expected_loss GENERATED** `pd_1y * lgd_pct/100 * ead`, recovery_rate_pct, current_credit_score (trigger), watchlist_flag, valid_from/to, superseded_by, barrier_id |
| `financial_statement` | Period FS | party_id, period dates, statement_type, currency, units, source, consolidated, auditor_id, raw_payload jsonb, **line_items jsonb** keyed by crisil_lineitem_code |
| `credit_analysis_fs_link` | M:N CA↔FS | composite PK, link_role: primary_basis\|supporting\|prior_period\|peer |
| `ratio_result` | Persisted ratios | ratio_code financialRatioEnum, ratio_value, formula_snapshot |
| `scorecard_template` | Versioned weights | obligor_type, sector_code, factor_weights jsonb, benchmark_overrides, status draft\|approved\|retired; UQ (obligor, sector, version) |
| `scorecard` | Per-CA instance | total_score, band, template_id/version, computed_at |
| `credit_score` | Component breakdown | component_code scoreComponentEnum, component_score/weight, **weighted_score GENERATED** `component_score * component_weight`, override_flag |
| `external_rating` | CRA ratings | agency, scale, rating_value, rating_rank (long_term only, AAA=1…D), outlook, action, instrument/deal optional |
| `rating_ladder` | Cross-agency rank SoR | agency, scale, symbol, rank, definition; UQ agency+scale+symbol |
| `exposure` | Economic exposure | type underwriting_unsold\|secondary_inventory\|…, gross/net, as_of, multi-currency |
| `credit_limit` | Desk limits | limit_type issuer_underwriting\|group\|…, limit_amount, utilized (job), **available GENERATED** `limit_amount - utilized`, review_due_date |
| `kyc_record` | CDD/EDD | status, risk, highest_bo_ownership_pct (trigger), valid_until, rekyc_due_date (trigger), Sof/Sow flags |
| `kyc_beneficial_owner` | BO junction | ownership_pct, relationship_path, declaration_document_id; UQ (kyc, contact) |

### Formulas / stage notes
- EL = PD × LGD% × EAD (generated)
- Scorecard template vs instance reconciliation documented in file header (DATA_MODEL vs credit spec)
- KYC EDD when BO ≥10% corporate / ≥15% trust (helpers in features; schema stores highest_bo %)
- Re-KYC: low 10yr / medium 8yr / high 2yr (RBI) — application layer

### Security / RLS
- `credit_analysis` barrier-tagged; kyc/external_rating/exposure/credit_limit in WALLED_TABLES
- Soft deletes throughout

### Coupling
- party, deal, instrument, app_user, information_barrier, contact, document
- features/credit/* engines + features/compliance/kyc

### Risks / TODOs
- Many trigger-maintained columns not yet guaranteed in app if triggers missing
- Self-FKs as plain columns (parent sector, superseded_by)
- Extra ratio codes in engine not in financialRatioEnum cannot persist
