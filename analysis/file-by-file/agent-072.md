# Agent 072 — Extreme detail analysis

Batch files: `src/features/compliance/audit.ts`, `src/features/compliance/consent.ts`, `src/features/compliance/kyc.ts`, `src/features/compliance/pit.ts`

Pure + query compliance domain logic: audit viewer, DPDP consent rules, PMLA KYC, SEBI PIT.

---

## `src/features/compliance/audit.ts`

- **Lines:** 186 | **Role:** READ-ONLY audit_log query helpers
- **Exports:**
  - `AuditLogFilter` — entityType/Id, actorUserId, operation, correlationId, barrierId, from/to ISO, q substring
  - `AuditLogRow` — full row + actorEmail + prevHash/rowHash
  - `AuditLogResult` — rows, total, page, pageSize
  - `listAuditLog({ filter, page=1, pageSize=50 })`
  - `getAuditLogEntry(auditLogId)`
  - `listAuditLogForEntity(entityType, entityId, limit=100)` oldest-first for detail tabs
- **Key logic:** dynamic WHERE; leftJoin app_user for email; newest-first with secondary auditLogId; parallel count + page
- **Side effects:** Read only — no update/delete API
- **Security:** No auth inside module — page layer must require audit:read; barrier filter for wall forensics
- **Coupling:** admin re-exports; detail history tabs
- **Risks:** OFFSET pagination at large scale; q uses ilike with interpolated string (trust admin input)

---

## `src/features/compliance/consent.ts`

- **Lines:** 186 | **Role:** Pure DPDP consent + DSR rules (no DB)
- **Exports types:** ConsentPurpose (9), ConsentMethod (4), DsrType (6), DsrStatus (5)
- **Constants:**
  - `DEFAULT_RETENTION_YEARS_BY_PURPOSE`: marketing 2, advisory 7, kyc/credit/sharing 5, regulatory 7, portfolio 7, secondary_trading 2
  - `DSR_TIMELINE_DAYS`: access 30, rectification 7, erasure 30, portability 30, restriction 7, withdraw_consent 3
  - `DSR_TRANSITIONS`: received→in_review|cancelled; in_review→fulfilled|rejected|cancelled; rejected→in_review; terminals empty
- **Functions:**
  - `computeConsentRetentionUntil(purpose, givenAt?, years?)` → YYYY-MM-DD
  - `computeDsrDueDate(type, requestedAt?)` → date or null
  - `isConsentActive({ consentWithdrawnAt, deletedAt })`
  - `dsrTypeForWithdrawal(purpose)`: kyc/regulatory/credit/data_sharing_* → **restriction** (PMLA 5yr retention); marketing/secondary/advisory/portfolio → **erasure**
  - `canTransitionDsr(from, to)`
- **Business:** Purpose-bound consent; PMLA retention overrides DPDP erasure for regulated purposes
- **Risks / TODOs:** DSR type `nomination` not in schema enum — documented TODO; UTC date helper may shift local midnight edges

---

## `src/features/compliance/kyc.ts`

- **Lines:** 372 | **Role:** Pure PMLA/RBI KYC lifecycle helpers
- **Exports:**
  - Types: KycStatus, KycType (CDD|EDD|simplified), KycRisk, PartyNature, LegalForm, ScreeningStatus, ScreeningResult
  - `BO_THRESHOLD_PCT`: organization/spv **10**, trust **15**, natural_person/gov/regulator **null** (role-based)
  - `PARTNERSHIP_BO_THRESHOLD_PCT = 15` — must pass legalForm:'partnership' because party_nature has no partnership
  - `boThresholdFor(nature, legalForm?)`, `requiresEddForBo(...)` ≥ threshold
  - `RISK_REFRESH_YEARS`: low **10**, medium **8**, high **2**
  - `RISK_LEAD_TIME_MONTHS`: low/med **3**, high **1**
  - `KYC_RETENTION_YEARS = 5` (PMLA s.12 — not Rule 7)
  - `computeValidUntil`, `computeRekycDueDate`, `computeRetentionUntil`
  - `allowedTransitions` state machine:
    - pending → in_review
    - in_review → under_eds_check | approved | rejected
    - under_eds_check → approved | rejected | in_review
    - approved → expired | rekyc_due
    - rejected → in_review
    - expired → rekyc_due
    - rekyc_due → in_review
  - `canTransition`, `shouldEscalateToEdd` (high risk | BO threshold | PEP≠none | sanctions match|pending)
  - STUBS: `screenSanctions`, `screenPep` always clear with lists UN_1267/1373, RBI_UAPA, OFAC_SDN / PEP_*
  - `STR_FILING_DEADLINE_WORKING_DAYS = 7`, `CTR_MONTHLY_THRESHOLD_INR = 1_000_000` (₹10 lakh)
- **Business:** Encodes 2019 BO 10% (debunks legacy 25%); partnership 15%; re-KYC RBI FAQ 3782
- **Security:** Stubs never auto-match — production must wire providers before relying on screening
- **Coupling:** actions.ts, queries UI, contact.pep_status
- **Risks:** Screening stubs always clear; CTR/STR no transaction subsystem yet

---

## `src/features/compliance/pit.ts`

- **Lines:** 322 | **Role:** SEBI PIT Reg 9 + Schedule B pure rules (**no backing tables yet**)
- **Exports:**
  - DesignatedPersonCategory (8: advisory_cf, credit_analyst, bond_underwriting, rating_advisory, trading_desk, compliance_finance, immediate_relative, connected_person)
  - `DesignatedPersonEntry`, `isActiveDesignatedPerson`, `isInsiderCategory` (trading_desk designated but not insider by category — wall is defence)
  - PitUpsiEvent: mandate|structuring|rating_action|bond_pricing|allocation|ma_signing|project_finance_close|other
  - PreClearanceStatus + `PRE_CLEARANCE_TRANSITIONS` + `canTransitionPreClearance`
  - `PRE_CLEARANCE_VALIDITY_DAYS = 5`
  - `POST_DISCLOSURE_WINDOW_HOURS = 48`
  - TradingWindowState open|closed_quarterly|closed_event
  - `TradingWindowClosure`, `computeWindowReopen`, `isTradingWindowClosed`, `quarterlyClosureFor`, `eventClosureFor`
  - `requiresPreClearance(dp, issuerPartyId, hasRelationship)` — insider + relationship
  - `canExecutePreClearance` — approved + window open + within 5 days
  - `computePreClearanceExpiry`
- **Business:** Chinese-wall interplay — closed window blocks execution even with pre-clearance
- **Side effects:** None (pure)
- **Security:** Rules ready for future tables; currently seam only
- **Coupling:** Documented for mutation/view layers when tables land
- **Risks / TODOs:** No schema tables; not enforced on trade_event path yet — HIGH risk register item remains open until wired
