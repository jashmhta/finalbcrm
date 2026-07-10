# Agent 077 — File-by-file analysis (batch-077)

Batch source: `batch-077.list` | Workspace: `/home/Jashmhta/crm/bc-crm/app` | Files: 4 (fully read)

---

## src/features/integrations/accountAggregator.ts

- **Lines:** 298  
- **Role:** Account Aggregator (Sahamati FIU) integration adapter — Phase 1 highest-value credit-analysis feed. Implements `IntegrationAdapter` with mock sample + real `AccountAggregatorClient` over shared `HttpClient`.

- **Exports:**
  - Types: `AccountAggregatorConsentRequest`, `FipFi`, `AccountAggregatorData`
  - `export function buildAccountAggregatorSample(input: Record<string, string | undefined>): AccountAggregatorData`
  - `export class AccountAggregatorClient` — `createConsent`, `fetchFi`, `fetchConsentFi`
  - `export const accountAggregator: IntegrationAdapter`

- **Imports:** `./env` (credentials, HttpClient, bearerAuth, isMockMode, resolveAdapterStatus, …); `./types` (AdapterResult, errorResult, IntegrationAdapter).

- **Business purpose:** Binary onboards as FIU; customer consent via AA app; fetch FI (deposit, term-deposit, SIP, etc.) from FIPs for credit analysis. Open architecture (~17 AAs, ~179 FIPs, ~955 FIUs as of 2026). Vendor acts as processor under Binary credentials.

- **Key logic:**
  - Mock builds approved consent with HDFC deposit / ICICI TD / CAMS SIP sample holdings.
  - Real client: `AA_CLIENT_ID`/`SECRET`, `AA_ENV` sandbox|production → Sahamati URLs; bearer of `clientId:secret`; header `x-fi-id`.
  - `fetchConsentFi`: createConsent (fiTypes deposit/term-deposit/sip) then GET `/Fi/fetch/{handle}`.
  - Adapter `run` → mock if `isMockMode`, else `runReal` with not_configured guard + `errorResult` catch.

- **Side effects:** Outbound HTTPS when live; no DB writes; no auth in-module (gated by Server Actions).

- **Security / RBAC:** Credentials in env; bearer token construction simplistic (not OAuth client-credentials flow). Consent data is highly sensitive financial PII — retention/logging not handled here. Mock always succeeds.

- **Coupling:** Registered in `registry.ts`; invoked via `actions.ts`. Env keys `AA_CLIENT_ID`, `AA_CLIENT_SECRET`, `AA_ENV`, optional `AA_FIU_ID`.

- **Risks:** Placeholder API paths vs real ReBIT envelopes; no consent UI; dual-mode `bearerAuth(clientId:secret)` may not match Sahamati auth; Phase 1 cost ~4-6 PM noted in metadata.

---

## src/features/integrations/actions.ts

- **Lines:** 100  
- **Role:** `"use server"` Server Actions for `/integrations` page. JSON-serializable `AdapterResult` in/out; **no DB writes** — pure adapter dispatch.

- **Exports:**
  - `runIntegrationMock(input): Promise<AdapterResult>`
  - `runAllIntegrationMocks(): Promise<AdapterResult[]>`
  - `runIntegration(input): Promise<AdapterResult>`
  - `runAllIntegrations(): Promise<AdapterResult[]>`

- **Imports:** `zod/v4`; `requireUser` from `@/lib/rbac`; registry `runAdapter`, `runAdapterMock`, `runAll`, `runMock`; type `AdapterResult`.

- **Key logic:**
  - `runOneSchema`: id 1–64 chars; optional identifier ≤64; optional `context` string record.
  - Invalid input → `invalidResult` with `ok:false`, status mock.
  - Mock-only family preserved for UI “Run” / “Run all mocks”.
  - Production family calls `adapter.run` (env mock/real dispatch).

- **Security / RBAC:**
  - **Only `requireUser()`** — comment explicitly: no dedicated `integration:run` permission yet; any signed-in user can invoke all adapters including KYC/FIU/WhatsApp mocks and live upstreams if creds present.
  - No rate limiting; `runAll` can fan out 12 upstreams.

- **Coupling:** `/integrations` UI; registry; all 12 adapters transitively.

- **Risks:** Missing fine-grained RBAC is the top security finding in this batch. Live mode can hit external APIs (and FIU submit) with any authenticated session.

---

## src/features/integrations/bseNse.ts

- **Lines:** 247  
- **Role:** BSE/NSE debt-segment trade reporting adapter. Phase 3; **membership UNVERIFIED — likely scope OUT** for arranger/advisory.

- **Exports:** `DebtTrade`, `DebtTradeReport`, `buildBseNseSample`, `BseNseClient`, `bseNse` adapter.

- **Business purpose:** Member-portal debt trade download (not public REST). If Binary is not a member, rely on delayed licensed feeds or manual entry.

- **Key logic:**
  - Mock: 2 NSE debt trades (HDFC NCD buy, Tata Capital sell); valueInr = qty × price × 1e6 / 100.
  - Real: optional BSE/NSE bearer keys; GET `/member/debt/download/{exchange}?reportDate=`.
  - Context: `exchange` BSE|NSE, `reportDate`.

- **Security:** Member credentials; adversarial note that firm likely not a member. Mock labels membership UNVERIFIED in summary.

- **Risks:** Fabricated REST paths over member portals; value formula assumes price as percent of face.

---

## src/features/integrations/ccil.ts

- **Lines:** 216  
- **Role:** CCIL F-TRAC trade repository reporting adapter. Phase 3; **NOT a direct CCIL member — likely OUT of scope**.

- **Exports:** `FtracRecord`, `FtracReport`, `buildCcilSample`, `CcilClient`, `ccil` adapter.

- **Business purpose:** Member workflow at ftrac.co.in for CB-REPO/CP/CD/NCD reporting. Binary would clear through sponsoring bank/PD.

- **Key logic:**
  - Mock: 2 MATCHED NCD trades via “sponsoring member” banks; reconciliation counts.
  - Real: basicAuth `CCIL_FTRAC_USER`/`PASSWORD`; GET `/reports/ftrac?product&reportDate`.
  - Env keys **not in .env.example** (deploy-track new keys).

- **Security:** Portal credentials; scope-OUT for arranger; no write/report submission implemented (query only).

- **Risks:** Real F-TRAC is portal/workflow not this REST shape; accidental live wiring without membership will fail.

---

## Batch 077 synthesis

First integrations slice: AA (priority FIU feed), Server Actions entrypoints, BSE/NSE + CCIL (both scope-uncertain market/reporting). Shared pattern: mock sample + credential-gated real client + `IntegrationAdapter` surface. Critical RBAC gap on actions.
