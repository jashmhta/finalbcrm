
# Batch 072

## `src/features/compliance/audit.ts`

- **Lines:** 185 | **Bytes:** 5407
- **Kind:** Application module
- **Header intent:** audit_log query helpers (immutable viewer).  Schema: audit.ts `audit_log` - INSERT-only (RLS + trigger), monthly RANGE partitioned by occurred_at, hash-chained for tamper-evidence. This module is READ-ONLY by design: there is no update/delete surface, and writes are performed only by the mutation layer via the `auditLog` insert (the hash chain is populated by a BEFORE INSERT trigger). See schema audit.ts for the migration notes that install immutability + the chain.  Filters mirror the indexes: 
- **Exported functions:** listAuditLog, getAuditLogEntry, listAuditLogForEntity
- **Exported types:** AuditLogFilter, AuditLogRow, AuditLogResult
- **DB ops patterns:** from, insert, leftJoin, select, where
- **Security signals:** rbac/rls, india-compliance
- **External deps:** drizzle-orm
- **Internal imports (2):** @/db, @/db/schema
- **Domain terms:** KYC, barrier

## `src/features/compliance/consent.ts`

- **Lines:** 185 | **Bytes:** 6538
- **Kind:** Application module
- **Header intent:** DPDP Act 2023 consent + Data Subject Request (DSR) helpers.  Research: COMPLIANCE_LEGAL_FEASIBILITY.md §6-7. Schema: compliance.ts `consent_record` (purpose-bound, granular per data category, retention clock) and `data_subject_request` (principal-rights workflow). Consent is purpose-bound - a marketing consent does NOT authorize sharing data with a rating agency; that needs its own consent_record. Withdrawal triggers a DSR (type=`withdraw_consent` or `erasure`).  These are PURE helpers (no DB). 
- **Exported functions:** computeConsentRetentionUntil, computeDsrDueDate, isConsentActive, dsrTypeForWithdrawal, canTransitionDsr
- **Exported const:** DEFAULT_RETENTION_YEARS_BY_PURPOSE, DSR_TIMELINE_DAYS, DSR_TRANSITIONS
- **Exported types:** ConsentPurpose, ConsentMethod, DsrType, DsrStatus
- **Security signals:** rbac/rls, india-compliance
- **TODOs/FIXMEs:** .
- **Domain terms:** credit_analysis, kyc

## `src/features/compliance/kyc.ts`

- **Lines:** 371 | **Bytes:** 14803
- **Kind:** Application module
- **Header intent:** KYC lifecycle helpers (PMLA 2002 + RBI Master Direction on KYC).  Research: COMPLIANCE_LEGAL_FEASIBILITY.md §5 (PMLA KYC/CDD/EDD, BO thresholds, PEP/sanctions, STR/CTR, retention). Schema: credit.ts `kyc_record` + `kyc_beneficial_owner`; contact.pep_status for PEP. These are PURE helpers - no DB access - so they can be unit-tested and reused by both Server Components (queries.ts) and Server Actions (actions.ts). DB-mutating orchestration lives in actions.ts and runs inside withRls.  Key rules en
- **Exported functions:** boThresholdFor, requiresEddForBo, computeValidUntil, computeRekycDueDate, computeRetentionUntil, canTransition, shouldEscalateToEdd, screenSanctions, screenPep
- **Exported const:** BO_THRESHOLD_PCT, PARTNERSHIP_BO_THRESHOLD_PCT, RISK_REFRESH_YEARS, RISK_LEAD_TIME_MONTHS, KYC_RETENTION_YEARS, allowedTransitions, STR_FILING_DEADLINE_WORKING_DAYS, CTR_MONTHLY_THRESHOLD_INR
- **Exported types:** KycStatus, KycType, KycRisk, PartyNature, LegalForm, ScreeningStatus, ScreeningResult
- **DB ops patterns:** update
- **Security signals:** rbac/rls, india-compliance
- **Domain terms:** KYC, party

## `src/features/compliance/pit.ts`

- **Lines:** 321 | **Bytes:** 12028
- **Kind:** Application module
- **Header intent:** SEBI (Prohibition of Insider Trading) Regulations 2015 - Reg 9 + Schedule B.  Research: COMPLIANCE_LEGAL_FEASIBILITY.md §3.7 (PIT / Chinese walls), §7 item 8 (designated-person & pre-clearance workflow), and §15 risk register (PIT / Chinese-wall failure is a HIGH-severity risk for BC given dual advisory/corporate-finance + potential secondary-trading activity).  This module encodes the PIT business rules the CRM must enforce: - a designated-person register (BC staff who handle UPSI + their immed
- **Exported functions:** isActiveDesignatedPerson, isInsiderCategory, canTransitionPreClearance, computeWindowReopen, isTradingWindowClosed, quarterlyClosureFor, eventClosureFor, requiresPreClearance, canExecutePreClearance, computePreClearanceExpiry
- **Exported const:** PRE_CLEARANCE_TRANSITIONS, PRE_CLEARANCE_VALIDITY_DAYS, POST_DISCLOSURE_WINDOW_HOURS
- **Exported types:** DesignatedPersonCategory, DesignatedPersonEntry, PitUpsiEvent, PreClearanceStatus, TradingWindowState, TradingWindowClosure
- **Security signals:** rbac/rls, india-compliance
- **Domain terms:** allocation, barrier, bond, issuer, mandate, party, underwriting
