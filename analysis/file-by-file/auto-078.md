
# Batch 078

## `src/features/integrations/ckyc.ts`

- **Lines:** 240 | **Bytes:** 8062
- **Kind:** Application module
- **Header intent:** CKYC Registry (CERSAI) adapter.  §11: CKYCRR 2.0 launched with REAL-TIME API (CERSAI notification 5 Jun 2026; prior CKYCRR 1.0 used batch-file/SFTP). Protean and other vendors offer CKYCR API integration.  Access to swap for real: Binary onboarded as Reporting Entity with CERSAI; API credentials + onboarding. Exact API spec/endpoint TO CONFIRM directly with CERSAI. Real-time API is recent (Jun 2026) - confirm production stability and onboarding timeline.  Env (see .env.example): KRA_API_USER, KR
- **Exported functions:** buildCkycSample
- **Exported const:** ckyc
- **Exported types:** CkycLookupRequest, CkycRecord, CkycData
- **Exported classes:** CkycClient
- **Security signals:** auth, rbac/rls, india-compliance
- **Internal imports (3):** ./env, ./env, ./types
- **TODOs/FIXMEs:** X-XXXX-7821",
- **Domain terms:** KYC, kyc, onboarding

## `src/features/integrations/demat.ts`

- **Lines:** 194 | **Bytes:** 7011
- **Kind:** Application module
- **Header intent:** CDSL / NSDL depository (demat) adapter.  §11: DP-system access ONLY for SEBI-registered Depository Participants + empaneled software vendors (NSDL SPEED-e, CDSL easi/easiest, STP segments). NO open demat API for non-DP. Binary's DP registration UNVERIFIED - likely NOT a DP.  Access to swap for real: Binary must be a SEBI-registered DP (or work through one). ADVERSARIAL CHECK: DP registration UNVERIFIED - likely NOT a DP. If not a DP (likely), store demat details as REFERENCE DATA only - scope OU
- **Exported functions:** buildDematSample
- **Exported const:** demat
- **Exported types:** DematHolding, DematAccount
- **Exported classes:** DematClient
- **Security signals:** auth, india-compliance
- **Internal imports (3):** ./env, ./env, ./types
- **Domain terms:** Demat, demat

## `src/features/integrations/emailCalendar.ts`

- **Lines:** 236 | **Bytes:** 9236
- **Kind:** Application module
- **Header intent:** Email / Calendar adapter (Microsoft Graph / Google Workspace).  §11: SELF-SERVE for the customer's tenant via OAuth2. Well-documented APIs (Google Workspace Gmail+Calendar API, Microsoft Graph). Binary consents via OAuth2 (vendor acts as processor); restricted-scope verification for Gmail API. Customer-tenant admin consent. Communication retention/archive needed for SEBI/RBI record-keeping.  Access to swap for real: OAuth2 tenant admin consent (Microsoft Graph or Google Workspace). Vendor acts a
- **Exported functions:** buildEmailCalendarSample
- **Exported const:** emailCalendar
- **Exported types:** EmailMessage, CalendarEvent, EmailCalendarData
- **Exported classes:** EmailCalendarClient
- **Security signals:** rbac/rls, india-compliance
- **Internal imports (3):** ./env, ./env, ./types
- **Domain terms:** KYC, allocation, binarycapital, investor, kyc, onboarding

## `src/features/integrations/env.ts`

- **Lines:** 460 | **Bytes:** 16827
- **Kind:** Client component
- **Directive:** `use client`
- **Header intent:** Shared environment + HTTP plumbing for integration adapters.  This module is the single source of truth for: • the USE_MOCK_INTEGRATIONS toggle (default: true in dev, false in prod when credentials are present), • per-adapter credential discovery against the keys already declared in `.env.example` (plus a small set of additional keys documented in the adapter headers below - they are read via `process.env` so wiring is a credential-away), • a typed HTTP client with timeout + exponential-backoff 
- **Exported functions:** envKeysPresent, requireEnv, optionalEnv, isMockMode, credentialsPresent, adapterEnvKeys, resolveAdapterStatus, bearerAuth, basicAuth
- **Exported const:** ADAPTER_CREDENTIALS
- **Exported types:** AdapterId, IntegrationErrorCode, AdapterCredentialSpec, HttpClientOptions, HttpRequestConfig
- **Exported classes:** IntegrationError, HttpClient
- **DB ops patterns:** from
- **Security signals:** auth, rbac/rls, india-compliance
- **Domain terms:** demat
