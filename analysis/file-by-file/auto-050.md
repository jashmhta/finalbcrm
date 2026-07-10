
# Batch 050

## `src/app/reports/_components/reports-hub-view.tsx`

- **Lines:** 193 | **Bytes:** 6657
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** ReportsHubView
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, framer-motion, next/link, react
- **Internal imports (5):** @/components/brand/text, @/lib/utils, @/components/brand/card, @/features/reports/export, @/features/reports/queries
- **Domain terms:** Investor, KYC, investor, issuer, kyc, mandate, matching, scorecard

## `src/app/reports/compliance/page.tsx`

- **Lines:** 320 | **Bytes:** 12354
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth, india-compliance
- **Internal imports (8):** @/lib/rbac, @/features/reports/queries, @/features/reports, @/components/brand, @/components/brand/chart-theme, @/components/brand/money, ../_components/report-charts, @/components/brand/page-shell
- **Domain terms:** KYC, kyc

## `src/app/reports/credit/page.tsx`

- **Lines:** 126 | **Bytes:** 4082
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **Internal imports (9):** @/lib/rbac, @/features/reports/queries, @/features/reports, @/components/brand, @/components/brand/chart-theme, @/features/reports/export, ../_components/report-charts, ../_components/credit-report-view, @/components/brand/page-shell
- **Domain terms:** BC-1, BC-6, Scorecard, issuer, scorecard

## `src/app/reports/export/route.ts`

- **Lines:** 391 | **Bytes:** 15263
- **Kind:** API route handler
- **Header intent:** Reports & Export - CSV export Route Handler.  GET /reports/export?type=<kind>[&<filter params...>] runs the matching query (reusing the feature `list*` queries for per-module exports so the CSV always matches the on-screen filtered list) and returns an RFC 4180 CSV attachment. The browser handles the download natively via the `Content-Disposition: attachment` header - no client-side blob code, no function props crossing the RSC boundary. The on-page "Export CSV" buttons are plain anchors to this
- **Exported functions:** GET
- **Exported const:** dynamic
- **Exported types:** ExportKind
- **Security signals:** auth, rbac/rls, india-compliance
- **Internal imports (11):** @/lib/rbac, @/features/parties/queries, @/features/deals/queries, @/features/credit/queries, @/features/compliance/queries, @/features/interactions/queries, @/features/tasks/queries, @/features/documents/queries, @/features/reports/queries, @/features/reports/export, @/features/reports/exportAccess
- **Domain terms:** Issuer, KYC, Party, kyc, matching, party
