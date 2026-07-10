
# Batch 095

## `src/scripts/import-parties.ts`

- **Lines:** 810 | **Bytes:** 26098
- **Kind:** Application module
- **Header intent:** CSV import tool for the party master (DATA_MODEL §1.1, §1.4, §2.1-2.3).  Run: npx tsx src/scripts/import-parties.ts --generate-sample 10000 [--out path] npx tsx src/scripts/import-parties.ts <csv-path> [--batch N] [--queued-out path]  Pipeline (matches the §1.4 dedup contract + a PartyService-style promote): 1. Parse CSV (papaparse, header row). 2. Validate each row (zod): required fields + PAN/GSTIN/CIN/LEI format. 3. Normalize identifiers (uppercase, trim). 4. Dedup: - existing-match  -> "dedu
- **Zod schemas:** RowSchema
- **DB ops patterns:** from, insert, returning, select, where
- **Security signals:** india-compliance
- **External deps:** drizzle-orm, node:fs, node:path, papaparse, zod
- **Domain terms:** binarybonds, binarycapital, investor, issuer, onboarding, party

## `tsconfig.json`

- **Lines:** 34 | **Bytes:** 670
- **Kind:** Application module

## `vercel.ts`

- **Lines:** 55 | **Bytes:** 2729
- **Kind:** Application module
- **Exported const:** config
- **Security signals:** india-compliance

## `vitest.config.ts`

- **Lines:** 36 | **Bytes:** 1285
- **Kind:** Application module
- **Header intent:** Vitest configuration — Track B (TESTS).  Scope: pure library units under src/__tests__/. The financial engines (bondPricing, ratios, scorecard, ratingMap static mapping) are deterministic and side-effect free, so they run in the node environment without a database or a running Next server. The route smoke test is opt-in via SMOKE_BASE_URL (it fetches a live server) and self-skips otherwise, so `vitest run` stays green in CI / without a Postgres.  Path alias `@/*` → `src/*` mirrors tsconfig.json 
- **Default export:** yes
- **External deps:** node:path, node:url, vitest/config
- **Domain terms:** scorecard
