# 04 — UI Components

Brand design-system primitives (double-bezel, money, tables) plus shadcn/ui bases and app shell (nav, theme, notifications).

## File inventory

_37 files · 6,334 lines_

### Domain: `app-shell`

PRD: **Cross-cutting / Supporting**

#### `app/src/components/notification-bell.tsx`

| Field | Value |
|---|---|
| Role | `shell-component` — App chrome (nav, theme, notifications) |
| LOC | 326 |
| Runtime | client |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | NotificationBell |
| Has TODO | N |
| Purpose | Exports: NotificationBell |

#### `app/src/components/site-nav.tsx`

| Field | Value |
|---|---|
| Role | `shell-component` — App chrome (nav, theme, notifications) |
| LOC | 885 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | SiteNav |
| Has TODO | N |
| Purpose | Exports: SiteNav |

#### `app/src/components/theme-provider.tsx`

| Field | Value |
|---|---|
| Role | `shell-component` — App chrome (nav, theme, notifications) |
| LOC | 11 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | ThemeProvider |
| Has TODO | N |
| Purpose | Exports: ThemeProvider |

### Domain: `brand-system`

PRD: **Design System**

#### `app/src/components/brand/badge.tsx`

| Field | Value |
|---|---|
| Role | `brand-component` — Binary CRM brand design-system component |
| LOC | 198 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (3) | BadgeProps, ActionType, ActionBadgeProps |
| Has TODO | N |
| Purpose | Exports: BadgeProps, ActionType, ActionBadgeProps |

#### `app/src/components/brand/button.tsx`

| Field | Value |
|---|---|
| Role | `brand-component` — Binary CRM brand design-system component |
| LOC | 175 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | ButtonProps |
| Has TODO | N |
| Purpose | Exports: ButtonProps |

#### `app/src/components/brand/card.tsx`

| Field | Value |
|---|---|
| Role | `brand-component` — Binary CRM brand design-system component |
| LOC | 189 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Binary CRM brand design-system component |

#### `app/src/components/brand/chart-theme.tsx`

| Field | Value |
|---|---|
| Role | `brand-component` — Binary CRM brand design-system component |
| LOC | 258 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (15) | CHART_GRID_STROKE, CHART_AXIS_TICK, CHART_STROKE_WIDTH, CHART_EASE, CHART_GRID_PROPS, CHART_XAXIS_PROPS, CHART_YAXIS_PROPS, CHART_CURSOR |
| Has TODO | N |
| Purpose | Exports: CHART_GRID_STROKE, CHART_AXIS_TICK, CHART_STROKE_WIDTH, CHART_EASE, CHART_GRID_PROPS, CHART_XAXIS_PROPS, CHART_YAXIS_PROPS, CHART_CURSOR, CHART_SERIES, CHART_ACTIVE_DOT, ChartAreaGradient, ChartStrokeGradient… |

#### `app/src/components/brand/command-bar.tsx`

| Field | Value |
|---|---|
| Role | `brand-component` — Binary CRM brand design-system component |
| LOC | 231 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | CommandBarProps, CommandBar |
| Has TODO | N |
| Purpose | Exports: CommandBarProps, CommandBar |

#### `app/src/components/brand/empty-state.tsx`

| Field | Value |
|---|---|
| Role | `brand-component` — Binary CRM brand design-system component |
| LOC | 141 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | EmptyStateProps, CellEmptyProps |
| Has TODO | N |
| Purpose | Exports: EmptyStateProps, CellEmptyProps |

#### `app/src/components/brand/icon-language.tsx`

| Field | Value |
|---|---|
| Role | `brand-component` — Binary CRM brand design-system component |
| LOC | 452 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (15) | IconTone, IconSize, IconTileProps, IconTile, MarkProps, BinaryBMark, BondCouponMark, RatingLadderMark |
| Has TODO | N |
| Purpose | Exports: IconTone, IconSize, IconTileProps, IconTile, MarkProps, BinaryBMark, BondCouponMark, RatingLadderMark, ExposureGaugeMark, MandateMark, KycShieldMark, GSecRupeeMark… |

#### `app/src/components/brand/icons.tsx`

| Field | Value |
|---|---|
| Role | `brand-component` — Binary CRM brand design-system component |
| LOC | 184 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Binary CRM brand design-system component |

#### `app/src/components/brand/index.ts`

| Field | Value |
|---|---|
| Role | `brand-component` — Binary CRM brand design-system component |
| LOC | 136 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Brand primitives - the elevated view-layer building blocks screen agents compose into the wow screens. Bespoke double-bezel + motion treatment that coexists with the untouched shadcn ui/* internals. |

#### `app/src/components/brand/input.tsx`

| Field | Value |
|---|---|
| Role | `brand-component` — Binary CRM brand design-system component |
| LOC | 81 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Binary CRM brand design-system component |

#### `app/src/components/brand/money.tsx`

| Field | Value |
|---|---|
| Role | `brand-component` — Binary CRM brand design-system component |
| LOC | 176 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (8) | MoneyOptions, formatMoney, compactINR, FormatPreset, FORMAT_PRESETS, MoneyProps, Money, Num |
| Has TODO | N |
| Purpose | Exports: MoneyOptions, formatMoney, compactINR, FormatPreset, FORMAT_PRESETS, MoneyProps, Money, Num |

#### `app/src/components/brand/page-transition.tsx`

| Field | Value |
|---|---|
| Role | `brand-component` — Binary CRM brand design-system component |
| LOC | 58 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | PageTransition |
| Has TODO | N |
| Purpose | Exports: PageTransition |

#### `app/src/components/brand/preview-pane.tsx`

| Field | Value |
|---|---|
| Role | `brand-component` — Binary CRM brand design-system component |
| LOC | 137 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | PreviewPaneProps, PreviewPane |
| Has TODO | N |
| Purpose | Exports: PreviewPaneProps, PreviewPane |

#### `app/src/components/brand/reveal.tsx`

| Field | Value |
|---|---|
| Role | `brand-component` — Binary CRM brand design-system component |
| LOC | 119 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (6) | RevealProps, Reveal, staggerContainer, staggerItem, Stagger, StaggerItem |
| Has TODO | N |
| Purpose | Exports: RevealProps, Reveal, staggerContainer, staggerItem, Stagger, StaggerItem |

#### `app/src/components/brand/score-ring.tsx`

| Field | Value |
|---|---|
| Role | `brand-component` — Binary CRM brand design-system component |
| LOC | 183 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | ScoreRingProps, ScoreRing |
| Has TODO | N |
| Purpose | Exports: ScoreRingProps, ScoreRing |

#### `app/src/components/brand/select.tsx`

| Field | Value |
|---|---|
| Role | `brand-component` — Binary CRM brand design-system component |
| LOC | 238 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Binary CRM brand design-system component |

#### `app/src/components/brand/skeleton.tsx`

| Field | Value |
|---|---|
| Role | `brand-component` — Binary CRM brand design-system component |
| LOC | 222 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (4) | Skeleton, SkeletonCard, SkeletonBoard, SkeletonPage |
| Has TODO | N |
| Purpose | Exports: Skeleton, SkeletonCard, SkeletonBoard, SkeletonPage |

#### `app/src/components/brand/stat-card.tsx`

| Field | Value |
|---|---|
| Role | `brand-component` — Binary CRM brand design-system component |
| LOC | 192 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | StatCardProps, StatCard |
| Has TODO | N |
| Purpose | Exports: StatCardProps, StatCard |

#### `app/src/components/brand/table.tsx`

| Field | Value |
|---|---|
| Role | `brand-component` — Binary CRM brand design-system component |
| LOC | 260 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Binary CRM brand design-system component |

#### `app/src/components/brand/tabs.tsx`

| Field | Value |
|---|---|
| Role | `brand-component` — Binary CRM brand design-system component |
| LOC | 83 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Binary CRM brand design-system component |

#### `app/src/components/brand/text.tsx`

| Field | Value |
|---|---|
| Role | `brand-component` — Binary CRM brand design-system component |
| LOC | 107 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | Eyebrow, SectionHeading |
| Has TODO | N |
| Purpose | Exports: Eyebrow, SectionHeading |

### Domain: `shadcn`

PRD: **Design System**

#### `app/src/components/ui/badge.tsx`

| Field | Value |
|---|---|
| Role | `ui-primitive` — shadcn/ui base primitive |
| LOC | 52 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | shadcn/ui base primitive |

#### `app/src/components/ui/button.tsx`

| Field | Value |
|---|---|
| Role | `ui-primitive` — shadcn/ui base primitive |
| LOC | 58 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | shadcn/ui base primitive |

#### `app/src/components/ui/card.tsx`

| Field | Value |
|---|---|
| Role | `ui-primitive` — shadcn/ui base primitive |
| LOC | 103 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | shadcn/ui base primitive |

#### `app/src/components/ui/dialog.tsx`

| Field | Value |
|---|---|
| Role | `ui-primitive` — shadcn/ui base primitive |
| LOC | 160 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | shadcn/ui base primitive |

#### `app/src/components/ui/dropdown-menu.tsx`

| Field | Value |
|---|---|
| Role | `ui-primitive` — shadcn/ui base primitive |
| LOC | 268 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | shadcn/ui base primitive |

#### `app/src/components/ui/input.tsx`

| Field | Value |
|---|---|
| Role | `ui-primitive` — shadcn/ui base primitive |
| LOC | 20 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | shadcn/ui base primitive |

#### `app/src/components/ui/label.tsx`

| Field | Value |
|---|---|
| Role | `ui-primitive` — shadcn/ui base primitive |
| LOC | 20 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | shadcn/ui base primitive |

#### `app/src/components/ui/select.tsx`

| Field | Value |
|---|---|
| Role | `ui-primitive` — shadcn/ui base primitive |
| LOC | 201 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | shadcn/ui base primitive |

#### `app/src/components/ui/separator.tsx`

| Field | Value |
|---|---|
| Role | `ui-primitive` — shadcn/ui base primitive |
| LOC | 25 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | shadcn/ui base primitive |

#### `app/src/components/ui/sheet.tsx`

| Field | Value |
|---|---|
| Role | `ui-primitive` — shadcn/ui base primitive |
| LOC | 138 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | shadcn/ui base primitive |

#### `app/src/components/ui/sonner.tsx`

| Field | Value |
|---|---|
| Role | `ui-primitive` — shadcn/ui base primitive |
| LOC | 49 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | shadcn/ui base primitive |

#### `app/src/components/ui/table.tsx`

| Field | Value |
|---|---|
| Role | `ui-primitive` — shadcn/ui base primitive |
| LOC | 116 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | shadcn/ui base primitive |

#### `app/src/components/ui/tabs.tsx`

| Field | Value |
|---|---|
| Role | `ui-primitive` — shadcn/ui base primitive |
| LOC | 82 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | shadcn/ui base primitive |
