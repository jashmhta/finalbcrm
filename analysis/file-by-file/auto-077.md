
# Batch 077

## `src/features/integrations/accountAggregator.ts`

- **Lines:** 297 | **Bytes:** 10195
- **Kind:** Application module
- **Header intent:** Account Aggregator (AA) adapter.  §11: open architecture; Binary onboards as a Financial Information User (FIU) via Sahamati. ~17 AAs, ~179 FIPs, ~955 FIUs as of 2026. ReBIT + Sahamati Central Registry govern API standards. Highest-value, most feasible credit-analysis feed - Phase-1 priority.  Real flow: Binary (FIU) requests a consent handle from an AA; the customer approves via the AA app; the FIU fetches Financial Information (FI) from one or more Financial Information Providers (FIPs) - bank
- **Exported functions:** buildAccountAggregatorSample
- **Exported const:** accountAggregator
- **Exported types:** AccountAggregatorConsentRequest, FipFi, AccountAggregatorData
- **Exported classes:** AccountAggregatorClient
- **Security signals:** auth, india-compliance
- **Internal imports (3):** ./env, ./env, ./types
- **TODOs/FIXMEs:** XXX4421", | XXX0091", | XXX7741",
- **Domain terms:** Bond, INVESTOR, binarycapital, demat, investor

## `src/features/integrations/actions.ts`

- **Lines:** 99 | **Bytes:** 3361
- **Kind:** Server Actions module; Feature mutations (actions)
- **Directive:** `use server`
- **Exported functions:** runIntegrationMock, runAllIntegrationMocks, runIntegration, runAllIntegrations
- **Zod schemas:** runOneSchema
- **Security signals:** auth
- **External deps:** zod/v4
- **Internal imports (3):** @/lib/rbac, ./registry, ./types

## `src/features/integrations/bseNse.ts`

- **Lines:** 246 | **Bytes:** 8681
- **Kind:** Application module
- **Header intent:** BSE / NSE debt-segment trade reporting adapter.  §11: MEMBER-ONLY; NO public open API. Member-access terminals + member- portal files (NSE Member/CM Download, Bhavcopy) rather than generic REST. Binary's membership UNVERIFIED - likely acts as arranger/advisory, not member. If NOT a member (likely), rely on licensed delayed feeds or manual entry - scope OUT.  Access to swap for real: Binary must be a SEBI-registered broker/dealer with BSE/NSE debt-segment membership. ADVERSARIAL CHECK: membership
- **Exported functions:** buildBseNseSample
- **Exported const:** bseNse
- **Exported types:** DebtTrade, DebtTradeReport
- **Exported classes:** BseNseClient
- **Security signals:** auth, india-compliance
- **Internal imports (3):** ./env, ./env, ./types

## `src/features/integrations/ccil.ts`

- **Lines:** 215 | **Bytes:** 7591
- **Kind:** Application module
- **Header intent:** CCIL F-TRAC trade reporting adapter.  §11: MEMBER WORKFLOW, not public API. CCIL acts as Trade Repository via F-TRAC (ftrac.co.in); reporting members access via login. Binary is NOT a direct CCIL member (membership for banks/PDs/FIs with RBI approval); any CCIL-settled trades clear through a sponsoring bank/PD member.  Access to swap for real: Binary must be a CCIL member/reporting entity. ADVERSARIAL CHECK: NOT a direct CCIL member. Likely OUT of scope for an arranger/advisory. Rely on member-u
- **Exported functions:** buildCcilSample
- **Exported const:** ccil
- **Exported types:** FtracRecord, FtracReport
- **Exported classes:** CcilClient
- **Security signals:** auth
- **Internal imports (3):** ./env, ./env, ./types
