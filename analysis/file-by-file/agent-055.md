# Agent 055 — File-by-file analysis

**Batch:** `batch-055.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope:** Brand icons boundary, barrel index, input, money.

---

## 1. `src/components/brand/icons.tsx`

| Field | Value |
|--------|--------|
| **Directive** | `"use client"` |
| **Role** | Phosphor re-export client boundary |

### Business purpose

Centralize Phosphor imports so **server components import icons only from this module**, keeping phosphor package behind client boundary. Re-exports commonly used Light icons for CRM screens.

### Exports

Named Phosphor icons used across app (ArrowLeft, Buildings, ShieldCheck, …).

### Risks

1. Missing icon forces direct `@phosphor-icons/react` import in some clients (parties explorer SquaresFour).
2. Entire icons module client — tree-shaking depends on named exports.

---

## 2. `src/components/brand/index.ts`

| Field | Value |
|--------|--------|
| **Lines** | ~138 |
| **Role** | Public brand API barrel |

### Re-exports

Card/Button/Table/Badge/EmptyState/text/page-shell/skeleton/StatCard/ScoreRing/Money/CommandBar/Reveal/Input/Select/Tabs/chart-theme/icon-language/PreviewPane.

### Business purpose

Single import path `@/components/brand` for screen agents.

### Risks

1. Barrel may pull unexpected client modules if mis-imported from server (Next may still split).
2. Dual PageHeader export: text.PageHeader vs page-shell ProductPageHeader alias.

---

## 3. `src/components/brand/input.tsx`

| Field | Value |
|--------|--------|
| **Role** | Double-bezel form Input / InputGroup |

### Exports

```ts
export function Input(...)
export function InputGroup(...)
```

### Business purpose

Prefer brand Input over shadcn ui/input so fields match Card enclosure system.

### Risks

1. Not all dialogs migrated (many still use local BezelInput).
2. Must keep focus rings accessible.

---

## 4. `src/components/brand/money.tsx`

| Field | Value |
|--------|--------|
| **Role** | Financial number formatting (server-safe) |

### Exports + signatures

```ts
export interface MoneyOptions { currency?, locale?, min/maxFractionDigits?, notation? }
export function formatMoney(value, options?): string
export function compactINR(value, { signed? }?): string  // ₹x Cr / L / K
export function Money({ value, compact?, className?, ... })
export function Num({ value, format?, className? })
// + serializable format presets for StatCard
```

### Business purpose

Tabular mono money everywhere; Indian compact scale (1e7 Cr, 1e5 L).

### Key logic

compactINR thresholds; null → "-"; signed optional.

### Risks

1. **Unit discipline** — callers must pass rupees to compactINR; crore values need ×1e7 or use compactCr from reports.
2. formatMoney default INR en-IN.

---

## Cross-file summary (batch 055)

Icons + barrel + forms + money are foundational. Money unit bugs are a recurring cross-route risk.

---

*End of agent-055 analysis.*
