# Production Checklist — Binary Capital CRM

> **Purpose.** The single, honest list of what must close **before go-live**.
> It is split into what the **vendor** (this codebase) has already delivered
> (§1), and what is **gated on the client / a third party / counsel** and is
> therefore not something code can resolve (§2–§9). Every gated item names the
> owner and the evidence that closes it.
>
> **Status legend.**
> ✅ **Code-ready** — implemented, builds, tested.
> ⏳ **Client-gated** — waiting on Binary Capital, a regulator, a counterparty,
>   or counsel. This is the critical path to go-live.
> 🔧 **Vendor in-flight** — being built by another track; not yet merged.

This document is the gate. `DEPLOYMENT.md` is the machinery that runs once the
gate is cleared.

---

## 1. Done by the vendor (code-ready, marked complete)

These are the production-readiness tracks the build was responsible for. They
are implemented, type-check clean (`npx tsc --noEmit`), and the Next 16 build
is green. Items marked 🔧 are owned by a sibling track and expected in this
pass — verify they are merged before you check them off.

### 1.1 Authentication & session
- ✅ Auth.js v5 (`next-auth@5.0.0-beta.31`) with the Drizzle adapter, JWT
  strategy (production target: DB-stored sessions mirrored to in-region Redis
  for edge-revocation — see `src/lib/auth.ts` header TODO).
- ✅ Real **bcrypt** password verify + constant-time user-enumeration
  mitigation (dummy-hash compare on unknown/inactive users) in
  `src/lib/auth.ts`.
- ✅ **TOTP MFA** (otpauth, ±30s drift window), gated on `mfa_enabled`; fails
  closed if MFA-enabled but no secret provisioned.
- ✅ **Account lockout** (5 consecutive failures → 15-min lock), atomic
  SQL-side counter increment in `registerFailedLogin`.
- ✅ `src/proxy.ts` (Next 16 Proxy, renamed middleware) — coarse auth: redirect
  unauthenticated → `/login`, bounce authenticated off `/login`. RBAC
  `can()` runs server-side per route/server-action; RLS is the authoritative
  data control (proxy is not the only gate).
- ⏳ **Real IdP + MFA enrollment** — see §9. Credentials are a real
  implementation but are in-process; the prod-preferred route is a real OIDC
  IdP (Okta/Entra ID/Clerk) with credentials as break-glass. **Enroll MFA on
  every production user** before go-live (currently disabled on the seeded
  admin).

### 1.2 Row Level Security & audit
- ✅ Postgres RLS migration `drizzle/0003_rls.sql`: non-superuser, non-BYPASSRLS
  app role `crm_app`; ENABLE + FORCE RLS on 16 walled tables; GUC-driven
  policies (`app.user_id`, `app.wall text[]`, `app.mandate_ids uuid[]`).
- ✅ `src/db/context.ts` sets the GUCs per-transaction (`SET LOCAL`) inside
  `db.transaction` via `withRls()`; arrays passed as Postgres arrays, not
  string-parsed per row.
- ✅ Immutable, tamper-evident `audit_log` — INSERT-only + sha256 hash-chain
  trigger (`row_hash = sha256(prev_hash || payload)`); reject-non-INSERT
  BEFORE UPDATE/DELETE/TRUNCATE trigger.
- ✅ `src/db/rls.ts` `applyRlsMigration()` (re-runnable from the app role) +
  `verifyRls()` (catalog introspection + wall smoke test).
- 🔧 **Runtime DSN = `crm_app` role.** The running app must connect as
  `crm_app` (no BYPASSRLS), not the table-owner `crm`. Confirm the deploy
  track wires `DATABASE_URL` → `crm_app` and `DATABASE_URL_UNPOOLED` → owner.
  **Check this before go-live — if the app runs as the owner, RLS is silently
  bypassed.**

### 1.3 Integrations (12 adapters, real-client path behind mock toggle)
- ✅ `src/features/integrations/env.ts` — `USE_MOCK_INTEGRATIONS` toggle (dev
  default true, prod default false), per-adapter `USE_MOCK_<ADAPTER>` override,
  credential-presence resolution → `ready` / `mock` status, typed `HttpClient`
  with timeout + exponential-backoff retry + jitter + structured
  `IntegrationError`.
- ✅ 12 adapters: accountAggregator, kra, ckyc, mca, gstinPan, bseNse, ccil,
  demat, ratingFeed, fiuInd, emailCalendar, whatsapp — each with a mock and a
  real-client path.
- ⏳ **Real credentials/licences for every adapter you want live** — see §5.
  Today they are mock-by-default; flipping an adapter is a credential-away
  (env update, no code change).

### 1.4 Deploy config
- ✅ `Dockerfile` (Path 2): multi-stage, Node 20 alpine, non-root, `tini` PID 1,
  graceful shutdown for `after()`.
- ✅ `.env.example` documents every var; `next.config.ts` + `drizzle.config.ts`
  in place; `src/db/index.ts` is serverless-safe (`prepare: false`, dev
  singleton).
- 🔧 `vercel.json` region pin (`bom1`) and `scripts/deploy.sh` orchestration —
  expected from the deploy track (the `Dockerfile` already references
  `scripts/deploy.sh`; use the explicit commands in `DEPLOYMENT.md` §1.2 until
  it lands).

### 1.5 Import tool & performance
- ✅ `src/scripts/import-parties.ts` — CSV import with zod validation,
  identifier normalization, dedup against the
  `party_identifier_dedup_uidx` partial unique index, transactional per-chunk
  promote, `duplicate_candidates.csv` for ambiguous rows, summary output.
- ✅ 10k-party perf proof: `src/db/seed-scale.ts` → **21.3ms median** listParties
  at ~10.8k rows (target <200ms). See `seed-scale-perf.txt`. Trigram + btree
  indexes in place.
- ⏳ **Real 10k client records** — see §7. The tool is code-ready; the data is
  client-supplied.

### 1.6 Tests
- ✅ Vitest suite (`vitest.config.ts`, node env, `@/*` alias):
  `src/__tests__/bondPricing.test.ts`, `ratios.test.ts`, `scorecard.test.ts`,
  `ratingMap.test.ts` (deterministic financial engines), and an opt-in
  `routeSmoke.test.ts` (self-skips without `SMOKE_BASE_URL`).
- 🔧 **Coverage of the RLS wall + adapter contract tests** — expected from the
  tests track. Before go-live, confirm there is a test that proves a user
  without `wall-credit` cannot select a `wall-credit`-tagged row, and that
  each real adapter maps its `IntegrationError` codes to stable
  `AdapterResult.error` values.

---

## 2. SEBI / RBI registration verification (client-gated)

The app's integrations and compliance posture assume specific registrations.
**Binary Capital must produce current evidence for each.** Verify against the
public regulator portals, not the firm's assertion.

- ⏳ **SEBI Certificate of Registration (COR)** — confirm the registration
  **category** (Merchant Banker / Stock Broker – debt segment / Investment
  Adviser / Portfolio Manager / NBFC). The category determines which
  integrations (BSE/NSE debt API, NDS-OM access) are even available and what
  obligations attach. **Verify at
  [siportal.sebi.gov.in](https://siportal.sebi.gov.in)** — the SEBI
  intermediary registration search. Capture the COR number + validity; attach
  to the legal file.
- ⏳ **BSE / NSE debt-segment membership** — required for the `bseNse` adapter
  to go live (bond listing, trade reporting, order routing for the retail/HNI
  "Buy Bonds" flow). Exchange membership ID + API entitlement.
- ⏳ **CCIL membership (F-TRAC)** — for the `ccil` adapter. CCIL membership for
  the relevant segments (G-Sec / corporate bond / money market).
- ⏳ **Depository Participant (CDSL/NSDL) membership** — for the `demat`
  adapter. DP ID + API access.
- ⏳ **KRA membership (NDML / CAMS / Kfintech)** — for `kra` + `ckyc` adapters.
  SEBI KRA-regulation registration; submit KYC, poll/receive status, store KRA
  reference.
- ⏳ **Credit-bureau / rating-agency eligibility** — confirm the firm's lawful
  basis to pull/hold credit data and rating rationales; rating-agency feed
  licences are contractual (see §5).

**Owner:** Binary Capital compliance officer. **Evidence:** COR screenshot +
PDF, membership IDs, and the matching API entitlement letter, filed in the
legal repository.

---

## 3. DPDP Act 2023 / DPDP Rules 2025 status (client + counsel-gated)

- ⏳ **Confirm the notified DPDP Rules 2025 status** — breach notification to
  the Data Protection Board is "as soon as possible" and to affected data
  principals "without undue delay"; **there is no statutory 72-hour clock**
  (the 72h figure is a firm-internal operational target only). Confirm exact
  procedural details (form, manner, content of notice) against the notified
  Rules and Data Protection Board guidance once published.
- ⏳ **Consent records** — every data subject (investor, issuer contact, IFA)
  must have a `consent` record capturing scope, timestamp, privacy-notice
  version, and withdrawal events. The schema supports this; confirm the
  **privacy-notice version + collection workflow** with counsel and that
  consents are captured at onboarding.
- ⏳ **Data-subject-rights workflow** — access (structured export within DPDP
  timelines) and erasure (with **PMLA legal-retention override** for KYC —
  the system returns "retained under legal obligation; access restricted"
  rather than deleting). Confirm exact statutory SLAs with counsel.
- ⏳ **Aadhaar — yes/no?** Collect Aadhaar **only if** a SEBI-registered flow
  lawfully requires it. If no, omit Aadhaar fields entirely (data
  minimization). Confirm with compliance before enabling `EKYC_API_KEY`.
- ⏳ **Breach runbook** — 72h internal triage/containment target documented;
  DPDP Board notification procedure documented; counsel-approved templates.

**Owner:** Binary Capital DPO + counsel. **Evidence:** privacy-notice version,
consent-capture flow walkthrough, DSR runbook, breach runbook.

---

## 4. Hosting procurement — MeitY-empaneled India (client + procurement-gated)

This is the gating item for §1 of `DEPLOYMENT.md` (Path 1a vs Path 2).

- ⏳ **Counsel opinion on Vercel control-plane metadata residency** — with
  compute pinned to `bom1`, does Vercel's control plane + managed products
  (Blob/KV/Edge Config) processing metadata outside India constitute a DPDP
  transfer or breach the SEBI Cloud Framework? If **yes/unclear → Path 2**
  (India containers on MeitY-empaneled AWS/Azure/GCP `ap-south-1`). If **no →
  Path 1a (Vercel `bom1`)** is the lower-effort compliant default.
- ⏳ **MeitY-empaneled CSP procurement** — whichever path, the CSP (AWS /
  Azure / GCP India) must be **MeitY-empaneled with STQC-audited data centres**
  (all three hyperscalers are). Vercel is **not known to be MeitY-empaneled as
  a CSP** — the crux of the 1a-vs-2 decision.
- ⏳ **Postgres on Aurora/RDS `ap-south-1`** — NOT Vercel managed Postgres.
  Verify the actual region of any Vercel Marketplace PG provider before use;
  default to Aurora/RDS regardless.
- ⏳ **S3 `ap-south-1`** for regulated PII/KYC/MNPI documents (not Vercel
  Blob). **ElastiCache `ap-south-1`** for sessions + BullMQ (not Vercel KV).
- ⏳ **BYOK / BYOE HSM under RE control** — AWS KMS CMK or Azure Key Vault HSM
  in `ap-south-1`; `KMS_KEY_ID` + KMS-wrapped `FIELD_ENC_KEY` provisioned; key
  rotation on; CloudTrail/Audit logs on key use. The RE retains ownership of
  data, logs, and keys (CSP acts fiduciarily only).
- ⏳ **DR + near-DR in India** — SEBI Cloud Framework requires primary + DR +
  near-DR all in India. Provision the DR cluster in a second India AZ/region.
- ⏳ **Exit/expunging clause** in the MSA/DPA (see §6) — 6-month remediation
  if the CSP loses empanelment.

**Owner:** Binary Capital IT/procurement + counsel. **Evidence:** MeitY
empanelment certificate for the chosen CSP, signed MSA/DPA with exit clause,
KMS key ARN + rotation config, DR topology diagram.

---

## 5. Real API credentials & licences (client + counterparty-gated)

Each adapter is credential-away (see `DEPLOYMENT.md` §3.2). Flipping an
adapter to live requires the **access/contract** first, then the env var.
Provision in this order; mark each adapter in the `/integrations` UI as it
moves `mock → ready`.

- ⏳ **Market data — Bloomberg / Refinitiv / LSEG** (`MARKET_DATA_API_KEY`) —
  licensed; the most expensive/slowest to procure. Start early.
- ⏳ **Rating-agency feeds — CRISIL / ICRA / CARE / India Ratings / Acuite /
  Infomerics** (`RATING_FEED_API_KEY`) — licensed per agency.
- ⏳ **KRA / CKYC** (`KRA_API_USER`/`KRA_API_KEY`) — NDML/CAMS/Kfintech
  membership + CERSAI CKYCRR 2.0 access.
- ⏳ **Account Aggregator — Sahamati / RBI AA** (`AA_CLIENT_ID`/
  `AA_CLIENT_SECRET`, `AA_ENV=sandbox` first) — onboarding via Sahamati;
  sandbox before prod.
- ⏳ **BSE/NSE debt** (`BSE_API_KEY`/`NSE_API_KEY`) — exchange membership.
- ⏳ **CCIL F-TRAC** (`CCIL_FTRAC_USER`/`CCIL_FTRAC_PASSWORD`) — CCIL member
  portal.
- ⏳ **DP — CDSL/NSDL** (`DP_API_USER`/`DP_API_KEY`) — DP membership.
- ⏳ **MCA21** (`MCA_API_KEY`) — MCA21 API licence.
- ⏳ **GSTIN/PAN** (`GSTIN_API_KEY` and/or `PAN_API_KEY`) — verification
  vendor.
- ⏳ **FIU-IND FINGate 2.0** (`FIU_IND_FINGATE_USER`/`FIU_IND_FINGATE_PASSWORD`)
  — reporting-entity login.
- ⏳ **Email/calendar** (`GRAPH_*` and/or `GOOGLE_WORKSPACE_*`) — M365/Workspace
  tenant admin consent (DPDP consent + MNPI hygiene; wall-scoped sync).
- ⏳ **WhatsApp** (`WHATSAPP_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`) — Meta Cloud
  API BSP approval.
- ⏳ **Aadhaar eKYC/DigiLocker** (`EKYC_API_KEY`) — **only if** §3 confirmed
  Aadhaar is lawfully required.

**Owner:** Binary Capital ops + each counterparty. **Evidence:** signed
licence/access letter per adapter + the live env var in `vercel env` /
`.env.production`, and the adapter showing `ready` in `/integrations`.

---

## 6. Legal (client + counsel-gated)

- ⏳ **MSA** (Master Services Agreement) with the vendor — scope, fees,
  IP, warranty, limitation of liability.
- ⏳ **DPA** (Data Processing Agreement) — DPDP-aligned; CSP sub-processor
  flow-through; RE-owns-data/keys clause; **exit/expunging + 6-month
  remediation** per SEBI Cloud Framework; breach-notification cooperation.
- ⏳ **SLA** — uptime, RTO/RPO (match the DR topology in §4), support
  response, severity definitions.
- ⏳ **Escrow** — source-code escrow (RE retain access if vendor ceases to
  support) — standard for regulated-entity software.
- ⏳ **Counsel sign-off on the residency path** (§4) and on DPDP breach
  procedure (§3).
- ⏳ **Audit-log retention period** — 7 years is a common SEBI-aligned figure;
  confirm exact requirement with counsel and set the cluster PITR retention +
  `audit_log` retention accordingly.

**Owner:** Binary Capital legal + counsel. **Evidence:** signed MSA, DPA, SLA,
escrow agreement; counsel memo on residency + breach.

---

## 7. Real 10k client records migration (client-gated)

- ⏳ **Extract the real party master** from the current source of truth
  (whatever Binary uses today — spreadsheets, an existing CRM, the public
  brochure list of 70+ orgs / 150+ institutional contacts). The target is
  10,000+ two-sided relationships.
- ⏳ **Map fields** to the import CSV schema (see `--generate-sample` output of
  `src/scripts/import-parties.ts` for the exact shape). Confirm PAN/GSTIN/CIN/LEI
  format expectations with the data owner.
- ⏳ **Run the import** in staging first (`--batch 500`), review
  `duplicate_candidates.csv`, resolve ambiguous rows, then run in production.
- ⏳ **Sign-off** — the data owner confirms the imported count matches the
  source and a sample of records are correct.
- ⏳ **Consent backfill** — for every imported personal-data record, confirm a
  `consent` record exists or is obtained (§3). Imported PII without consent is
  a DPDP exposure.

**Owner:** Binary Capital data owner. **Evidence:** staging import summary,
resolved `duplicate_candidates.csv`, production import summary matching source
count, signed data-acceptance.

---

## 8. Credit-model calibration & domain sign-off (client + quant-gated)

The credit engines (bond pricing, ratios, scorecard, rating map) are
deterministic and unit-tested, but the **weights/thresholds/assumptions** are
defaults, not the firm's calibrated view.

- ⏳ **Calibrate the scorecard weights** to Binary's house methodology —
  `src/__tests__/scorecard.test.ts` covers the engine mechanics; the actual
  factor weights + cutoffs must be set by the quant/credit team and signed off.
- ⏳ **Bond-pricing conventions** — day-count, settlement, yield conventions
  (FIMMDA) confirmed against the firm's dealing policy.
- ⏳ **SPV/non-recourse DSCR model assumptions** — default stress scenarios
  confirmed.
- ⏳ **Rating-map static mapping** — confirm the agency → internal-grade map
  with the credit team.
- ⏳ **Domain sign-off** — the head of credit + head of bonds sign that the
  model outputs are fit for the firm's use, with documented assumptions and
  limitations.

**Owner:** Binary Capital head of credit + head of bonds / quant. **Evidence:**
calibrated config, signed model sign-off memo, versioned assumptions doc.

---

## 9. Real IdP + MFA enrollment (client-gated)

- ⏳ **Pick a real IdP** — OIDC/SAML (Okta / Microsoft Entra ID / Clerk), per
  `src/lib/auth.ts` header. Keep the credentials provider as **break-glass
  only** (rotate the seeded admin password, restrict its use, alert on its
  use).
- ⏳ **Provision the IdP** — tenant, groups mapping to CRM roles + wall
  clearance (the `jwt`/`session` callbacks stamp `appUserId`, `wall`, `roles`
  from the CRM profile; confirm the IdP group → wall mapping with the
  information-barrier owner).
- ⏳ **Enroll MFA on every production user** — TOTP is wired; **require it** in
  prod (set `mfa_enabled = true` after each user enrolls). Preferred: add
  WebAuthn as the second factor (TODO in `src/lib/auth.ts` header).
- ⏳ **Encrypt `mfa_secret` at rest** — currently stored as-is; move to
  pgcrypto / app-layer AES-GCM with a KMS-wrapped key (TODO in
  `src/lib/auth.ts` header). Flag if the auth track hasn't done this.
- ⏳ **Password-reset + email-verification flow** — not yet present (TODO in
  `src/lib/auth.ts` header); required before credentials is anything more than
  break-glass.
- ⏳ **Session strategy cutover** — when ready, flip to
  `session: { strategy: "database" }` + Redis mirror for edge-revocation
  (TODO in `src/lib/auth.ts` header). Until then JWT is acceptable but
  sessions are not instantly revocable at the edge.

**Owner:** Binary Capital IT + the auth track. **Evidence:** IdP tenant URL,
group→role/wall mapping doc, MFA-enforced screenshot, encrypted-secret
migration applied, password-reset flow demo.

---

## 10. Go-live gate (sign-off matrix)

Go-live requires **all** of the following to be ✅ or signed-off:

| Gate | Owner | Status |
|---|---|---|
| Build green (`tsc --noEmit` + `next build`) + tests pass | vendor | ✅ |
| RLS enforced at runtime (app runs as `crm_app`, `verifyRls()` clean) | deploy track | 🔧 verify |
| Auth: real IdP + MFA enforced on all users + encrypted secrets | auth track + client | ⏳ |
| Residency path chosen + counsel sign-off + MeitY-empaneled CSP | client + counsel | ⏳ |
| SEBI COR + memberships verified | client compliance | ⏳ |
| Real credentials for every live adapter | client + counterparties | ⏳ |
| Legal: MSA + DPA + SLA + escrow signed | client legal | ⏳ |
| Certifications: VAPT + SOC 2 / ISO 27001 + ISO 22301 | client + auditor | ⏳ |
| Real 10k records imported + data-owner sign-off | client data owner | ⏳ |
| Credit models calibrated + domain sign-off | client credit/bonds | ⏳ |
| DPDP: consent capture + DSR + breach runbook | client DPO + counsel | ⏳ |

> **Certifications note (referenced above, owned externally):** before
> go-live the deployment should pass a **VAPT** (Vulnerability Assessment &
> Penetration Test — SEBI-mandated for REs) by a CERT-In-empaneled auditor;
> pursue **SOC 2 Type II** and/or **ISO/IEC 27001** (ISMS) and **ISO 22301**
> (BCDR) on the hosting + the app. These are not vendor code items — they are
> audits of the running, hosted system, so they can only close **after** the
> residency path, hosting, and integrations are live in staging. Schedule them
> early; they have multi-week lead times.

---

## 11. What is honestly code-ready vs client-gated (one-paragraph summary)

**Code-ready now:** the Next 16 app builds clean; Auth.js v5 with real bcrypt +
TOTP + lockout is wired; Postgres RLS (16 walled tables, GUC-driven policies) +
an immutable hash-chained audit log are migrated and re-runnable; 12
integration adapters each have a real HTTP-client path behind a mock toggle;
the 10k-party CSV import tool and the perf proof (21.3ms at ~10.8k rows) pass;
a Vitest unit suite covers the financial engines. **Not code-resolvable
(client/third-party-gated):** SEBI COR + exchange/CCIL/DP/KRA memberships;
real API credentials and rating-agency/market-data licences; the MeitY
empaneled India hosting procurement and counsel's call on Vercel control-plane
residency; MSA/DPA/SLA/escrow; VAPT + SOC 2 / ISO 27001 / 22301 certifications
(which can only run against the live hosted system); the real 10k client
record extraction + import; credit-model calibration and domain sign-off; the
real IdP + mandatory MFA enrollment + encrypted-secret + password-reset
hardening. The vendor's job is done on the code; the go-live critical path is
now Binary Capital's registrations, procurement, legal, certifications, data,
and model sign-offs.
