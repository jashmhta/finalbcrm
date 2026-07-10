
# Batch 046

## `src/app/portfolio/_components/edit-limit-dialog.tsx`

- **Lines:** 321 | **Bytes:** 11231
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** EditLimitDialog
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, react
- **Internal imports (6):** @/lib/utils, @/components/brand, @/components/ui/dialog, @/features/reports/export, @/features/portfolio, @/features/portfolio/actions

## `src/app/portfolio/_components/limits-view.tsx`

- **Lines:** 482 | **Bytes:** 17790
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** LimitsView
- **Exported types:** LimitsViewProps
- **DB ops patterns:** delete
- **Security signals:** rbac/rls, india-compliance
- **External deps:** @phosphor-icons/react, next/link, next/navigation, react
- **Internal imports (8):** @/lib/utils, @/components/brand, @/components/brand, @/components/brand/chart-theme, @/components/brand, @/features/reports/export, @/features/portfolio, ./edit-limit-dialog
- **Domain terms:** Issuer, issuer, underwriting

## `src/app/portfolio/_components/overview-view.tsx`

- **Lines:** 580 | **Bytes:** 20113
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** OverviewView
- **Exported types:** OverviewViewProps
- **Security signals:** india-compliance
- **External deps:** @phosphor-icons/react, next/link, react
- **Internal imports (7):** @/lib/utils, @/components/brand, @/components/brand, @/components/brand/chart-theme, @/features/reports/export, @/features/portfolio, ./portfolio-charts
- **Domain terms:** issuer

## `src/app/portfolio/_components/portfolio-charts-impl.tsx`

- **Lines:** 543 | **Bytes:** 15789
- **Kind:** Client component
- **Directive:** `use client`
- **Exported functions:** DonutChart, HBarChart, StackedBarChart, VBarChart, RadialGauge
- **Exported const:** SECTOR_PALETTE, EXPOSURE_TYPE_COLORS, EXPOSURE_TYPE_LABELS
- **Exported types:** DonutPoint, LabelValuePoint, StackedPoint, GaugePoint
- **External deps:** react, recharts
- **Internal imports (1):** @/components/brand/chart-theme
- **Domain terms:** Underwriting
