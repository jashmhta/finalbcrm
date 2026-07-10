# 00 — Overview

## What this pack is

A **file-by-file** inventory of the Binary Capital CRM codebase. Use the Excel workbook for filtering/sorting; use the markdown files for readable narrative per area.

## Architecture snapshot

```
docs/ + research/     → product & compliance specs
app/src/features/     → domain engines + server actions + queries
app/src/app/          → Next.js App Router pages (UI)
app/src/db/           → Drizzle schema, RLS, seeds
app/src/lib/          → auth + RBAC
app/src/components/   → brand + shadcn UI
app/drizzle/          → SQL migrations
app/src/__tests__/    → pure unit tests
```

## Counts by layer

| Layer | Files | LOC |
|---|---:|---:|
| routes | 160 | 55,607 |
| features | 105 | 34,291 |
| database | 41 | 29,619 |
| other | 7 | 10,259 |
| ui | 37 | 6,334 |
| tests | 14 | 4,802 |
| docs | 12 | 4,633 |
| tooling | 13 | 2,338 |
| research | 2 | 1,007 |
| config | 12 | 463 |
| platform | 6 | 457 |
| legacy | 4 | 203 |
| **TOTAL** | **413** | **150,013** |

## Criticality legend

| Level | Meaning |
|---|---|
| critical | Security, schema, migrations, auth/RLS — break these and the system fails compliance or data integrity |
| high | Core domain engines, main routes, primary queries/actions |
| medium | UI, secondary routes, supporting feature code |
| supporting | Docs, tests, tooling, research |

## Maturity legend

| Value | Meaning |
|---|---|
| implemented | Production-shaped application code |
| implemented+TODO | Implemented but contains TODO/FIXME markers |
| partial | Explicitly mock/stub/partial |
| migrated | SQL migration present |
| tested | Unit test file |
| documentation | Spec / research / readme |
| supporting | Config or misc |

## How files relate

1. **Spec** in `docs/*.md` defines entity/engine behavior.
2. **Schema** in `src/db/schema/*` materializes tables/enums.
3. **Feature engines** in `src/features/*/…` implement pure math or workflows.
4. **queries.ts / actions.ts** load and mutate via Drizzle + RLS context.
5. **page.tsx** under `src/app/` composes UI and calls features.
6. **Tests** under `src/__tests__/` lock pure engines.
