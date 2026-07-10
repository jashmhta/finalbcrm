# Agent 056 — File-by-file analysis

**Batch:** `batch-056.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope:** Page shell, page transition, preview pane, reveal motion.

---

## 1. `src/components/brand/page-shell.tsx`

| Field | Value |
|--------|--------|
| **Role** | Uniform authenticated page chrome |

### Exports + signatures

```ts
export function PageShell({ children, className, wide? }) // max-w 1280 / 1600
export function PageHeader({ title, description?, action?, className? })
export function DetailTopBar({ backHref, backLabel, crumb?, action? })
export function KpiStrip({ items: { label, value, hint? }[] })
```

### Business purpose

Stripe/Linear density: consistent gutters, header band, back crumb for details, compact KPI strip for home.

### Coupling

Nearly every app route.

### Risks

1. Nested PageShell when layouts + pages both wrap (portfolio).
2. DetailTopBar uses next/link internally (must remain server-importable — check for client-only).

---

## 2. `src/components/brand/page-transition.tsx`

| Field | Value |
|--------|--------|
| **Role** | Route transition wrapper (framer-motion) |

### Business purpose

Optional animated page enter/exit for shell content.

### Risks

1. Conflict with `prefers-reduced-motion`.
2. May delay LCP if opacity-0 initial (app comments elsewhere ban whileInView opacity-0 on primary content).

---

## 3. `src/components/brand/preview-pane.tsx`

| Field | Value |
|--------|--------|
| **Role** | Sticky right-hand inspector for list explorers |

### Exports

```ts
export interface PreviewPaneProps {
  type?: React.ReactNode;
  name: React.ReactNode;
  mark?: React.ReactNode;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  sticky?: boolean;
  className?: string;
}
export function PreviewPane(props: PreviewPaneProps)
```

### Business purpose

Parties explorer + portal identity headers; double-bezel identity card with body slot.

### Risks

1. sticky on short screens overlaps footer.
2. Server-safe slots as ReactNode — good for RSC composition when pane itself is client or server.

---

## 4. `src/components/brand/reveal.tsx`

| Field | Value |
|--------|--------|
| **Directive** | client (framer-motion) |
| **Role** | Mount / scroll reveal animations |

### Exports

```ts
Reveal, Stagger, StaggerItem, staggerContainer, staggerItem
```

### Business purpose

Staggered section entrance (y translate, optional blur). Pages pass `noBlur` and short y for above-the-fold visibility rules.

### Risks

1. If initial opacity 0 without animate, screenshot tests fail — many call sites use `noBlur` + animate on mount.
2. Prefer reduced motion not always respected.

---

## Cross-file summary (batch 056)

Layout primitives every route depends on. Nested shell and motion visibility rules are main operational risks.

---

*End of agent-056 analysis.*
