# Agent 054 — File-by-file analysis

**Batch:** `batch-054.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope:** Brand chart-theme, command-bar, empty-state, icon-language.

---

## 1. `src/components/brand/chart-theme.tsx`

| Field | Value |
|--------|--------|
| **Directive** | `"use client"` (tooltips/motion-ish) |
| **Role** | Single source of recharts styling |

### Exports (high value)

```ts
CHART_GRID_STROKE, CHART_AXIS_TICK, CHART_STROKE_WIDTH, CHART_EASE
CHART_GRID_PROPS, CHART_XAXIS_PROPS, CHART_YAXIS_PROPS, CHART_CURSOR
CHART_SERIES, CHART_ACTIVE_DOT
ChartAreaGradient, ChartStrokeGradient, ChartTooltip, ChartCard
```

### Business purpose

DESIGN_SYSTEM §11: hairline dashed grids, mono axes, emerald/gold series, double-bezel tooltips, ChartCard shell for titles/descriptions/ambient.

### Coupling

Used by dashboard, portfolio, reports, portal charts.

### Risks

1. Client boundary may force chart pages to client even for constants — usually imported from client chart impls only.
2. Ambient ChartCard option must match Card ambient deprecation.

---

## 2. `src/components/brand/command-bar.tsx`

| Field | Value |
|--------|--------|
| **Role** | Sticky list toolbar: search + filters + density + actions |

### Exports

```ts
export interface CommandBarProps {
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  label?: React.ReactNode;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  density?: Density;
  onDensityChange?: (d: Density) => void;
  sticky?: boolean;
  // ...
}
export function CommandBar(props: CommandBarProps)
```

### Business purpose

Shared chrome for parties explorer, tasks, documents, credit report, etc. — consistent desk blotter UX.

### Side effects

None (controlled inputs).

### Risks

1. Sticky + backdrop can obscure content on short viewports.
2. Must remain keyboard accessible (search input labeling).

---

## 3. `src/components/brand/empty-state.tsx`

| Field | Value |
|--------|--------|
| **Role** | Designed empty / awaiting-input surfaces |

### Exports

```ts
export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  tone?: "default" | "gold" | ...
  align?: "center" | "left"
  className?: string
}
export function EmptyState(...)
export function CellEmpty({ label?: string }) // inline table placeholder vs bare "-"
```

### Business purpose

Replace blank tables with intentional empty language; CellEmpty for sparse numeric cells.

### Risks

None critical; copy quality is product voice dependent.

---

## 4. `src/components/brand/icon-language.tsx`

| Field | Value |
|--------|--------|
| **Role** | Bespoke MARKS + IconTile + ICON map |

### Exports

```ts
IconTile, BinaryBMark, BondCouponMark, RatingLadderMark,
ExposureGaugeMark, MandateMark, KycShieldMark, GSecRupeeMark, ICON
types: IconTone, IconSize, IconTileProps, MarkProps, IconKey, ...
```

### Business purpose

CRM’s own icon vocabulary distinct from stock Phosphor; IconTile hairline disc wells at 16/20/24 in neutral|emerald|gold|down tones.

### Coupling

PartyAvatar, credit icons, detail headers.

### Risks

1. SVG marks must stay lightweight for lists of 25+.
2. Tone tokens must match CSS variables.

---

## Cross-file summary (batch 054)

Design-system mid-layer: charts, toolbars, empty states, iconography. No DB/auth.

### Highest-priority risks

1. chart-theme client boundary contagion.
2. Sticky CommandBar a11y/overflow.

---

*End of agent-054 analysis.*
