
# Batch 011

## `src/__tests__/rbacSegmentation.test.ts`

- **Lines:** 245 | **Bytes:** 10523
- **Kind:** Vitest unit test
- **Security signals:** auth, rbac/rls, india-compliance
- **External deps:** vitest
- **Internal imports (4):** @/lib/rbac-core, @/features/reports/exportAccess, @/lib/org, @/features/parties/segmentation
- **Domain terms:** KYC, binarybonds, binarycapital, investor, kyc, matching, onboarding, party

## `src/__tests__/reports.test.ts`

- **Lines:** 251 | **Bytes:** 8250
- **Kind:** Vitest unit test
- **Header intent:** Reports & Export - pure-utility unit tests.  Covers the CSV builder (rowsToCsv: RFC 4180 escaping, BOM, CRLF), the filename + Content-Disposition helpers, and the crore formatters + rating- tier map. These are pure functions (no DB, no Next), so they run in the node environment alongside the other engine tests. The route handler's query correctness is verified separately against the seeded DB (see the build + SQL smoke checks); this suite locks the serialization layer.
- **External deps:** vitest
- **Internal imports (2):** @/features/reports/export, @/features/reports/queries
- **TODOs/FIXMEs:** Cr below 1,000 cr", () => {
- **Domain terms:** BC-1

## `src/__tests__/routeSmoke.test.ts`

- **Lines:** 53 | **Bytes:** 2038
- **Kind:** Vitest unit test
- **Header intent:** Route smoke test - opt-in HTTP check against a running Next server.  This is intentionally NOT a next/test render (which would pull in a DOM testing library the deps agent hasn't installed). Instead it fetches the real routes and asserts the HTTP shape: /login is public (200), and /parties is gated by the proxy/auth layer (redirects to /login or returns 401/403 - never 200 with a parties payload to an unauthenticated caller).  Set SMOKE_BASE_URL (e.g. http://localhost:3000) to enable. Without it
- **Security signals:** rbac/rls
- **External deps:** vitest
- **Domain terms:** party

## `src/__tests__/scenarioAnalysis.test.ts`

- **Lines:** 188 | **Bytes:** 7030
- **Kind:** Vitest unit test
- **Header intent:** Scenario analysis engine - invariants verification. Source of truth: src/features/modeling/scenarioAnalysis.ts. Pins: - the registry exposes all five model types with coherent drivers - best ≥ base ≥ worst on the primary metric (corner-case ordering) - driver direction classification matches financial intuition - sensitivity grid shape + monotonicity per model
- **External deps:** vitest
- **Internal imports (1):** @/features/modeling/scenarioAnalysis
- **Domain terms:** bond
