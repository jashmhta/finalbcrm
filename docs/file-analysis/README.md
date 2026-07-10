# Binary Capital CRM — File-by-File Analysis Index

**Companion Excel:** [`BC_CRM_File_by_File_Analysis.xlsx`](./BC_CRM_File_by_File_Analysis.xlsx)

This folder documents every source/config/spec file in the repo (media binaries and `node_modules` excluded).

## Contents

| Document | Scope |
|---|---|
| [00-overview.md](./00-overview.md) | Inventory totals, architecture map, how to read this pack |
| [01-features.md](./01-features.md) | `app/src/features/*` — domain logic file-by-file |
| [02-routes.md](./02-routes.md) | `app/src/app/*` — pages & route components |
| [03-database.md](./03-database.md) | Schema, migrations, RLS, seed |
| [04-ui-components.md](./04-ui-components.md) | Brand system, shadcn, shell |
| [05-platform-config.md](./05-platform-config.md) | Auth, RBAC, proxy, configs |
| [06-tests-tooling.md](./06-tests-tooling.md) | Vitest suites & scripts |
| [07-docs-research.md](./07-docs-research.md) | Product specs & research |
| [BC_CRM_File_by_File_Analysis.xlsx](./BC_CRM_File_by_File_Analysis.xlsx) | Full spreadsheet (filterable) |

## Quick stats

- **Files catalogued:** 413
- **Total lines:** 150,013
- **Primary app:** Next.js 16 + Drizzle + Auth.js v5 + Postgres RLS
- **Product:** Two-sided capital-markets CRM for Binary Capital / Binary Bonds
