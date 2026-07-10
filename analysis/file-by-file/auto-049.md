
# Batch 049

## `src/app/portfolio/risk-metrics/page.tsx`

- **Lines:** 28 | **Bytes:** 1098
- **Kind:** Next.js page route
- **Exported const:** dynamic
- **Default export:** yes
- **Security signals:** auth
- **Internal imports (4):** @/lib/rbac, @/components/brand, @/features/portfolio, ../_components/risk-metrics-view

## `src/app/reports/_components/credit-report-view.tsx`

- **Lines:** 522 | **Bytes:** 19454
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** CreditReportView
- **Exported types:** CreditReportViewProps
- **DB ops patterns:** delete
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, next/link, next/navigation, react
- **Internal imports (6):** @/components/brand/text, @/lib/utils, @/features/reports/queries, @/features/reports/export, @/components/brand, @/components/brand
- **Domain terms:** Issuer, issuer, scorecard

## `src/app/reports/_components/report-charts-impl.tsx`

- **Lines:** 401 | **Bytes:** 12995
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** CountBarChart, HorizontalBarChart, AreaTrendChart, StackedBarChart
- **Exported types:** LabelCountPoint, LabelValuePoint, ConsentStackPoint
- **Security signals:** india-compliance
- **External deps:** react, recharts
- **Internal imports (2):** @/components/brand/chart-theme, @/features/reports/export
- **Domain terms:** KYC

## `src/app/reports/_components/report-charts.tsx`

- **Lines:** 63 | **Bytes:** 2558
- **Kind:** Client component
- **Directive:** `use client`
- **Exported const:** CountBarChart, HorizontalBarChart, AreaTrendChart, StackedBarChart
- **External deps:** next/dynamic
- **Internal imports (1):** ./report-charts-impl
