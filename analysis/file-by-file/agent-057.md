# Agent 057 — File-by-file analysis

**Batch:** `batch-057.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope:** Score ring, select, skeleton, stat card.

---

## 1. `src/components/brand/score-ring.tsx`

| Field | Value |
|--------|--------|
| **Role** | Circular score visualization (credit scorecard, etc.) |

### Exports

```ts
export interface ScoreRingProps { value, max?, size?, tone?, label?, ... }
export function ScoreRing(...)
```

### Business purpose

Machined progress ring for 0–100 style scores with mono center number.

### Risks

SVG a11y (need aria labels); server-safe preferred.

---

## 2. `src/components/brand/select.tsx`

| Field | Value |
|--------|--------|
| **Role** | Brand Select built on accessible primitive |

### Exports

Select, SelectContent, SelectGroup, SelectItem, SelectLabel, Scroll buttons, Separator, Trigger, Value.

### Business purpose

Drop-in for shadcn select with double-bezel trigger language.

### Risks

1. Many forms still use native BezelSelect — dual systems.
2. Portal/hydration quirks with base-ui.

---

## 3. `src/components/brand/skeleton.tsx`

| Field | Value |
|--------|--------|
| **Role** | Loading placeholders |

### Exports

```ts
Skeleton, SkeletonCard, SkeletonBoard, SkeletonPage
```

### Business purpose

Gold-tinted shimmer language; route loaders compose SkeletonPage with eyebrow/title/cards.

### Risks

Layout mismatch vs real page (generic cards=4).

---

## 4. `src/components/brand/stat-card.tsx`

| Field | Value |
|--------|--------|
| **Role** | KPI tile with optional count-up |

### Exports

```ts
export interface StatCardProps {
  label: string;
  value: number;
  display?: string;       // static override
  preset?: "int" | "currency" | "percent1" | "decimal1" | ...
  format?: (n: number) => string; // client-only path
  prefix?, suffix?, tone?, icon?, children?
}
export function StatCard(...)
```

### Business purpose

RSC-safe presets for server pages; client format functions for custom units (DV01, duration). Count-up on mount for polish.

### Risks

1. format prop cannot cross RSC→client boundary — pages must nest StatCard in client parent when using format.
2. preset currency assumes rupees scale.
3. tone tokens (up/down/gold) for risk signals.

---

## Cross-file summary (batch 057)

KPI and loading primitives. StatCard unit/format rules are a frequent footgun for report/portfolio pages.

---

*End of agent-057 analysis.*
