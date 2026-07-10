# Platform completion notes (non-UI)

This document tracks backend / domain / security work done so the product is
**advanced and complete under the glass**, while the **frontend UI/UX redesign**
remains a separate future effort.

## Completed in this pass

| Area | What changed |
|------|----------------|
| Money | `src/lib/money.ts` — crore ↔ INR canonical helpers |
| MFA at rest | `src/lib/crypto-secrets.ts` + auth decrypt path |
| Document storage | `src/lib/storage.ts` + real file upload in documents actions |
| RLS runners | `src/lib/rls-user.ts` — no ghost `randomUUID()` actors |
| Ownership | `src/lib/scope.ts` + deal detail SQL uses real party columns |
| Audit writes | `src/lib/audit-write.ts` — export, import, matching, committee, docs |
| Screening | Advanced PEP/sanctions rule engine (`compliance/screening.ts`) |
| Credit committee | Pure state machine (`credit/committee.ts`) wired into actions |
| Integrations RBAC | `integration:run` / `integration:live` required |
| Matching | Proper RLS user, permissions, audit, deal revalidate path |
| Notifications | `notification_dismissal` table + dual cookie/DB dismissals |
| Import script | Requires `IMPORT_ACTOR_USER_ID` + audit log |
| CSV export | Audited super_admin exports |
| RBAC matrix | Expanded implicit grants (credit, matching, compliance, …) |
| Tests | `platformComplete.test.ts` + updated KYC screening tests |

## Migration to apply

```bash
# From app/
psql "$DATABASE_URL" -f drizzle/0012_notification_dismissal.sql
# or your migrate pipeline once journal is updated
```

## Env vars (production)

| Variable | Purpose |
|----------|---------|
| `AUTH_SECRET` / `MFA_ENCRYPTION_KEY` | MFA secret encryption |
| `DOCUMENT_STORAGE_DIR` | Local document root (default `.data/documents`) |
| `IMPORT_ACTOR_USER_ID` | Required for party CSV import |
| `SANCTIONS_WATCHLIST` / `PEP_WATCHLIST` | Optional extra screening names |
| `USE_MOCK_INTEGRATIONS` | Keep mock until credentials ready |

## Intentionally deferred (UI redesign / later)

- Full visual redesign of all pages (your planned F4-style UX rebuild)
- External licensed sanctions/PEP provider HTTP client
- S3/R2 adapter (storage interface is ready; local FS is default)
- Database-session Auth.js strategy + Redis revocation
- Full fail-closed RLS on every read path (helpers exist; migrate policies carefully)

## How to verify

```bash
cd bc-crm/app
npx vitest run src/__tests__/platformComplete.test.ts src/__tests__/kyc.test.ts
```
