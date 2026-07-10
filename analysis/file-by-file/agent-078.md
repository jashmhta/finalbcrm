# Agent 078 — File-by-file analysis (batch-078)

Files: ckyc.ts, demat.ts, emailCalendar.ts, env.ts | Fully read

---

## src/features/integrations/ckyc.ts

- **Lines:** 241  
- **Role:** CKYC Registry (CERSAI) adapter — CKYCRR 2.0 real-time API (notification 5 Jun 2026). Phase 1 KYC category. Shares KRA env credentials.

- **Exports:** `CkycLookupRequest`, `CkycRecord`, `CkycData`, `buildCkycSample`, `CkycClient`, `ckyc` adapter.

- **Key logic:**
  - Mock: Rohit Mehta NORMAL/COMPLETE record + mock:// image URLs (photo, signature, ID, address proofs).
  - Real: basicAuth KRA_API_USER/KEY; CKYC_ENV sandbox|production → cersai.gov.in URLs; GET `/ckycrr/v2/record?id&idType`.
  - idType auto: identifier starts with CKYC → CKYC else PAN.
  - Returns PII: pan, maskedAadhaar, dob, address — high sensitivity.

- **Security:** Reporting Entity onboarding with CERSAI required. Endpoint path **TO CONFIRM**. Shares credentials with KRA (env grouping). Image URLs may be signed/temporary upstream — not re-signed here.

- **Risks:** Recent API (Jun 2026); production stability unconfirmed; mock uses realistic PAN pattern ABCDE1234F.

---

## src/features/integrations/demat.ts

- **Lines:** 195  
- **Role:** CDSL/NSDL demat holdings adapter. Phase 3. **DP registration UNVERIFIED — likely scope OUT**.

- **Exports:** `DematHolding`, `DematAccount`, `buildDematSample`, `DematClient`, `demat` adapter.

- **Key logic:**
  - Mock: CDSL BO 1203300000441098, 2 NCD holdings, ACTIVE, kycLinked.
  - Real: DP_API_USER/KEY; DP_DEPOSITORY CDSL|NSDL; GET `/dp/{cdsl|nsdl}/account?boId`.
  - Context `depository` overrides default.

- **Business purpose:** Settlement readiness for bond placement (matching engine demat criterion). If Binary is not a SEBI DP, store demat as reference data only.

- **Risks:** No open demat API for non-DPs; placeholder URLs; adversarial check documented in accessRequirements.

---

## src/features/integrations/emailCalendar.ts

- **Lines:** 237  
- **Role:** Email/Calendar sync adapter (Microsoft Graph / Google Workspace). Phase 1 communication. SEBI/RBI communication retention use case.

- **Exports:** `EmailMessage`, `CalendarEvent`, `EmailCalendarData`, `buildEmailCalendarSample`, `EmailCalendarClient`, `emailCalendar` adapter.

- **Key logic:**
  - Mock: allocation confirmation email + KYC docs email + HDFC investor call event (dealRef DEAL-2026-0018).
  - Real: optional Graph and/or Google client id/secret; access tokens from env (`GRAPH_ACCESS_TOKEN`, `GOOGLE_WORKSPACE_ACCESS_TOKEN`) — **token acquisition out-of-band** by “in-region OAuth2 worker”.
  - Paths: Graph `/v1.0/me/messages` + `/v1.0/me/events`; Google Gmail/Calendar APIs.
  - Credentials present if either provider pair set (`any` predicate in env.ts).

- **Security:** OAuth2 tenant admin consent; Gmail restricted scopes; vendor as processor. Tokens in process env is operationally sensitive. Response shape assumes custom `emails`/`events` wrappers — not raw Graph message list format.

- **Risks:** Response parsing mismatch with real Graph; no incremental sync/delta; no archive to interaction table yet.

---

## src/features/integrations/env.ts

- **Lines:** 461  
- **Role:** **Shared environment + HTTP plumbing for all integration adapters** — single source of truth for mock toggle, credential discovery, typed errors, and resilient HTTP client. Server-only (no client boundary).

- **Exports (major):**
  - Types: `AdapterId` (12 ids), `IntegrationErrorCode`, `HttpClientOptions`, `HttpRequestConfig`
  - `class IntegrationError` — adapter, code, httpStatus, retryable, `toSummary()`
  - `envKeysPresent`, `requireEnv`, `optionalEnv`
  - `isMockMode(adapter)`, `ADAPTER_CREDENTIALS`, `credentialsPresent`, `adapterEnvKeys`, `resolveAdapterStatus`
  - `class HttpClient` — fetch with timeout, abort composition, retries, backoff+jitter
  - `bearerAuth`, `basicAuth` (Buffer base64)

- **Key logic — mock mode precedence:**
  1. `USE_MOCK_<ADAPTER_SNAKE>` true|false per adapter
  2. else `USE_MOCK_INTEGRATIONS` global
  3. else default true if `NODE_ENV !== "production"`

- **Key logic — credentials:**
  - Per-adapter key lists; `all` vs `any` predicates (gstinPan, bseNse, emailCalendar).
  - `resolveAdapterStatus`: mock if mock mode OR missing creds; ready only when real mode + creds.

- **Key logic — HttpClient.request:**
  - Loop attempt 0..maxRetries; AbortController timeout (default 15s).
  - Maps 401/403→auth (non-retry), 429→rate_limit retry, 5xx→retry, other 4xx→non-retry.
  - Parse JSON with bad_response on failure; empty body → undefined.
  - Network/Abort → timeout/network with retry; backoff min(2000, 250*2^attempt)+jitter 0–150ms.

- **Side effects:** Reads `process.env`; outbound fetch only when clients call; no DB.

- **Security:**
  - Centralizes secrets access (good).
  - Errors surface messages via IntegrationError — avoid leaking raw upstream bodies (currently message-only).
  - `basicAuth` uses Node `Buffer` — server-only assumption holds.
  - Empty string env treated as unset.

- **Coupling:** Every adapter file imports this; registry/actions depend indirectly.

- **Risks / TODOs:**
  - No circuit breaker / shared rate-limit across adapters.
  - No structured logging/metrics hooks.
  - Jitter uses Math.random (fine for backoff).
  - Per-adapter mock key transform: camelCase → SNAKE (accountAggregator → USE_MOCK_ACCOUNT_AGGREGATOR).

---

## Batch 078 synthesis

CKYC + demat + email/calendar adapters complete more of the §11 surface; `env.ts` is the critical shared infrastructure. Demat/CCIL-class scope uncertainty continues; env module quality is high (retry taxonomy, credential predicates).
