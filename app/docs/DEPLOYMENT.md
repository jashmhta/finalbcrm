# Deployment — Binary Capital CRM

> **Scope of this document:** how to stand the CRM up in a production-shaped
> environment. This is the operator/runbook layer. It assumes the code is
> built and the local Postgres (`binary_crm`) works. For the gated/client
> items that must close **before** go-live (registrations, licences, legal,
> certifications, real data), see
> [`PRODUCTION_CHECKLIST.md`](./PRODUCTION_CHECKLIST.md) — that is the gate;
> this is the machinery behind it.
>
> **Honesty note.** The app is **code-ready**: it builds clean
> (`npx tsc --noEmit` + `next build`), Auth.js v5 with a real
> bcrypt + TOTP + lockout credential flow is wired (`src/lib/auth.ts`),
> Postgres RLS policies + an immutable hash-chained audit log are migrated
> (`drizzle/0003_rls.sql`, applied via `src/db/rls.ts`), 12 integration
> adapters have a real-client path behind a mock toggle
> (`src/features/integrations/*`), and the 10k-party import + perf proof pass
> (`src/scripts/import-parties.ts`, `src/db/seed-scale.ts`). What is **not**
> ready is everything that requires a third party or the client: real API
> credentials, the firm's actual SEBI/RBI registrations, MeitY-empaneled
> hosting procurement, legal paper, and real client data. Those live in the
> checklist.

---

## 1. Hosting — the two supported paths

The architecture is intentionally **hosting-portable**: no Vercel-only
primitives are in the hot path, so the **same Next.js app** runs on either
path. Pick one; the data layer is identical.

| | Path 1a — Vercel `bom1` | Path 2 — India containers |
|---|---|---|
| Compute | Vercel Fluid Compute pinned to `bom1` (Mumbai / `ap-south-1`) | AWS App Runner / ECS Fargate / EKS in `ap-south-1`, or Azure Container Apps West India (Pune) |
| Postgres | AWS Aurora/RDS PostgreSQL in `ap-south-1` (NOT Vercel managed Postgres — see §5) | Same Aurora/RDS `ap-south-1` |
| Object store | AWS S3 `ap-south-1` (regulated PII/KYC/MNPI docs) | Same |
| Cache/queue | ElastiCache `ap-south-1` (Redis) for sessions + BullMQ | Same |
| Image | `next start` on Vercel | `Dockerfile` (Node server, non-root, `tini` PID 1) |
| Choose when | counsel accepts Vercel control-plane metadata residency | you want vendor control / lock-in avoidance, or counsel rejects `bom1` control-plane |

> **The decision between 1a and 2 is client-gated** (counsel opinion on
> Vercel control-plane metadata under DPDP/SEBI). See
> `PRODUCTION_CHECKLIST.md` §"Hosting procurement (MeitY-empaneled)". Until
> that closes, do **not** consider either path live for regulated data.

### 1.1 Path 1a — Vercel `bom1`

```bash
# from the repo root (this directory's parent: /home/Jashmhta/crm/app)
vercel link                          # link the project
vercel env add DATABASE_URL           production  # paste the Aurora/RDS ap-south-1 DSN
vercel env add DATABASE_URL_UNPOOLED  production  # for migrations (no pgbouncer)
vercel env add AUTH_SECRET            production  # openssl rand -base64 32
vercel env add AUTH_URL               production  # https://crm.binarycapital.in
vercel env add AUTH_DRIZZLE_URL       production  # usually == DATABASE_URL
vercel env add VERCEL_REGION          production  # bom1   (pin; see vercel.json below)
vercel env add FIELD_ENC_KEY          production  # KMS-wrapped, never commit
vercel env add KMS_KEY_ID             production
vercel env add USE_MOCK_INTEGRATIONS  production  # "false" once creds are live
# ...one vercel env add per integration key from §3...
vercel --prod deploy
```

Pin the function region explicitly (don't rely on dashboard defaults):

```jsonc
// vercel.json
{
  "regions": ["bom1"],
  "functions": { "src/app/**/*.{ts,tsx}": { "memory": 1024 } }
}
```

### 1.2 Path 2 — India containers (Dockerfile)

The repo ships a production `Dockerfile` (multi-stage, Node 20 alpine,
non-root `nextjs` user, `tini` for graceful SIGTERM so Next.js `after()` and
in-flight requests drain on ECS/Fargate rollout).

```bash
# build
docker build -t binary-crm:latest .

# migrate (one-off, from the build stage which carries drizzle-kit + tsx)
docker build --target build -t binary-crm:migrate .
docker run --rm --env-file .env.production \
  binary-crm:migrate npx drizzle-kit migrate
docker run --rm --env-file .env.production \
  binary-crm:migrate node -e "import('./src/db/rls.ts').then(m=>m.applyRlsMigration())"

# run
docker run --rm -p 3000:3000 --env-file .env.production binary-crm:latest
```

> **Note.** The `Dockerfile` header references a `scripts/deploy.sh`
> orchestration script (build → migrate → start). That script is owned by the
> deploy track and is **not yet present** in the repo. Until it lands, use the
> explicit commands above. Do not block go-live on it — the three commands are
> the entirety of what it wraps.

---

## 2. Database — provision, migrate, seed-admin

### 2.1 Provision (one-time, DBA / superuser)

Create the database and the **table-owner** role (the role the app's
`DATABASE_URL` connects as — it owns the tables and can apply the RLS
policy/trigger/grant layer, but is **not** BYPASSRLS):

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE crm LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD 'CHANGE_ME';
CREATE DATABASE binary_crm OWNER crm;
SQL
```

### 2.2 Run the Drizzle migrations (forward schema)

```bash
# uses DATABASE_URL_UNPOOLED (no PgBouncer) — migrations need a real connection
npx drizzle-kit migrate
```

This applies `0000` (schema), `0001`, `0002` (auth tables), in journal order.

### 2.3 Apply RLS — superuser one-time, then app-role re-runnable

`drizzle/0003_rls.sql` is a **policy/role/grant/trigger** layer, not a schema
change (it adds no columns — the schema is preserved per the track rules).
It (a) creates a non-superuser, non-BYPASSRLS application role `crm_app`,
(b) ENABLEs + FORCEs RLS on the 16 walled tables, (c) creates GUC-driven
policies reading `app.user_id` / `app.wall text[]` / `app.mandate_ids uuid[]`
(set per-transaction by `src/db/context.ts`), (d) installs an immutable,
sha256 hash-chained, INSERT-only `audit_log`, and (e) GRANTs
SELECT/INSERT/UPDATE to `crm_app` (INSERT-only on `audit_log`).

The `CREATE ROLE crm_app` + `CREATE EXTENSION pgcrypto` statements require a
**superuser the first time only**:

```bash
sudo -u postgres psql -d binary_crm -f drizzle/0003_rls.sql
```

After that, the policy/trigger/grant layer is **re-runnable from the app
role** via `src/db/rls.ts` `applyRlsMigration()` (the role/extension
statements are tolerated and reported `skipped` when the caller lacks
CREATEROLE — so it is safe to re-apply after schema additions):

```bash
npx tsx -e "import('./src/db/rls.ts').then(m => m.applyRlsMigration())"
```

Verify the wall actually filters (introspects catalog + a wall smoke test):

```bash
npx tsx -e "import('./src/db/rls.ts').then(m => m.verifyRls()).then(r => console.log(r))"
```

> **Production wiring note.** For RLS to be enforced at runtime, the app's
> `DATABASE_URL` must connect as the `crm_app` role (the one WITHOUT
> BYPASSRLS), not as the table-owner `crm`. The owner bypasses policies. The
> migrations and `applyRlsMigration()` run as the owner; the running Next.js
> process must use the `crm_app` DSN. Set a separate
> `DATABASE_URL_UNPOOLED=…owner…` for migrations and
> `DATABASE_URL=…crm_app…` for the app. (The deps/deploy tracks own the final
> role/DSN split; flag this in the checklist if it isn't done.)

### 2.4 Seed the break-glass admin

`src/db/seed-admin.ts` provisions `shray@binarycapital.in` with a real
bcrypt-hashed password, MFA disabled, and the `admin` role grant. It is
idempotent and safe to run before or after `src/db/seed.ts`:

```bash
npx tsx src/db/seed-admin.ts
```

The password is printed **exactly once** to stdout. Capture it, then
**rotate it after first login** in production. Do not leave
`BinaryCapital@2026` live.

> The demo seed (`src/db/seed.ts`, ~801 rows) and the 10k scale seed
> (`src/db/seed-scale.ts`) are owned by other tracks and are **not for
> production data** — they are synthetic. Real client records come in via the
> import tool (§4) and are a checklist item.

---

## 3. Environment variables

Copy `.env.example` → `.env.local` (dev) / `.env.production` (Path 2) / `vercel env`
(Path 1a). **Never commit a populated `.env.production`.**

### 3.1 Core (required for the app to boot safely)

| Var | Purpose | Notes |
|---|---|---|
| `DATABASE_URL` | App DSN (must be the `crm_app` role for RLS) | `…ap-south-1…rds.amazonaws.com:5432/binary_crm?sslmode=require` |
| `DATABASE_URL_UNPOOLED` | Migrations DSN (table owner, no pgbouncer) | drizzle-kit + applyRlsMigration use this |
| `AUTH_SECRET` | Auth.js JWT signing secret | `openssl rand -base64 32`; rotate with care (invalidates sessions) |
| `AUTH_URL` | Canonical app URL | `https://crm.binarycapital.in` |
| `AUTH_DRIZZLE_URL` | Postgres DSN for the auth session/account tables | usually == `DATABASE_URL` |
| `VERCEL_REGION` | Pin to Mumbai | `bom1` (Path 1a only) |
| `NODE_ENV` | Runtime env | `production` |
| `FIELD_ENC_KEY` | PII field-encryption key (app-layer AES-GCM) | KMS-wrapped; never commit a real key |
| `KMS_KEY_ID` | KMS CMK id for field-key wrapping | AWS KMS `ap-south-1` / Azure Key Vault West India |

### 3.2 Integrations (provision as the corresponding access/licence is granted)

The integration layer (`src/features/integrations/env.ts`) is **credential-away**:
each adapter ships a real HTTP client behind a mock toggle. An adapter goes
live when (a) `USE_MOCK_INTEGRATIONS=false` (or per-adapter
`USE_MOCK_<ADAPTER>=false`) **and** (b) its required keys are present. Missing
keys → the adapter silently falls back to mock and reports status `"mock"` in
the UI. So you can deploy with mocks today and flip adapters live one at a
time as Binary procures each access — no code change, no redeploy of the
adapter itself (just an env update + function warm).

| Adapter | Env keys | Gated by (see checklist) |
|---|---|---|
| accountAggregator | `AA_CLIENT_ID`, `AA_CLIENT_SECRET`, `AA_ENV` (sandbox/prod) | Sahamati / RBI AA onboarding |
| kra | `KRA_API_USER`, `KRA_API_KEY` | KRA membership (NDML/CAMS/Kfintech) |
| ckyc | `KRA_API_USER`, `KRA_API_KEY` (CERSAI CKYCRR 2.0 via KRA creds) | CERSAI access |
| mca | `MCA_API_KEY` | MCA21 API licence |
| gstinPan | `GSTIN_API_KEY` **or** `PAN_API_KEY` | GST/PAN verification vendor |
| bseNse | `BSE_API_KEY` and/or `NSE_API_KEY` | BSE/NSE debt-segment membership |
| ccil | `CCIL_FTRAC_USER`, `CCIL_FTRAC_PASSWORD` | CCIL F-TRAC membership |
| demat | `DP_API_USER`, `DP_API_KEY` | CDSL/NSDL DP membership |
| ratingFeed | `RATING_FEED_API_KEY` | CRISIL/ICRA/CARE/India Ratings/Acuite/Infomerics feed licence |
| fiuInd | `FIU_IND_FINGATE_USER`, `FIU_IND_FINGATE_PASSWORD` | FINity/finCORE? — FINGate 2.0 reporting-entity login |
| emailCalendar | `GRAPH_CLIENT_ID`+`GRAPH_CLIENT_SECRET` and/or `GOOGLE_WORKSPACE_CLIENT_ID`+`GOOGLE_WORKSPACE_CLIENT_SECRET` | M365/Workspace tenant admin consent |
| whatsapp | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Meta Cloud API BSP approval |

Plus the market-data key (`MARKET_DATA_API_KEY`) for Bloomberg/Refinitiv/LSEG
licensed feeds and `EKYC_API_KEY` for Aadhaar eKYC/DigiLocker — **only if**
Aadhaar collection is lawfully required (data minimization; confirm with
compliance before enabling).

### 3.3 Toggle

```ini
USE_MOCK_INTEGRATIONS=false   # flip all adapters to real-attempt
# or pin a single one while the rest stay mock:
USE_MOCK_ACCOUNT_AGGREGATOR=false
```

---

## 4. Bulk import — 10k parties

The CSV import tool (`src/scripts/import-parties.ts`) is the production path
for loading the real party master. It is a standalone `tsx` script that reads
+ writes the live DB through the shared `db` client and does **not** touch the
demo seed, the UI, the schema, or any migration file.

Pipeline: papaparse parse → zod validate (PAN/GSTIN/CIN/LEI format) →
normalize identifiers → dedup against the
`party_identifier_dedup_uidx` partial unique index (existing-match →
`deduped`; within-file dup → `queued` → `duplicate_candidates.csv`) →
transactional per-chunk promote (party + party_type_assignment +
party_identifier + address) → summary (inserted / deduped / queued / invalid
+ timing).

```bash
# generate a synthetic 10k sample (shape reference, not real data)
npx tsx src/scripts/import-parties.ts --generate-sample 10000 --out sample-10k.csv

# import real data
npx tsx src/scripts/import-parties.ts /path/to/real-parties.csv --batch 500
```

> **Real 10k records are a checklist item** (the client must supply/extract
> them from the current source of truth). The tool is code-ready; the data is
> not. The perf target (<200ms listParties at 10k) is proven on synthetic
> data at ~10.8k rows: **21.3ms median** (see `seed-scale-perf.txt`) with the
> trigram + btree indexes.

---

## 5. India data-residency & SEBI Cloud Framework (read before go-live)

This is the single most important compliance constraint. It is **binding, not
advisory** for a SEBI-registered entity (SEBI Cloud Framework circular
SEBI/HO/ITD/ITD_VAPT/P/CIR/2023/033, 6 Mar 2023). Summary, with the practical
implication for this deployment:

- **All SEBI-RE data must reside *and be processed* within India** — primary,
  DR, and near-DR. Compute in `bom1` + Postgres in `ap-south-1` (Path 1a)
  satisfies this *for compute and data*; the open question is Vercel's
  **control plane** (deployment orchestration, env-var plumbing, project
  metadata) and **managed products** (Blob/KV/Edge Config), which may process
  metadata outside India even with compute pinned to `bom1`. That is the
  client-gated counsel decision (Path 1a vs Path 2).
- **CSP must be MeitY-empaneled with STQC-audited data centres** (or on-prem).
  AWS, Azure, and GCP India regions are MeitY-empaneled. **Vercel is not
  known to be MeitY-empaneled as a CSP** — this is the crux of the 1a-vs-2
  decision and is in the checklist.
- **Do NOT use Vercel managed Postgres / Blob / KV / Edge Config for
  regulated data.** Use Aurora/RDS `ap-south-1`, S3 `ap-south-1`, and
  ElastiCache `ap-south-1` regardless of path. The app is already wired this
  way (no Vercel-only storage primitives in the hot path).
- **BYOK / BYOE keys in a dedicated, fault-tolerant HSM under RE control.**
  `KMS_KEY_ID` + `FIELD_ENC_KEY` (KMS-wrapped) implement this at the app
  layer; the HSM/KMS itself is provisioned in `ap-south-1` (AWS KMS CMK or
  Azure Key Vault HSM). The RE retains ownership of data, logs, and keys; the
  CSP acts only fiduciarily.
- **Mandatory exit/expunging** + 6-month remediation if the CSP loses
  empanelment. Bake the exit clause into the MSA/DPA (checklist legal item).
- **DPDP Act 2023 / DPDP Rules 2025**: restricts cross-border *transfer* of
  personal data; for a SEBI RE handling financial PII the conservative read
  is store **and** process in India (which both paths do for data). Breach
  notification to the Data Protection Board is "as soon as possible" and to
  affected data principals "without undue delay" — there is **no statutory
  72-hour clock** (the 72h figure is a firm-internal operational target).
- **RBI** has not issued a binding cloud-empanelment mandate as of Jun 2026
  (IFS Cloud via IFTAS announced but not compulsory); the SEBI Cloud Framework
  is the binding instrument. RBI outsourcing/cyber guidelines apply to any
  RBI-regulated counterparty flow. Monitor for a future RBI cloud circular.

**Bottom line for ops:** keep Aurora/RDS, S3, ElastiCache, and KMS all in
`ap-south-1`; keep Vercel (if Path 1a) for compute + static edge only; never
put PII/KYC/MNPI in a Vercel managed product. The remaining decision (is
Vercel control-plane metadata acceptable?) is counsel's, in the checklist.

---

## 6. Rollback

Drizzle migrations in this repo are **forward-only** (drizzle-kit 0.31 has no
`down` command). Rollback is therefore a combination of:

1. **Code rollback** — redeploy the previous commit / image
   (`vercel --prod deploy` prior SHA, or `docker run` the prior
   `binary-crm:<sha>` tag). This is instant and is the first action for a
   bad-functionality deploy.
2. **Schema rollback** — if a migration introduced an unwanted schema change,
   write a **hand-authored "down" migration** SQL file and apply it with
   `psql` (do not edit the drizzle journal). Add the corresponding down SQL
   to the PR that adds the migration, so every forward migration ships with
   its reverse. Until that convention exists, the safe posture is:
3. **PITR (point-in-time recovery)** on Aurora/RDS `ap-south-1` — the
   authoritative rollback for data. Enable automated backups + PITR on the
   cluster (retention ≥ the audit-log retention, ~7 yrs SEBI-aligned — confirm
   with counsel). A bad data migration → restore the cluster to the pre-migration
   timestamp, then redeploy the matching code image.

**RLS rollback** specifically: `drizzle/0003_rls.sql` is idempotent and
additive (DROP IF EXISTS + CREATE). To temporarily disable RLS for an
emergency DBA session, `ALTER TABLE <t> DISABLE ROW LEVEL SECURITY;` — but
this must be done as the table owner, never left on for the app role, and
must be reverted before the app reconnects. Re-running `applyRlsMigration()`
restores the full policy/trigger/grant layer.

**Order on a bad deploy:** (1) code rollback to prior image → (2) if data was
mutated, PITR the cluster to the deploy timestamp → (3) re-run
`applyRlsMigration()` to confirm the wall is intact → (4) `verifyRls()`.

---

## 7. Smoke checks after deploy

```bash
# health (force-dynamic route, hits the DB as crm_app → exercises RLS path)
curl -fsS https://crm.binarycapital.in/api/auth/session | head

# RLS wall intact
npx tsx -e "import('./src/db/rls.ts').then(m => m.verifyRls()).then(r => console.log(r))"

# adapters reporting their real/mock status (UI: /integrations; or call the registry)
npx tsx -e "import('./src/features/integrations/registry.ts').then(m => console.log(m.status()))"
```

Then log in as the seeded admin, rotate the password, enroll MFA, and walk one
record end-to-end through each enabled adapter.
