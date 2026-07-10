# Agent 001 — File-by-file analysis (batch-001)

Batch source: `/home/Jashmhta/crm/bc-crm/analysis/file-by-file/batch-001.list`  
Workspace root: `/home/Jashmhta/crm/bc-crm/app`  
Files analyzed: 4 (all read fully)

---

## drizzle.config.ts

- **Lines:** 12  
- **Role in architecture:** Root-level Drizzle Kit configuration. Single source of truth for how schema TS is compiled into SQL migrations and how the tool connects to PostgreSQL. Consumed by npm scripts `db:generate`, `db:push`, `db:migrate`, `db:studio`, `db:drop` in `package.json` (drizzle-kit `^0.31.10`). Not imported by application runtime code; CLI-only.

- **Exports (all significant):**
  - **Default export:** `defineConfig({...})` return value — object shape:
    - `schema: "./src/db/schema/index.ts"` — entry barrel for all table/enum definitions
    - `out: "./drizzle"` — migration output directory (SQL + `meta/`)
    - `dialect: "postgresql"`
    - `dbCredentials.url: process.env.DATABASE_URL!` — non-null assertion on env var
    - `verbose: true` — kit logs SQL / diffs verbosely
    - `strict: true` — rejects ambiguous/destructive ops without confirmation

- **Imports / deps:**
  - `defineConfig` from `"drizzle-kit"`
  - Runtime env: `process.env.DATABASE_URL` (required at kit invocation; no dotenv load here)
  - Indirect: entire tree under `src/db/schema/` via `schema/index.ts`

- **Business purpose & domain concepts:**
  - Tooling glue only — no domain logic.
  - Anchors the dual identity of the DB layer: TypeScript schema modules (`src/db/schema/*`) ↔ SQL migrations (`drizzle/*.sql`).
  - Positions Binary CRM on PostgreSQL (capital markets CRM: parties, deals, credit, KYC, barriers).

- **Key logic / algorithms / data shapes:**
  - No algorithms. Config object only.
  - Path resolution is relative to project root (`app/`).
  - `strict: true` interacts with drizzle-kit generate/push to reduce silent drops.

- **Side effects (DB writes, auth, RLS, server actions):**
  - No runtime side effects when the Next app boots.
  - When CLI runs:
    - `db:generate` → writes SQL under `./drizzle` + updates `drizzle/meta/_journal.json` + snapshots
    - `db:push` → mutates live DB schema without migration files
    - `db:migrate` → applies journaled migrations to `DATABASE_URL`
    - `db:studio` → local UI against live DB
    - `db:drop` → drops a migration entry
  - Does **not** configure RLS, roles, or connection pooling.

- **Security / RBAC / compliance notes:**
  - `DATABASE_URL!` — secret in env; config does not hardcode credentials (good).
  - Non-null assertion means misconfigured env fails at kit runtime, not compile time.
  - No SSL/mode options; relies on URL query params (e.g. `?sslmode=require`).
  - Anyone who can run `db:push` / `db:migrate` with prod URL can alter schema — operational control, not code-level auth.
  - Later hand-written SQL (`0002_auth.sql` and beyond) may not appear in `meta/_journal.json` (journal currently only tags `0000_minor_kitty_pryde`, `0001_easy_scarlet_spider`) — risk of drizzle-kit migrate skipping hand migrations if process only follows journal.

- **Coupling (who imports this, what it imports):**
  - **Imported by:** nothing in app code. Invoked by drizzle-kit CLI via package scripts.
  - **Points at:** `./src/db/schema/index.ts` (schema barrel: enums, rbac, party, contact, deals, credit, demat, compliance, interactions, tasks, documents, audit, modeling, information_barrier, auth).
  - **Produces into:** `./drizzle/` (this batch’s SQL siblings).
  - **package.json scripts:** `db:generate | push | migrate | studio | drop`.

- **Risks, TODOs, dead code, quality notes:**
  - Journal/meta only tracks auto-generated migrations 0000–0001; files `0002_auth.sql` … `0011_*.sql` exist on disk but are **not** in `_journal.json` entries — operational risk if migrate is journal-driven only.
  - No `tablesFilter`, `schemaFilter`, or `migrations.table` overrides — defaults apply.
  - No casing strategy declared (relies on kit defaults + explicit snake_case column names in schema).
  - `verbose` + `strict` are good for a regulated CRM schema; keep them.
  - Single-file, no dead code.

---

## drizzle/0000_minor_kitty_pryde.sql

- **Lines:** 995  
- **Role in architecture:** **Baseline schema migration** (Drizzle tag `0000_minor_kitty_pryde`, journal idx 0). Creates the entire core Binary CRM PostgreSQL public schema: 67 enums, ~40 tables, FKs, partial unique indexes, generated columns. This is the foundational DATA_MODEL materialization. Source of truth for generation was `src/db/schema/*` at generate time. Downstream migrations (0001 auth adapter tables, 0002 credentials columns, 0003+ RLS, leads, onboarding, etc.) assume these objects exist.

- **Exports (all significant):** Not a TS module. **Creates** the following database objects:

### ENUM types (67) — all `CREATE TYPE "public"."…"`

| Enum name | Values (exact) |
|---|---|
| `address_type` | `registered`, `branch`, `correspondence`, `residential`, `operational` |
| `alloc_event_type` | `indication`, `order`, `revised_order`, `allocated`, `withdrawn`, `oversubscribed_adjusted`, `settled` |
| `alloc_source_channel` | `phone`, `email`, `rfq_platform`, `ndsom`, `brokers`, `ifa` |
| `attendee_role` | `host`, `chair`, `presenter`, `issuer_side`, `investor_side`, `advisor`, `observer`, `other` |
| `auction_bid_type` | `competitive`, `non_competitive` |
| `audit_op` | `insert`, `update`, `delete`, `merge`, `approve`, `reject` |
| `brand` | `binarycapital`, `binarybonds`, `shared` |
| `consent_method` | `digital_sign`, `checkbox_email`, `physical_signed`, `verbal_recorded` |
| `consent_purpose` | `marketing`, `advisory_engagement`, `kyc_processing`, `credit_analysis`, `data_sharing_with_rating_agency`, `data_sharing_with_investors`, `regulatory_reporting`, `portfolio_management`, `secondary_trading_contact` |
| `contact_role` | `director`, `promoter`, `md_ceo`, `cfo`, `treasurer`, `compliance`, `rm_broker`, `ifa`, `relationship_manager`, `authorised_signatory`, `beneficial_owner`, `other` |
| `coupon_type` | `fixed`, `floating`, `zero`, `step_up`, `step_down`, `linked` |
| `credit_analysis_type` | `origination`, `annual_surveillance`, `event_driven`, `watchlist_trigger`, `rating_presentation_support` |
| `data_source` | `manual`, `capital_markets_import`, `bond_desk_import`, `website_lead`, `broker_feed` |
| `day_count` | `ACT_365`, `ACT_360`, `thirty_360`, `ACT_ACT` |
| `deal_party_role` | `issuer`, `arranger`, `co_arranger`, `underwriter`, `book_runner`, `lead_manager`, `syndicate_member`, `investor`, `allocator`, `guarantor`, `trustee`, `registrar`, `rating_agency`, `legal_counsel`, `auditor`, `escrow_agent`, `selling_broker`, `buy_side_advisor`, `sell_side_advisor`, `target`, `acquirer` |
| `deal_status` | `lead`, `mandated`, `in_dd`, `structuring`, `rating_marketing`, `pricing`, `allocation`, `settled`, `closed`, `dropped`, `on_hold` |
| `deal_type` | `bond_underwriting`, `gsec_auction`, `high_yield_bond`, `rating_advisory`, `m_and_a`, `project_finance`, `structured_finance`, `supply_chain_finance`, `ecm_ipo`, `ecm_fpo`, `ecm_qip`, `ecm_rights`, `dcm_advisory`, `private_placement_debt`, `valuation`, `fairness_opinion`, `portfolio_management_mandate`, `secondary_trading_advisory` |
| `dedup_status` | `open`, `confirmed_merge`, `rejected_merge`, `deferred` |
| `demat_status` | `active`, `frozen`, `closed`, `suspended` |
| `depository` | `NSDL`, `CDSL` |
| `desk` | `ib_advisory`, `bond_underwriting`, `gsec_trading`, `secondary_mm`, `portfolio_mgmt`, `credit`, `rating_advisory`, `operations`, `compliance`, `management` |
| `document_type` | `engagement_letter`, `mandate_letter`, `rating_rationale`, `offering_circular`, `drhp`, `information_memorandum`, `term_sheet`, `security_document`, `trustee_deed`, `kyc_pack`, `pan_card`, `aadhaar`, `board_resolution`, `form60`, `form61`, `financial_statement`, `financial_model_file`, `credit_memo`, `valuation_report`, `legal_dd_report`, `site_report`, `consent_form`, `other` |
| `dsr_status` | `received`, `in_review`, `fulfilled`, `rejected`, `cancelled` |
| `dsr_type` | `access`, `erasure`, `rectification`, `restriction`, `portability`, `withdraw_consent` |
| `exchange` | `BSE`, `NSE`, `BSE_NSE`, `MSE`, `Other`, `Offshore` |
| `exposure_type` | `underwriting_unsold`, `secondary_inventory`, `portfolio_holding`, `advisory_fee_at_risk`, `settlement_counterparty`, `repo` |
| `fema_residential_status` | `resident`, `nri`, `oci`, `foreign_national` |
| `financial_ratio` | `current_ratio`, `quick_ratio`, `debt_equity`, `debt_ebitda`, `interest_coverage`, `iscr`, `dscr`, `llcr`, `plcr`, `roce`, `roe`, `roa`, `nim`, `gnpa_pct`, `nnpa_pct`, `credit_cost_pct`, `tier1_ratio`, `crar`, `gnpa_coverage_ratio`, `liii_ratio`, `provision_coverage_ratio`, `debt_to_tangible_nw`, `operating_margin`, `ebitda_margin`, `pat_margin`, `ev_ebitda`, `p_e`, `p_b`, `dividend_payout`, `fcfo`, `cfads`, `working_capital_days`, `creditor_days`, `debtor_days`, `inventory_days`, `lnf_to_tnw` |
| `frequency` | `annual`, `semi_annual`, `monthly` |
| `fs_link_role` | `primary_basis`, `supporting`, `prior_period`, `peer` |
| `fs_source` | `audited`, `limited_review`, `management_provisional`, `rating_agency_filing` |
| `identifier_type` | `PAN`, `LEI`, `CIN`, `LLPIN`, `GSTIN`, `TAN`, `demat_dp_client`, `SEBI_regn`, `NSDL`, `CDSL`, `ISIN`, `CRN` |
| `instrument_type` | `corp_bond`, `ncd`, `cp`, `gsec`, `sdl`, `tbill`, `sgb`, `structured_credit`, `municipal_bond`, `eco_bond`, `equity`, `preference_share`, `warrant`, `convertible` |
| `interaction_channel` | `meeting`, `call`, `email`, `whatsapp`, `rfq`, `ndsom_chat`, `site_visit`, `management_presentation` |
| `interaction_direction` | `inbound`, `outbound` |
| `internal_rating_action` | `assign`, `maintain`, `upgrade`, `downgrade`, `watch_negative`, `watch_positive` |
| `kyc_category` | `id_proof`, `address_proof`, `pan`, `bo_declaration`, `pep_declaration`, `source_of_funds`, `authority_letter` |
| `kyc_risk` | `low`, `medium`, `high` |
| `kyc_status` | `pending`, `in_review`, `approved`, `rejected`, `expired`, `rekyc_due`, `under_eds_check` |
| `kyc_type` | `CDD`, `EDD`, `simplified` |
| `limit_type` | `issuer_underwriting`, `secondary_inventory`, `single_name`, `group`, `sector`, `tenor`, `country`, `counterparty_concentration` |
| `model_type` | `bond_pricing`, `project_finance`, `securitization`, `dcf`, `m_and_a`, `lbo`, `valuation`, `portfolio_construction`, `scenario_stress` |
| `obligor_type` | `corporate`, `spv`, `project`, `sovereign`, `state_psu`, `nbfc`, `bank` |
| `outlook` | `stable`, `positive`, `negative`, `developing`, `credit_watch` |
| `party_nature` | `organization`, `natural_person`, `spv`, `trust`, `government`, `regulator` |
| `party_status` | `active`, `dormant`, `onboarding`, `blacklisted`, `closed` |
| `party_type` | `issuer`, `investor`, `intermediary`, `arranger`, `underwriter`, `broker`, `ifa`, `rating_agency`, `trustee`, `registrar`, `legal_counsel`, `auditor`, `escrow_agent`, `guarantor`, `credit_enhancement_provider`, `government`, `regulator`, `spv`, `vendor`, `internal_staff`, `prospect` |
| `pep` | `none`, `suspected`, `confirmed`, `family_member`, `close_associate` |
| `period_type` | `annual`, `half_year`, `quarter`, `month` |
| `price_type` | `clean`, `dirty`, `par` |
| `rating_action` | `initial`, `affirm`, `upgrade`, `downgrade`, `withdraw`, `rating_solicited` |
| `rating_agency` | `CRISIL`, `ICRA`, `CARE`, `India_Ratings`, `Acuite`, `Infomerics`, `Brickwork` |
| `rating_scale` | `long_term`, `short_term`, `structured`, `sovereign`, `state_guaranteed` |
| `regn_category` | `merchant_banker_cat1`, `stock_broker`, `investment_adviser`, `debenture_trustee`, `registrar_to_issue`, `research_analyst`, `underwriter`, `nbfc`, `arranger` |
| `relationship_type` | `wholly_owned`, `subsidiary`, `associate`, `jv`, `promoter`, `beneficial_owner`, `guarantor`, `sister_concern`, `management_control` |
| `salutation` | `Mr`, `Ms`, `Mrs`, `Dr`, `Prof`, `Shri`, `Smt`, `Col`, `Capt`, `other` |
| `score_component` | `business_risk`, `financial_risk`, `management_risk`, `industry_risk`, `country_risk`, `structural_risk`, `ESG` |
| `scorecard_status` | `draft`, `approved`, `retired` |
| `segment_class` | `sector`, `sub_sector`, `geography`, `deal_category` |
| `settlement` | `T0`, `T1`, `T2`, `T3` |
| `statement_type` | `balance_sheet`, `profit_loss`, `cash_flow`, `standalone`, `consolidated` |
| `tag_category` | `party`, `deal`, `contact`, `general` |
| `tag_target` | `party`, `deal`, `contact`, `instrument`, `interaction` |
| `task_priority` | `low`, `medium`, `high`, `urgent` |
| `task_status` | `pending`, `in_progress`, `completed`, `cancelled`, `blocked`, `deferred` |
| `trade_side` | `buy`, `sell` |
| `units` | `absolute`, `lakhs`, `crores`, `millions` |

Note: `day_count`, `dedup_status`, `fema_residential_status`, `regn_category`, `settlement`, `tag_category`, `tag_target` are created as enums but **not all are used as column types in tables in this migration** (e.g. `contact.fema_residential_status` is plain `text`; `party_identifier.regn_category` is `text`). Enums may be reserved for later schema alignment.

### TABLES (CREATE TABLE order in file)

#### RBAC / users
1. **`app_user`** — PK `user_id` uuid DEFAULT `gen_random_uuid()`  
   Columns: `employee_party_id` uuid, `contact_id` uuid, `email` citext NOT NULL, `is_active` boolean DEFAULT true NOT NULL, `desk` desk, `barrier_clearance` text[], `last_login_at` timestamptz, `mfa_enrolled_at` timestamptz, `created_at`/`updated_at`/`deleted_at` timestamptz.  
   *No password/MFA secret columns yet (added in 0002).*

2. **`permission`** — PK `permission_id`; `code` text NOT NULL; `description`; soft-delete timestamps.

3. **`role`** — PK `role_id`; `name` text NOT NULL; `desk` desk; `description`; timestamps.

4. **`role_permission`** — composite PK (`role_id`, `permission_id`); `created_at`.

5. **`user_role`** — PK `user_role_id`; `user_id`, `role_id` NOT NULL; `valid_from` NOT NULL; `valid_to`; `assigned_by_user_id`; timestamps. Time-bounded role assignment.

#### Chinese walls
6. **`information_barrier`** — PK `barrier_id`; `name` NOT NULL; `deal_id`, `party_id` (scope); `restricted_role_set` text[] NOT NULL; `restricted_desk` desk[]; `reason`; `created_by_user_id`; `erected_at`/`lifted_at`; `is_active` DEFAULT true;  
   CHECK `information_barrier_scope_check`: `deal_id IS NOT NULL OR party_id IS NOT NULL`.

#### Party master
7. **`address`** — PK `address_id`; party or contact principal; Indian-ish address fields (`pincode` char(6), `country` char(2)); `address_type`; `is_current`; validity window; CHECK `address_principal_check`: party_id OR contact_id NOT NULL.

8. **`party`** — core entity. PK `party_id`; `party_seq` numeric(20); `legal_name` citext NOT NULL; `display_name`; `name_phonetic`; `party_nature` NOT NULL; `country_of_incorporation` char(2) DEFAULT `'IN'`; `domicile_state`; `ultimate_parent_party_id` (no FK in this migration); listing fields; `industry_segment_id` (no FK); `crisil_sector_code`; `group_exposure_inr` numeric(18,4); KYC flags; `barrier_id`; `kyc_risk_rating`; `status` party_status NOT NULL; `brand_origin` brand NOT NULL; `source` data_source; `source_ref`; audit user FKs; soft delete.

9. **`party_identifier`** — typed IDs (PAN/LEI/CIN/…); `identifier_value` text; `is_primary`; verification; validity; `regn_category` **text** (not enum).

10. **`party_type_assignment`** — composite PK (`party_id`, `party_type`); multi-type party model; `confidence` numeric(3,2); `evidence_note`.

11. **`contact`** — natural persons. `full_name` citext; `salutation`; `primary_email` citext; phone; designation; linkedin; KYC individual flag; `pan` char(10); `pep_status` pep; `is_nri`; `fema_residential_status` **text** (enum exists but column is text).

12. **`party_contact`** — link party↔contact with `role` contact_role; primary flag; validity; `reporting_to_party_contact_id` (no self-FK declared).

13. **`relationship`** — parent/child party graph; `relationship_type`; ownership/voting %; disclosure flag; `evidence_document_id` (no FK to document).

14. **`demat_account`** — `dp_id` char(8), `client_id` char(8), `depository` NSDL/CDSL, `account_status` demat_status.

#### Deals / markets
15. **`allocation_event`** — deal book-building lifecycle events; amount/yield/price; `put_call_indicator` uses **`auction_bid_type`** (naming mismatch: competitive/non_competitive used for put/call indicator); `allotment_pct`; demat; `source_channel`; `barrier_id`. **No soft-delete column.**

16. **`deal`** — `deal_code`; `deal_type` NOT NULL; subtype/name; `status` deal_status; `brand` NOT NULL; lead/credit analyst users; size/tenor/currency DEFAULT INR; `fee_structure` jsonb; mandate doc id (no FK); barrier; `parent_deal_id` (no self-FK).

17. **`deal_party`** — party roles on deal; `is_lead`; `commitment_amount`.

18. **`instrument`** — `isin` char(12); type; issuer party; coupon/frequency/face/issue size; `security_package` jsonb; listing exchange; credit enhancement provider id (no FK).

19. **`trade_event`** — secondary/primary trade blotter; `ccil_trade_id`; exchange; side; amount/price/yield; settlement_date; demat; barrier. **No soft-delete.**

#### Credit
20. **`credit_analysis`** — PD/LGD/EAD model fields;  
    **Generated:** `expected_loss` numeric(18,4) `GENERATED ALWAYS AS (pd_1y * lgd_pct / 100.0 * ead) STORED`;  
    internal ratings; watchlist; supersession chain `superseded_by` (no self-FK); barrier.

21. **`credit_analysis_fs_link`** — composite PK analysis↔financial_statement; `fs_link_role`.

22. **`credit_limit`** — limit vs utilized;  
    **Generated:** `available` AS `(limit_amount - utilized) STORED`; review_due_date; stale flag.

23. **`credit_score`** — component scores;  
    **Generated:** `weighted_score` AS `(component_score * component_weight) STORED`; override fields.

24. **`exposure`** — gross/net by exposure_type; as_of_date.

25. **`external_rating`** — agency/scale/value/rank/outlook/action; solicited flag.

26. **`financial_statement`** — period, statement_type, units, source; `raw_payload`/`line_items` jsonb; auditor as party.

27. **`kyc_beneficial_owner`** — BO on kyc_record + contact; ownership_pct; declaration document id (no FK).

28. **`kyc_record`** — CDD/EDD; status; risk; source of funds/wealth flags; approval; rekyc_due_date.

29. **`rating_ladder`** — agency × scale × symbol × rank reference data.

30. **`ratio_result`** — computed ratios per FS; no soft-delete.

31. **`scorecard`** / **`scorecard_template`** — template versioning by obligor_type/sector; factor_weights jsonb; status draft|approved|retired.

32. **`sector_code`** — hierarchical sectors; NIC/RBI codes; segment_class; level.

#### Modeling / compliance / CRM ops
33. **`financial_model`** — model_type; version; parent_model_id (no self-FK); params/outputs jsonb; approval.

34. **`consent_record`** — purpose enum; method; data_categories text[]; retention_until; policy version.

35. **`data_subject_request`** — DSR types/status; CHECK `dsr_principal_check`: party OR contact.

36. **`interaction`** — CRM activity log; channel/direction; body; duration; MNPI flag `contains_mnpi`; CHECK `interaction_anchor_check`: `num_nonnulls(party_id, deal_id, contact_id) >= 1`.

37. **`interaction_attendee`** — interaction×contact; attendee_role.

38. **`task`** / **`task_dependency`** — workflow; priority/status defaults `medium`/`pending`; composite PK dependency edge.

39. **`document`** — typed files; kyc_category; `file_store_ref`; sha256 char(64); confidential/MNPI flags; barrier; retention_until.

40. **`audit_log`** — field-level audit; operation audit_op; actor; barrier; ip `inet`; correlation_id; hash chain fields `prev_hash`/`row_hash` char(64). **No soft-delete; append-oriented.**

### FOREIGN KEYS (lines 764–867) — selected critical patterns

- Soft refs to users: mostly `ON DELETE set null` for `*_by_user_id` columns.
- Identity-ish links: `party_identifier`, `party_type_assignment`, `relationship`, `demat_account`, `allocation_event` deal/party, `instrument.issuer`, `kyc_record.party`, credit/exposure party FKs use **`ON DELETE restrict`** (protect master data integrity).
- Cascades: role_permission, user_role (user/role), address→party, deal_party→deal, interaction children, documents→deal/party/contact, consent/DSR→party/contact, scorecard/credit_score→analysis, ratio_result→FS, etc.
- Mutual/cycle FKs present at end of baseline:  
  - `app_user.employee_party_id` → `party` (set null)  
  - `app_user.contact_id` → `contact` (set null)  
  - `party.barrier_id` → `information_barrier`  
  - `information_barrier.deal_id` → `deal` (cascade)  
  - `information_barrier.party_id` → `party` (cascade)  
  - `sector_code.parent_sector_code_id` → self (set null)

### INDEXES (lines 868–995) — design themes

- Soft-delete aware partial uniques: `WHERE deleted_at IS NULL` on emails, codes, legal names, ISINs, etc.
- `app_user_email_uidx` on citext email (active only).
- `party_legal_name_country_uidx` — legal_name + country.
- `party_identifier_dedup_uidx` — (identifier_type, identifier_value) global unique when not deleted.
- `user_role_current_uidx` — one current assignment per (user, role) where `valid_to IS NULL`.
- `party_contact_primary_uidx` — one primary per (party, role) when current.
- `relationship_edge_uidx` — parent/child/type uniqueness.
- `demat_account_dedup_uidx` — (dp_id, client_id, depository).
- `deal_party_role_uidx` — unique role triple on deal.
- `trade_event_ccil_trade_id_uidx` — external trade id uniqueness.
- Operational partial indexes: `task_open_idx`, `credit_analysis_current_idx`, `consent_record_active_idx`, barrier active, etc.
- Audit: occurred_at, entity, actor, correlation, barrier.

- **Imports / deps:**
  - Generated from Drizzle schema under `src/db/schema/` (enums.ts, rbac, party, contact, deals, credit, demat, compliance, interactions, tasks, documents, audit, modeling, information_barrier).
  - **PostgreSQL prerequisites not created in this file:**
    - Extension/domain for **`citext`** (used on email, legal_name, full_name) — must exist (`CREATE EXTENSION citext`) or types fail.
    - **`gen_random_uuid()`** — typically `pgcrypto` or PG 13+ built-in.
    - **`num_nonnulls(...)`** used in interaction CHECK — PG built-in.
  - Drizzle statement separators: `--> statement-breakpoint` for multi-statement migrate.

- **Business purpose & domain concepts:**
  - Full capital-markets CRM for Binary Capital / Binary Bonds:
    - **Party master** with multi-type, identifiers (Indian + global), group relationships, demat.
    - **Deal lifecycle** across IB, DCM, ECM, GSec, rating advisory, portfolio mandates.
    - **Credit stack**: analyses, scorecards, limits, exposures, external ratings, FS/ratios, models.
    - **KYC / AML**: kyc_record, BOs, PEP on contacts, document categories (PAN, Aadhaar, Form 60/61).
    - **Privacy**: consent_record, data_subject_request (access/erasure/portability etc.).
    - **Chinese walls**: information_barrier + barrier_id on sensitive entities + app_user.barrier_clearance.
    - **RBAC**: app_user / role / permission / role_permission / user_role (time-bounded).
    - **Audit**: append log with optional hash chaining fields.
    - **Brand split**: brand enum binarycapital | binarybonds | shared on deals/parties.

- **Key logic / algorithms / data shapes:**
  - Generated columns:
    - `credit_analysis.expected_loss = pd_1y * lgd_pct / 100.0 * ead`
    - `credit_limit.available = limit_amount - utilized`
    - `credit_score.weighted_score = component_score * component_weight`
  - Soft-delete pattern: `deleted_at` on most master/transaction tables (exceptions: allocation_event, trade_event, ratio_result, role_permission, credit_analysis_fs_link, task_dependency, audit_log).
  - Money: numeric(18,4) common; yields numeric(6,4); ranks smallint.
  - Currency default INR (char(3)).
  - JSONB flexibility: fee_structure, security_package, raw_payload, line_items, factor_weights, model params/outputs.
  - Data shapes for RLS later: barrier_id columns, barrier_clearance array, desk on users/roles.

- **Side effects (DB writes, auth, RLS, server actions):**
  - **DDL only** — creates types/tables/constraints/indexes; no DML seed data.
  - No RLS policies in this file (those arrive in `0003_rls.sql` / later).
  - No grants/roles.
  - Applying this migration is a full schema bootstrap; irreversible without drop.

- **Security / RBAC / compliance notes:**
  - Schema supports RBAC tables but **no policies** yet — tables are wide open to any DB role with table privileges until 0003+.
  - PII columns: emails, phones, PAN (char(10)), Aadhaar as document type, addresses, PEP, FEMA status.
  - MNPI markers: `interaction.contains_mnpi`, `document.is_mnpi` / `is_confidential`.
  - Information barrier model present at data level; enforcement is deferred to RLS/app.
  - `audit_log` has hash fields for tamper-evidence but **no trigger** in this migration to populate them.
  - `password_hash` / MFA secrets **absent** here (credentials come later).
  - Unique indexes on PAN/email mitigate duplicate identity but do not encrypt PII at rest.
  - `document.sha256` supports integrity verification of files outside DB.

- **Coupling (who imports this, what it imports):**
  - **Applied by:** drizzle-kit migrate / manual `psql`; journal tag `0000_minor_kitty_pryde`.
  - **Mirrored by:** `src/db/schema/*` (app runtime uses Drizzle ORM against these tables).
  - **Consumed by:** essentially entire app (`src/lib/auth.ts`, `src/lib/rbac.ts`, feature queries/actions, pages under deals/credit/compliance/modeling/admin).
  - **Followed by:** `0001_easy_scarlet_spider.sql` (Auth.js tables + selective FK drops).
  - Snapshot: `drizzle/meta/0000_snapshot.json`.

- **Risks, TODOs, dead code, quality notes:**
  - **Circular FK bootstrap risk:** creating FKs from app_user→party/contact and information_barrier→deal/party in same migration works only because FKs are added after all tables exist; however 0001 **drops** some of these (see next file) and does not re-add them in journaled SQL — referential integrity may be intentionally deferred to later raw migrations.
  - **Missing FKs** for logical references: `party.ultimate_parent_party_id`, `party.industry_segment_id`, `deal.parent_deal_id`, `deal.mandate_letter_document_id`, `relationship.evidence_document_id`, `credit_analysis.superseded_by`, `financial_model.parent_model_id` / `credit_analysis_id`, `party_contact.reporting_to_party_contact_id`, `instrument.credit_enhancement_provider_id`, `kyc_beneficial_owner.declaration_document_id`, `task.parent_task_id`, `data_subject_request.triggering_consent_record_id`. Some may be intentional to avoid cycles or Drizzle limits.
  - **Enum vs column type drift:** `fema_residential_status` enum exists; contact column is text. `regn_category` enum exists; party_identifier uses text. `day_count`, `settlement`, `tag_*`, `dedup_status` appear unused in CREATE TABLE body of this migration.
  - **Naming smell:** `allocation_event.put_call_indicator` typed as `auction_bid_type` (competitive/non_competitive) — domain mismatch risk.
  - **citext / gen_random_uuid dependency** not created here — environment must pre-provision extensions (0003 creates pgcrypto for digest; citext may be separate).
  - File size ~1000 lines; auto-generated — do not hand-edit; regenerate from schema.
  - Soft-delete + partial unique indexes are well designed for CRM merge/close workflows.
  - No comments in SQL (Drizzle generate default); business rules live in TS schema comments instead.

---

## drizzle/0001_easy_scarlet_spider.sql

- **Lines:** 64  
- **Role in architecture:** Second journaled migration (tag `0001_easy_scarlet_spider`, journal idx 1). Introduces **Auth.js v5 / `@auth/drizzle-adapter` identity tables** (`users`, `accounts`, `sessions`, `verification_tokens`, `authenticators`) and **drops five foreign-key constraints** from the baseline that participate in mutual/cycle FK graphs. Aligns DB with `src/db/schema/auth.ts` shape for NextAuth adapter.

- **Exports (all significant):** Creates tables:

1. **`accounts`**  
   - Columns: `user_id` text NOT NULL, `type` text NOT NULL, `provider` text NOT NULL, `provider_account_id` text NOT NULL, `refresh_token`, `access_token`, `expires_at` integer, `token_type`, `scope`, `id_token`, `session_state`.  
   - PK: composite `accounts_provider_provider_account_id_pk` (`provider`, `provider_account_id`).

2. **`authenticators`** (WebAuthn)  
   - `credential_id` text NOT NULL UNIQUE (`authenticators_credential_id_unique`), `user_id` text NOT NULL, `provider_account_id`, `credential_public_key`, `counter` integer NOT NULL, `credential_device_type`, `credential_backed_up` boolean NOT NULL, `transports`.  
   - PK: (`user_id`, `credential_id`).

3. **`sessions`**  
   - PK `session_token` text; `user_id` text NOT NULL; `expires` timestamp NOT NULL (**without time zone** — Auth.js default date mode).

4. **`users`** (Auth.js identity, distinct from CRM `app_user`)  
   - PK `id` text; `name`, `email` UNIQUE, `email_verified` timestamp, `image`, **`app_user_id` uuid** (nullable link to CRM profile).  
   - **No FK** from `app_user_id` → `app_user.user_id` in this migration (TS schema documents intentional omission to break circular type inference; notes that FK should be added via raw SQL later — e.g. migration `0008_users_app_user_id.sql` may relate).

5. **`verification_tokens`**  
   - Composite PK (`identifier`, `token`); `expires` timestamp NOT NULL.

### DROP CONSTRAINT statements (exact names)

| Table | Constraint dropped |
|---|---|
| `app_user` | `app_user_employee_party_id_party_party_id_fk` |
| `app_user` | `app_user_contact_id_contact_contact_id_fk` |
| `information_barrier` | `information_barrier_deal_id_deal_deal_id_fk` |
| `information_barrier` | `information_barrier_party_id_party_party_id_fk` |
| `sector_code` | `sector_code_parent_sector_code_id_sector_code_sector_code_id_fk` |

### FKs added (Auth.js only)

- `accounts_user_id_users_id_fk` → users(id) ON DELETE cascade  
- `authenticators_user_id_users_id_fk` → users(id) ON DELETE cascade  
- `sessions_user_id_users_id_fk` → users(id) ON DELETE cascade  

**Not re-added in this file:** the five dropped baseline FKs.

- **Imports / deps:**
  - Mirrors `src/db/schema/auth.ts` exports: `users`, `accounts`, `sessions`, `verificationTokens` → table `verification_tokens`, `authenticators`.
  - Depends on baseline `app_user` existing only for column type compatibility of `users.app_user_id` (uuid), not for FK.
  - Runtime consumers: `@auth/drizzle-adapter`, `src/lib/auth.ts` (credentials path primarily hits `app_user`; adapter uses these tables).
  - Package deps: `next-auth@5 beta`, `@auth/drizzle-adapter`.

- **Business purpose & domain concepts:**
  - Split identity model:
    - **`users`**: Auth.js identity (OAuth/WebAuthn/session subject, text id).
    - **`app_user`**: CRM staff profile (desk, barriers, roles, later password_hash).
    - Link: `users.app_user_id` → conceptual 1:1 to `app_user.user_id`.
  - Supports production target of DB sessions + optional WebAuthn for directors while current app may use JWT strategy (sessions table still provisioned for cutover).
  - FK drops implement the same “break cycle in ORM / migrate freely” strategy documented in `rbac.ts` / `auth.ts` comments: columns remain, DB-level FKs may be reintroduced by hand migrations.

- **Key logic / algorithms / data shapes:**
  - Adapter-standard column names (snake_case: `refresh_token`, `access_token`, `id_token`, `session_state`) required by `@auth/drizzle-adapter`.
  - Text PKs for Auth.js user ids vs uuid PKs for CRM — intentional dual ID space.
  - Timestamps on auth tables are `timestamp` without tz (Auth.js `mode: "date"`), unlike CRM tables’ `timestamptz`.

- **Side effects:**
  - DDL only.
  - Dropping FKs weakens referential integrity until re-added elsewhere: orphanable `app_user.employee_party_id` / `contact_id`, barrier deal/party refs, sector parent chains.
  - Enables Auth.js adapter schema push without type-cycle issues.

- **Security / RBAC / compliance notes:**
  - **Token storage:** `accounts` can hold OAuth `refresh_token` / `access_token` / `id_token` in plain text columns — encryption at rest is DB/volume level only unless app encrypts first.
  - **WebAuthn public keys** in `authenticators` — expected; private keys never stored.
  - **Sessions table** enables server-side revoke if strategy is database; JWT strategy leaves table cold.
  - No link enforced between Auth.js `users.email` and `app_user.email` at DB level — app must keep them consistent (`src/lib/auth.ts` looks up app_user by email for credentials).
  - CASCADE delete from users → accounts/sessions/authenticators: deleting identity wipes credentials/sessions (good for erasure; ensure DSR process considers this).
  - Dropped FKs on barriers: application must prevent orphan barrier scopes that would break wall logic.

- **Coupling:**
  - **Upstream:** requires 0000 applied.
  - **Downstream TS:** `src/db/schema/auth.ts`, `src/lib/auth.ts`, admin seed/provisioning.
  - **Downstream SQL:** later migrations may re-add FKs / add `users`↔`app_user` constraint (`0008_users_app_user_id.sql` name suggests app_user_id work).
  - Journal entry present; snapshot `drizzle/meta/0001_snapshot.json`.

- **Risks, TODOs, dead code, quality notes:**
  - **Critical:** five FKs dropped and **not recreated here**. If no later migration restores them, DB allows invalid party/contact/barrier/sector parent references. Confirm against `0008+` and any raw SQL in `src/db/rls.ts` / domain check.
  - `users.app_user_id` has **no unique constraint** in this SQL — 1:1 is logical only; multiple Auth users could point at same app_user unless app enforces.
  - `users.email` unique allows NULL multiples in PostgreSQL unique semantics (multiple NULLs OK) — same as standard Auth.js.
  - Dual user tables (`users` vs `app_user`) increase onboarding complexity (must provision both for full OAuth+CRM, or credentials path can use app_user alone).
  - Timestamp without time zone inconsistency vs CRM schema — timezone bugs possible at session expiry boundaries.
  - Auto-generated; hand-editing risks desync with `auth.ts`.

---

## drizzle/0002_auth.sql

- **Lines:** 22  
- **Role in architecture:** **Hand-written** Track B / AUTH migration. Additive columns on `app_user` for real credentials authentication: bcrypt password, TOTP MFA secret/flag, account lockout counters. Enables `src/lib/auth.ts` Credentials provider to replace DEV-only “any non-empty password” stub. Complements Auth.js tables from 0001 (identity adapter) with CRM-side credential storage on `app_user`.

- **Exports (all significant):** No new tables. Alters `app_user`:

```sql
ALTER TABLE "app_user"
  ADD COLUMN IF NOT EXISTS "password_hash" text,
  ADD COLUMN IF NOT EXISTS "mfa_secret" text,
  ADD COLUMN IF NOT EXISTS "mfa_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "failed_login_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "locked_until" timestamp with time zone;
```

| Column | Type | Nullability / default | Purpose |
|---|---|---|---|
| `password_hash` | text | nullable | bcrypt hash (~60 chars); NULL = no password login |
| `mfa_secret` | text | nullable | TOTP secret (otpauth); plain text in this migration |
| `mfa_enabled` | boolean | NOT NULL DEFAULT false | gate TOTP challenge |
| `failed_login_count` | integer | NOT NULL DEFAULT 0 | lockout counter |
| `locked_until` | timestamptz | nullable | lockout expiry |

Idempotent: `IF NOT EXISTS` on each column; safe re-run on seeded DBs.

- **Imports / deps:**
  - Requires table `app_user` from 0000.
  - TS mirror: `src/db/schema/rbac.ts` fields `passwordHash`, `mfaSecret`, `mfaEnabled`, `failedLoginCount`, `lockedUntil` (comments explicitly cite “migration 0002_auth”).
  - Runtime: `src/lib/auth.ts` (bcryptjs verify, otpauth TOTP, lockout SQL increments); `src/db/seed-admin.ts` (sets password_hash); `src/features/admin/actions.ts` (admin set password); `src/features/admin/queries.ts` (locked user queries).
  - Packages: `bcryptjs`, `otpauth`, `next-auth`.

- **Business purpose & domain concepts:**
  - Staff login security for regulated broker/merchant bank CRM.
  - Password hashing (not reversible storage).
  - Optional per-user MFA (`mfa_enabled`).
  - Brute-force mitigation via `failed_login_count` + `locked_until`.
  - Coexists with existing `mfa_enrolled_at` from baseline (enrollment timestamp vs enable flag/secret).

- **Key logic / algorithms / data shapes:**
  - Pure DDL; algorithms live in `authorize` in `src/lib/auth.ts`:
    - Reject if `locked_until > now()`.
    - bcrypt compare against `password_hash`.
    - On fail: increment `failed_login_count`; at threshold set `locked_until`.
    - On success: reset count/clear lock; if `mfa_enabled`, require TOTP matching `mfa_secret`.
  - Column defaults mean existing rows get mfa_enabled=false, failed_login_count=0 without backfill script.

- **Side effects:**
  - Schema change only when applied.
  - After apply, login path can write `password_hash`, `failed_login_count`, `locked_until`, `mfa_*` via app code (auth + admin actions).
  - No RLS changes; columns inherit table privileges.

- **Security / RBAC / compliance notes:**
  - **Explicit PRODUCTION NOTE in file:** `mfa_secret` stored **plain text**. Leaked DB dump defeats second factor. Follow-up: pgcrypto `pgp_sym_encrypt` or app-layer AES-GCM with KMS-wrapped key (ARCHITECTURE §4.7).
  - `password_hash` correctly separate from secret; still protect DB access (hash cracking if weak passwords).
  - No CHECK that `mfa_secret IS NOT NULL` when `mfa_enabled = true` — app must enforce.
  - No column-level encryption, no RLS hiding of secrets from broad SELECT grants — privileged DB roles can read secrets.
  - Lockout fields are security-critical; race conditions possible without transactional increments (auth.ts comments mention SQL expression for +1).
  - Additive-only design is migration-safe for live seeded environments.

- **Coupling:**
  - **Who depends on these columns:** `src/lib/auth.ts`, `src/db/schema/rbac.ts`, `src/db/seed-admin.ts`, `src/features/admin/actions.ts`, `src/features/admin/queries.ts`.
  - **Not in** `drizzle/meta/_journal.json` as of analysis — **hand migration outside Drizzle generate journal**. Operators must apply via custom migrate path / ordered SQL runner, not only `drizzle-kit migrate` journal entries (which stop at 0001).
  - Related later files (not this batch): `0003_rls.sql` (pgcrypto extension for other uses), `0008_users_app_user_id.sql`.

- **Risks, TODOs, dead code, quality notes:**
  - **Journal gap:** file exists on disk but journal only lists 0000–0001 → high risk of environments missing 0002 if deploy only runs drizzle-kit migrate.
  - **mfa_secret plaintext** — documented TODO for prod encryption.
  - No index on `locked_until` (minor; admin lockout queries may filter).
  - No migration to backfill passwords (seed-admin handles bootstrap admin).
  - High-quality header comments; intentional hand SQL with IF NOT EXISTS (drizzle-kit generate often omits IF NOT EXISTS).
  - Does not touch Auth.js `users` table — credentials live only on CRM `app_user` (credentials provider design).

---

## Batch-001 cross-file summary

| File | Kind | Journaled? | Primary effect |
|---|---|---|---|
| `drizzle.config.ts` | Kit config | n/a | Points kit at `src/db/schema/index.ts` → `./drizzle`, PG, `DATABASE_URL` |
| `0000_minor_kitty_pryde.sql` | Generated baseline | Yes (idx 0) | Full CRM schema: 67 enums, ~40 tables, FKs, indexes, 3 generated columns |
| `0001_easy_scarlet_spider.sql` | Generated delta | Yes (idx 1) | Auth.js tables + drop 5 cycle FKs |
| `0002_auth.sql` | Hand-written AUTH | **No** in `_journal.json` | Additive credential/MFA/lockout columns on `app_user` |

**Architectural thread:** Config drives schema codegen → 0000 materializes capital-markets CRM → 0001 adds Auth.js identity plane and relaxes cycle FKs → 0002 hardens `app_user` for real password+MFA login used by application auth layer.

**Operational attention points for this batch alone:**
1. citext (+ gen_random_uuid/pgcrypto) prerequisites for 0000.
2. FK integrity after 0001 drops.
3. Ensuring 0002 is applied outside incomplete journal.
4. Plaintext `mfa_secret` until a later encryption migration.
