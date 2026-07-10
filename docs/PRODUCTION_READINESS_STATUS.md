# Production readiness status

Last updated: 2026-07-08 (implementation pass)

## Green (code-ready)

| Area | Status |
|---|---|
| Stripe-level day UI (tokens, cards, buttons, login, shell) | Done |
| Calendar (`/calendar`) + notifications link | Done |
| Org roster seed (Shray, Shahrukh, Rati, Niraj, Yash, Pranjali, Tashmit) | `npx tsx src/db/seed-org-users.ts` |
| Super-admin-only CSV export | Done |
| Brand-scoped party visibility (Capital / Bonds / shared) | Done (desk → brand) |
| Assign party to staff + follow-up task | Done on party detail |
| Credit inactive for employees (nav + route guard) | Done |
| Employee RBAC book scope (assigned only) | Done |
| Typecheck | Clean |
| Unit tests (RBAC + org) | Passing |

## Runbook before go-live

```bash
cd app
# 1. Migrations
npx drizzle-kit migrate   # or your deploy migrate step

# 2. Org users
npx tsx src/db/seed-org-users.ts

# 3. Optional scale seed / party import
# npx tsx src/db/seed.ts
# npx tsx src/scripts/import-parties.ts ...

# 4. Env (production)
# DATABASE_URL=...          # must use crm_app role for RLS
# AUTH_SECRET=...
# AUTH_URL=https://crm...
# USE_MOCK_INTEGRATIONS=false  # when real keys present
# CREDIT_ANALYSIS_ACTIVE=true  # only if credit should open to all staff
# NEXT_PUBLIC_CREDIT_ANALYSIS_ACTIVE=true  # must match for client nav
# SEED_ORG_PASSWORD=...     # rotate default BinaryCrm!2026
```

## Client-gated (not code)

- Real SEBI/RBI registrations & counsel residency path
- Real integration credentials (KRA, MCA, BSE/NSE, …)
- Real 50k / 10k data files + assignment
- MFA enrollment for all production users
- Production DSN = non-BYPASSRLS `crm_app` role
- Password rotation after seed

## User matrix

| User | Brand | Export | Book |
|---|---|---|---|
| Shray | shared (both) | Yes | All |
| Shahrukh | Capital | Yes | Capital + shared parties |
| Rati | Bonds | Yes | Bonds + shared parties |
| Niraj | Bonds | Yes | Bonds + shared parties |
| Yash | Capital employee | No | Assigned only |
| Pranjali | Capital employee | No | Assigned only |
| Tashmit | Bonds employee | No | Assigned only |

## Remaining polish (optional)

- Brand-scoped super export row filter already inherits party list visibility
- Dashboard page shell fully on `bc-page` (partial; design tokens apply globally)
- Playwright e2e smoke for login → parties → assign → calendar
- Field encryption for PAN (architecture TODO)
