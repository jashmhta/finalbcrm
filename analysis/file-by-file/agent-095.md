# File-by-file analysis — agent-095

**Batch:** `batch-095.list`  
**Workspace root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4 (import-parties script; tsconfig; vercel config; vitest)

---

## 1. `src/scripts/import-parties.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/scripts/import-parties.ts` |
| **Lines** | large (~700+ with generator + promote) |
| **Directive** | Standalone tsx CLI (not Next runtime) |
| **Role** | Party master CSV import + sample generator with dedup contract. |

### CLI

```
npx tsx src/scripts/import-parties.ts --generate-sample N [--out path]
npx tsx src/scripts/import-parties.ts <csv-path> [--batch N] [--queued-out path]
```

### Pipeline

1. Parse CSV (papaparse headers).
2. Zod validate: legal_name, party_nature, party_type, country, status, brand_origin, identifiers PAN/GSTIN/CIN/LEI formats, address fields.
3. Normalize uppercase identifiers.
4. Dedup vs `party_identifier_dedup_uidx` partial unique (type,value where deleted_at null):
   - existing match → deduped skip
   - within-file collision → queued to duplicate_candidates CSV
5. Batch promote transactions: party + party_type_assignment + party_identifier + address; unique-violation fallback → queued.
6. Summary inserted/deduped/queued/invalid + timing.

### Sample generator

mulberry32 seed 20260627; ~1.5% within-file dups; ~0.5% invalid; early rows collide with demo seed CINs for “deduped” path; dup pool rows 600–1199.

### Env

Manual `.env.local` load before dynamic db import (tsx lacks Next env loader).

### Business purpose

10k-party book scale tooling for party-centric CRM without touching seed UI. Matches DATA_MODEL §1.4 dedup.

### Side effects

Live DB writes — **no withRls / no user context** (ops script as DB superuser effectively).

### Security

- Must not run untrusted CSV in prod without review.
- No auth — operator shell access = full DB write.
- Queued candidates may contain PII on disk.

### Coupling

Shared `@/db` client + party schema tables only; no Next routes.

### Risks / TODOs

- Bypasses RLS and audit log.
- Batch size default 500; long runs on large imports.
- Brand_origin enum binarycapital|binarybonds|shared — dual brand at ingest.

---

## 2. `tsconfig.json`

| Field | Value |
|--------|--------|
| **Path** | `tsconfig.json` |
| **Lines** | 35 |
| **Role** | TypeScript project config for Next app. |

### Key options

- target ES2017, module esnext, moduleResolution bundler
- strict true, noEmit true, jsx react-jsx
- paths `@/*` → `./src/*`
- plugins: next
- include: next-env, **/*.ts(x), .next/types, .next/dev/types, **/*.mts
- exclude node_modules

### Coupling

Vitest aliases mirror `@` → src. All app imports use `@/`.

### Risks

allowJs true; skipLibCheck true (faster, hides dep types).

---

## 3. `vercel.ts`

| Field | Value |
|--------|--------|
| **Path** | `vercel.ts` |
| **Lines** | 56 |
| **Role** | Programmatic Vercel project config (vercel.json equivalent). |

### Export

```ts
export const config = {
  framework: "nextjs",
  buildCommand: "next build",
  installCommand: "npm ci",
  outputDirectory: ".next",
  regions: ["iad1"],  // NOT bom1 yet
  fluid: true,
  functions: { "src/app/**/*.{ts,tsx}": { memory: 1024, maxDuration: 60 } },
  headers: [ HSTS, nosniff, DENY frame, referrer, permissions-policy ],
}
```

### Business purpose / residency

Comments: production India residency Path 2 Docker ap-south-1 OR Vercel Enterprise bom1; avoid Vercel Blob/KV for regulated data. Current `regions: ["iad1"]` is US preview/demo posture — **production gap vs DPDP/SEBI India residency narrative**.

### Security headers

HSTS 2y preload, X-Frame DENY, nosniff, strict referrer, camera/mic/geo disabled.

### Risks

- iad1 contradicts bom1 comments.
- No CSP header.
- Fluid + 1GB/60s for import/model routes.

---

## 4. `vitest.config.ts`

| Field | Value |
|--------|--------|
| **Path** | `vitest.config.ts` |
| **Lines** | 37 |
| **Role** | Unit test runner for pure engines under `src/__tests__/`. |

### Config

- environment node
- include `src/__tests__/**/*.test.ts`
- alias `@` → src
- globals false; testTimeout 15s
- smoke tests opt-in via SMOKE_BASE_URL (self-skip)

### Covered engines (from tree)

bondPricing, ratios, scorecard, ratingMap, lbo/ma/matching, kyc, rbacSegmentation, reports, stages, etc.

### Risks

- No integration DB tests by default.
- Client component tests not in suite.

---

## Cross-file architecture (batch 095)

```
import-parties (ops) → party master dual-brand identifiers
vercel.ts → deploy region/residency tension
vitest → pure domain engines
tsconfig → path alias foundation
```

**Party-centric:** import is the bulk party ledger tool.  
**Production gaps:** iad1 vs India residency; import bypasses RLS/audit.

*End of agent-095 analysis.*
