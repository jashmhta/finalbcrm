# Agent 028 — File-by-file analysis

**Batch:** `batch-028.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope note:** Paths are relative to app root. Docs ignored per instructions. Related modules consulted only for coupling/context (not listed in batch).

---

## 1. `src/app/global-error.tsx`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/global-error.tsx` |
| **Lines** | 75 |
| **Role** | Next.js App Router **global error boundary** — last-resort UI when the **root layout** itself throws (Next 16). Replaces the entire root layout tree while active. |
| **Exports** | `export default function GlobalError` |
| **Imports** | `* as React` from `"react"`; side-effect `./globals.css` |

### Business purpose

Provides a calm, operator-safe recovery screen when the application shell (root layout) fails. Users are reassured that data is safe and offered a single “Try again” action (`reset()`). This is the ultimate UX safety net for Binary CRM — not a feature page, not a branded chrome surface.

### Exports / signatures (quoted)

```ts
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
})
```

- **Next.js contract:** Client component (`"use client"`). Props match the App Router `global-error` special file API: `error` (with optional Next `digest`) and `reset` (re-render attempt callback).
- **Default export only** — no named exports.

### Imports (detail)

| Import | Kind | Purpose |
|--------|------|---------|
| `react` | runtime | `useEffect` for operator-side logging |
| `./globals.css` | side-effect CSS | Must re-import styles because this boundary **replaces** the root layout (layout’s CSS import is bypassed) |

**Explicit non-imports (by design comment):** no brand components, no Phosphor icons — dependency-free so a failure inside the brand layer or icon client boundary cannot cascade into this fallback.

### Key logic

1. **`React.useEffect` on `[error]`** — logs `console.error("Global layout error:", error)` for operators/devtools only; never rendered to the user.
2. **Self-contained document** — renders full `<html lang="en">` + `<body>` because root layout is unmounted while this boundary is active.
3. **UI structure:**
   - Decorative `bg-mesh` full-viewport layer (`aria-hidden`, `pointer-events-none`, `-z-20`).
   - Centered column (`max-w-[640px]`): gold-tinted circle with inline SVG alert glyph (circle + exclamation stem), eyebrow “Something broke”, calm headline, reassurance copy, primary “Try again” button.
4. **Button:** `onClick={() => reset()}` — invokes Next’s reset without exposing error details.
5. **Copy never includes** `error.message`, `error.digest`, or stack — intentional information-hiding.

### Side effects

| Effect | When | Notes |
|--------|------|-------|
| `console.error(...)` | On mount / when `error` changes | Browser console only; not sent to a monitoring service from this file |
| Full document replace | When boundary activates | Replaces root layout HTML tree |
| CSS load | Module import | Pulls in entire design-token/stylesheet stack via `globals.css` |

No network, no cookies, no storage, no Server Actions, no DB.

### Security / RBAC

- **No auth / RBAC** — pure client error UI; available to any session that hits a root-layout crash.
- **Error disclosure control:** intentionally **does not** surface `error.message` / `error.digest` / stack to the DOM (comment: “operator-only”). Prevents leaking internal paths, env names, or stack frames to end users.
- **No user-controlled HTML** — static strings only; no `dangerouslySetInnerHTML`.
- **Caveat:** `console.error(error)` may still log sensitive error content to the operator browser console if the thrown error message contains secrets (depends on throwers upstream).

### Coupling

| Direction | Target |
|-----------|--------|
| **Depends on** | Next.js App Router `global-error` special file convention; Tailwind utility classes from `globals.css` tokens (`bg-background`, `text-gold`, `shadow-pill`, `ease-soft`, etc.) |
| **Coupled CSS** | `src/app/globals.css` (direct import) |
| **Peers** | Typically coexists with `src/app/error.tsx` (segment-level) and `src/app/layout.tsx` (root) — this file is only for **root layout** failures |
| **Does not couple to** | Brand kit (`@/components/brand/*`), Phosphor, integrations, features, DB |

### Risks / TODOs

1. **No remote error reporting** — only `console.error`; production incident capture (Sentry/etc.) is not wired here.
2. **“The desk has been notified”** copy may be aspirational if no notification pipeline exists — UX honesty risk.
3. **Token/class dependency on Tailwind** — if CSS fails to load entirely, page degrades to unstyled HTML (still functional).
4. **Inline SVG only** — good for isolation; if product later requires i18n, all strings are hardcoded English.
5. **No tests** visible in this module.

---

## 2. `src/app/globals.css`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/globals.css` |
| **Lines** | 367 |
| **Role** | **Global design system stylesheet** for Binary CRM — Tailwind v4 `@import`s, `@theme` token map, light (primary) + dark (parity) CSS variables, custom utilities, base layer typography/scrollbars, a11y motion/focus, page shell classes |
| **Exports** | N/A as JS module — CSS custom properties, `@utility` names, keyframes, and utility classes consumed app-wide |
| **Imports (CSS)** | `"tailwindcss"`; `"tw-animate-css"`; `"shadcn/tailwind.css"` |

### Business purpose

Implements Binary CRM’s **“Stripe-level day theme”**: cool neutrals, single indigo accent (token historically named `--gold` for class compatibility), hairline borders, soft elevation, dense product UI without mesh/grain/double-bezel chrome. Ensures consistent surfaces, charts, sidebar, tables, and page shells across the CRM while remaining performant.

### Structure / sections

#### A. Framework imports (L1–3)

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
```

#### B. Dark variant (L5)

```css
@custom-variant dark (&:is(.dark *));
```

Dark mode is class-scoped under `.dark` (not `prefers-color-scheme` alone).

#### C. `@theme inline` — Tailwind color/font/radius bridge (L15–78)

Maps design tokens into Tailwind’s color/font/radius namespaces so utilities like `bg-background`, `text-gold`, `font-mono` resolve.

**shadcn-aligned colors bridged:**  
`--color-background`, `--color-foreground`, `--color-card`, `--color-card-foreground`, `--color-popover`, `--color-popover-foreground`, `--color-primary`, `--color-primary-foreground`, `--color-secondary`, `--color-secondary-foreground`, `--color-muted`, `--color-muted-foreground`, `--color-accent`, `--color-accent-foreground`, `--color-destructive`, `--color-border`, `--color-input`, `--color-ring`, `--color-chart-1`…`5`, `--color-sidebar` (+ foreground/primary/accent/border/ring variants).

**Brand extensions:**  
`--color-ink`, `--color-surface`, `--color-surface-2`, `--color-hairline`, `--color-emerald`, `--color-emerald-deep`, `--color-gold`, `--color-gold-deep`, `--color-up`, `--color-down`, `--color-info`, `--color-on-emerald`, `--color-on-gold`, `--color-row-hover`, `--color-row-stripe`, `--color-row-hairline`.

**Fonts:**  
`--font-sans` / `--font-mono` / `--font-display` / `--font-heading` → `var(--font-geist-sans)` / `var(--font-geist-mono)` (expected from root layout `next/font` variables).

**Radii:**  
`--radius-sm` … `--radius-4xl` derived from `var(--radius)`.

#### D. `@theme` — motion + shadows (L80–91)

| Token | Value (summary) |
|-------|-----------------|
| `--ease-soft` | `cubic-bezier(0.25, 0.1, 0.25, 1)` |
| `--shadow-soft` | 1px soft slate shadow |
| `--shadow-lift` | 4px/12px lift |
| `--shadow-floating` | 12px/32px floating |
| `--shadow-inset-hi` | white inset highlight |
| `--shadow-shell` | shell rim |
| `--shadow-pill` | indigo-tinted pill shadow `rgb(99 91 255 / 0.18)` |
| `--shadow-nav` | nav double-layer |
| `--shadow-sticky` | sticky header hairline |

#### E. `:root` light palette (L94–151)

| Token | Light value / role |
|-------|---------------------|
| `--radius` | `0.5rem` |
| `--ink` | `#f6f9fc` — canvas |
| `--surface` | `#ffffff` |
| `--surface-2` | `#f0f4f8` |
| `--hairline` | `rgb(15 23 42 / 0.08)` |
| `--gold` | `#635bff` — **Stripe indigo** (name kept for class compat; not literal gold) |
| `--gold-deep` | `#4b45c6` |
| `--on-gold` | `#ffffff` |
| `--emerald` / `--emerald-deep` | `#0d9488` / `#0f766e` |
| `--up` | `#0f766e` |
| `--down` | `#df1b41` |
| `--info` | `#0073e6` |
| `--row-hover` / `--row-stripe` / `--row-hairline` | subtle slate alphas for tables |
| Semantic shadcn vars | `--background`→ink, `--foreground`→`#0a2540`, primary→gold, destructive→down, etc. |
| Charts | indigo, teal, blue, amber, violet |
| Sidebar | white surface, gold primary |

#### F. `.dark` palette (L153–203)

Retained “for shadcn parity only — app forces light” (file comment). Inverts canvas to deep navy (`#0a2540` ink), lightens accents, keeps same token names.

#### G. Custom `@utility` helpers (L205–231)

| Utility | Behavior |
|---------|----------|
| `bg-mesh` | **No-op mesh** — `background-image: none` (perf + cleanliness; class still used for API compat, e.g. global-error) |
| `bg-noise` | **No-op noise** — same rationale |
| `nums` | mono + `tabular-nums` + `"tnum"` feature |
| `bezel-hi` | `box-shadow: var(--shadow-inset-hi)` |
| `eyebrow` | 0.6875rem uppercase tracking label in muted-foreground |

#### H. `@layer base` (L233–295)

- Universal `border-border`, `outline-ring/50`
- `html`: font-sans, text-size-adjust, optimizeLegibility, smooth scroll
- `body`: bg-background, text-foreground, antialiased, `min-height: 100dvh`, **14px** base size, line-height 1.5
- Headings h1–h4: balanced wrap, tight tracking, weight 600
- `p`: pretty wrap
- Selection: indigo wash `rgb(99 91 255 / 0.18)`
- Scrollbars: thin, transparent track, slate thumb; hover thumb uses gold alpha
- `.font-display`: Geist sans + tighter tracking

#### I. Focus-visible (L297–300)

```css
:where(a, button, input, select, textarea, summary, [role="button"], [role="checkbox"], [role="tab"], [role="link"], [tabindex]):focus-visible {
  outline: 2px solid var(--gold) !important;
  outline-offset: 2px !important;
}
```

#### J. Reduced motion (L302–312)

Forces near-zero animation/transition duration and disables smooth scroll when `prefers-reduced-motion: reduce`, including `--tw-animate-duration`.

#### K. Mobile input font-size fix (L314–328)

At `max-width: 40rem`, text-like inputs/select/textarea set to **16px** to prevent iOS zoom-on-focus.

#### L. Shimmer loading pattern (L330–349)

- `@keyframes bc-shimmer` — background-position -200% → 200%
- `.bc-shimmer` — gradient indigo wash, 1.4s infinite with `--ease-soft`

#### M. Page shell classes (L351–366)

| Class | Tailwind composition (summary) |
|-------|--------------------------------|
| `.bc-page` | `mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-8` |
| `.bc-page-header` | bottom border hairline, gap, margin |
| `.bc-page-title` | 22–24px semibold tight tracking |
| `.bc-page-subtitle` | 13.5px muted |

### Key logic / design decisions

1. **Light-first product UI** — dark tokens exist only for shadcn component parity; product “forces light.”
2. **`--gold` is indigo** — deliberate rename debt for app-wide class compatibility (`bg-gold`, `text-gold`, etc.).
3. **`bg-mesh` / `bg-noise` neutralized** — callers can keep class names without paying paint cost of decorative meshes.
4. **Token dual-layer** — CSS vars on `:root`/`.dark`, then bridged into Tailwind via `@theme inline`.

### Side effects

- Global styles affect **every** page importing this file (root layout and `global-error.tsx`).
- Sets default body font size to 14px (dense CRM density).
- Scrollbar styling is global (WebKit + `scrollbar-width`).
- Focus outlines use `!important` — can fight component-local focus styles.

### Security / RBAC

- None (pure CSS). No auth, no secrets.
- Selection styling only; no content policy.

### Coupling

| Direction | Target |
|-----------|--------|
| **Depends on** | Tailwind v4, `tw-animate-css`, `shadcn/tailwind.css`; root layout must define `--font-geist-sans` / `--font-geist-mono` |
| **Consumed by** | Entire app UI via root layout import; also re-imported by `global-error.tsx` |
| **Token consumers** | Brand components, integrations cards, tables (row-hover/stripe), charts, sidebar layouts, `shadow-pill` / `ease-soft` utility users |
| **Naming debt** | Classes like `bg-gold` / `text-on-gold` appear throughout TSX; renaming tokens requires coordinated CSS + class updates |

### Risks / TODOs

1. **`--gold` semantics mismatch** — new contributors may assume amber/gold; comments mitigate but name is misleading.
2. **Dark mode half-supported** — if something sets `.dark`, palette works, but product claim is “forces light”; inconsistency risk if OS/system dark is ever enabled without QA.
3. **`!important` focus outlines** — may clash with third-party widgets or custom focus rings.
4. **Font variable assumption** — if layout fails to inject Geist CSS variables, fonts fall back poorly.
5. **No CSS modules isolation** — global by design; class name collisions possible with third-party CSS if not careful.
6. **Shimmer ignores reduced-motion** unless parent also uses motion-safe patterns — keyframes still defined; reduced-motion media query globally crushes durations to ~0.01ms, so effectively OK.

---

## 3. `src/app/integrations/adapter-card.tsx`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/integrations/adapter-card.tsx` |
| **Lines** | 934 |
| **Role** | Client UI — **connection card** + result **Sheet drawer** for one integration adapter on `/integrations`. Presentation-only; run lifecycle lifted to explorer. |
| **Exports** | `AdapterRunState` (interface), `AdapterCardProps` (interface), `AdapterCard` (function component) |
| **Imports** | React; framer-motion; Phosphor types; shadcn Sheet primitives; `cn`; brand Button/Card/Badge/IconTile; integration types; local icons + `adapter-meta` |

### Business purpose

Renders each external data feed (AA, KRA, CKYC, GSTN, MCA, ratings, FIU, email/calendar, WhatsApp, BSE/NSE, CCIL, demat, etc.) as a **machined “connection object”** on the integrations control panel — not a flat marketing tile. Operators can:

1. See identity (name, vendor, category, phase),
2. See live connection state (mock / available / connected / failed),
3. Understand IN→OUT data flow,
4. Gauge access readiness (how feasible real connect is),
5. Run a **mock** (or re-open last result) and inspect sample payload in a drawer.

Does **not** call Server Actions itself; parent explorer owns `onRun` + shared `runState` so header counts and cards stay consistent. “Run all” never opens drawers (only single-card primary path opens Sheet).

### Exports / types (quoted)

```ts
export interface AdapterRunState {
  result: AdapterResult | null;
  error: string | null;
  loading: boolean;
}

export interface AdapterCardProps {
  adapter: IntegrationSummary;
  index?: number;
  runState: AdapterRunState;
  onRun: (id: string) => void;
}

export function AdapterCard({
  adapter,
  index = 0,
  runState,
  onRun,
}: AdapterCardProps): /* JSX */
```

### Imports (detail)

| Import | Source | Purpose |
|--------|--------|---------|
| `React` | `react` | state, effects, refs |
| `motion`, `useReducedMotion` | `framer-motion` | mount tween, packet travel, meter scaleX |
| `Icon`, `IconProps` | `@phosphor-icons/react` | type cast for IconTile |
| `Sheet`, `SheetContent`, `SheetClose`, `SheetTitle`, `SheetDescription` | `@/components/ui/sheet` | result drawer |
| `cn` | `@/lib/utils` | class merge |
| `Button` | `@/components/brand/button` | primary/secondary actions |
| `Card` | `@/components/brand/card` | card shell (`interactive`) |
| `Badge` | `@/components/brand/badge` | OK/Fail + category badges |
| `IconTile` | `@/components/brand` | identity disc |
| `IntegrationSummary` | `@/features/integrations/registry` | adapter summary shape |
| `AdapterResult` | `@/features/integrations/types` | mock run result |
| Icons map + glyphs | `./integrations-icons` | per-adapter icons, Play/Warning/etc. |
| Meta maps + `deriveConnectionState`, `readinessTone`, `ConnectionState` | `./adapter-meta` | view-layer gauges |

### Internal types / constants (quoted)

```ts
type Phase = "Phase 1" | "Phase 2" | "Phase 3";

const PHASE_DOT: Record<Phase, string> = {
  "Phase 1": "bg-emerald/70",
  "Phase 2": "bg-info/70",
  "Phase 3": "bg-gold/70",
};

interface StateButtonConfig {
  variant: "primary-emerald" | "primary-gold" | "secondary-hairline";
  label: string;
  className?: string;
  icon: React.ReactNode;
  opensDrawer: boolean;
}

const STATE_BUTTON: Record<ConnectionState, StateButtonConfig>;
// connected → primary-emerald "Connected" opensDrawer:true
// available → primary-gold "Connect" opensDrawer:false
// failed → secondary-hairline "Retry" rose override classes opensDrawer:false
// mock → secondary-hairline "Run mock" opensDrawer:false

const STATE_PILL: Record<ConnectionState, {
  label: string; pill: string; dot: string; ring: string; live: boolean
}>;

const STATE_AMBIENT: Record<ConnectionState, "emerald" | "gold" | undefined>;
// connected→emerald, available→gold, failed/mock→undefined
// NOTE: stateAmbient is computed but NOT applied to Card in current code

const STATE_ICON_TONE: Record<
  ConnectionState,
  "neutral" | "emerald" | "gold" | "down"
>;

const EASE = [0.32, 0.72, 0, 1] as const;
```

### Internal helpers (non-exported)

| Symbol | Signature | Role |
|--------|-----------|------|
| `asPhosphorIcon` | `(C: (props: IconProps) => React.JSX.Element) => PhosphorIcon` | type-only cast for IconTile |
| `phaseShort` | `(phase: string) => { label: string; dot: string }` | maps `"Phase 1"`→`P1` etc. |
| `StatusPill` | `({ state }: { state: ConnectionState })` | live status pill + optional ping |
| `DataFlow` | `({ adapterId, state, icon })` | IN/OUT chips + rail + packet animation |
| `FlowLabel` | `({ side }: { side: "in" \| "out" })` | In/Out labels |
| `FlowChip` | `({ children, out? })` | chip UI |
| `FlowChipMore` | `({ children })` | overflow chip |
| `HealthMeter` | `({ adapterId, phase })` | readiness % bar |
| `MetaRow` | `({ label, value })` | drawer meta row (uses `dt`/`dd` without wrapping `dl`) |
| `formatFetchedAt` | `(iso: string) => string` | local `YYYY-MM-DD HH:mm:ss` |

### Key logic

#### Connection state derivation

```ts
const connectionState = deriveConnectionState(
  adapter,
  runState.result,
  runState.error,
);
```

Priority (from `adapter-meta`): error or `!result.ok` → `"failed"`; `result.ok` → `"connected"`; `adapter.status === "ready"` → `"available"`; else `"mock"`.

#### Primary action (`handlePrimaryAction`)

- If `stateButton.opensDrawer` (**connected** only): `setOpen(true)` only — re-preview existing data.
- Else (**mock / available / failed**): `setOpen(true)` **and** `onRun(adapter.id)` — open drawer immediately so loading state shows; completion fills body. Batch “Run all” never hits this path.

#### Card strata (render)

1. **Identity** — `IconTile` + name + optional vendor + category label + phase chip (P1/P2/P3 with colored dot).
2. **Status** — `StatusPill` with `role="status"` and `aria-label`.
3. **Description** — `line-clamp-2` from `adapter.description`.
4. **DataFlow** — max 2 IN chips + max 2 OUT chips; `ResizeObserver` measures rail; live packet animates if not reduced-motion.
5. **HealthMeter** — `ADAPTER_HEALTH[id]` default `{ readiness: 50, label: "TBD" }`; fill `scaleX: readiness/100`.
6. **Action footer** — stateful Button (disabled while loading, spinner), adapter id mono, optional inline error with WarningIcon.

#### Drawer (Sheet)

- Custom double-bezel chrome (`rounded-l-[1.5rem]`, `bezel-hi`, `shadow-floating`).
- States: loading spinner; error banner; success body with OK/Fail badges, `status`, `formatFetchedAt(fetchedAt)`, `summary`, meta (apiAvailability, costRisk, accessRequirements list), `pre` of `raw` or `JSON.stringify(data, null, 2)`; empty state with Play + first access requirement hint.
- Footer: Re-run (`onRun`), Done (`SheetClose` wrapping gold Button).

#### Motion / a11y performance rules (from comments + code)

- Mount: `initial`→`animate` (not `whileInView` opacity-0) so post-mount screenshots show full opacity.
- Transform/opacity only for packet and meter; no blur on scroll content.
- `useReducedMotion()` disables packet loop and meter intro scale.
- Status ping uses `motion-safe:animate-ping`.

### Side effects

| Effect | Scope |
|--------|-------|
| Local React state `open` | Sheet visibility |
| `ResizeObserver` on data-flow rail | Layout measure; disconnect on unmount |
| `onRun(adapter.id)` | Parent-owned; triggers Server Action **outside** this file |
| Framer animations | DOM style transforms |
| Displays `runState.error` string | If parent puts user-facing messages |

**Does not:** fetch, write cookies, call Server Actions, mutate registry, touch DB.

### Security / RBAC

- **No RBAC in component** — assumes parent page/explorer already gated who can view `/integrations` and invoke mock runs.
- **Mock-only messaging** — drawer copy: “Realistic sample payload - no real upstream call was made.”
- **Error string rendering** — `runState.error` is rendered as text children (React-escaped); risk is content quality from parent (could still show internal messages if parent forwards raw errors).
- **Payload preview** — renders mock `data`/`raw` in `<pre>`; if real credentials ever leaked into mock results upstream, this UI would display them — depends on feature-layer mock hygiene.
- **No secrets storage** — read-only presentation of `IntegrationSummary` fields (including `accessRequirements`, env-related display fields live on summary but card primarily shows name/category/phase/meta strings).

### Coupling

| Direction | Target |
|-----------|--------|
| **Parent** | `integrations-explorer.tsx` (expected owner of run map + `onRun` → Server Action) |
| **Sibling meta** | `./adapter-meta` — DATA_FLOW, ADAPTER_HEALTH, deriveConnectionState, CATEGORY_LABEL, readinessTone |
| **Sibling icons** | `./integrations-icons` — ADAPTER_ICONS, ADAPTER_VENDOR, glyph components |
| **Feature types** | `IntegrationSummary` (`id`, `name`, `status`, `category`, `phase`, `description`, `accessRequirements`, `apiAvailability`, `costRisk`, …); `AdapterResult` (`ok`, `status`, `fetchedAt`, `summary`, `data`, `raw?`, …) |
| **Brand/UI** | Card, Button variants, Badge, IconTile, Sheet |
| **Motion** | framer-motion |
| **Does not import** | registry runtime data loaders, zod schemas, Server Actions, force-dynamic |

**Adapter id keys** expected for icons/health/flow: `accountAggregator`, `kra`, `ckyc`, `gstinPan`, `mca`, `ratingFeed`, `fiuInd`, `emailCalendar`, `whatsapp`, `bseNse`, `ccil`, `demat` (via maps; missing keys degrade gracefully).

### Risks / TODOs

1. **`STATE_AMBIENT` unused on Card** — `stateAmbient` is computed but never passed (e.g. to Card ambient prop). Dead wiring / incomplete ambient halo feature.
2. **`MetaRow` uses `dt`/`dd` without parent `dl`** — minor HTML semantics issue.
3. **`SheetClose` with `render` prop** — relies on specific Sheet/Base UI API; brittle if shadcn/base-ui upgrade changes API.
4. **Hardcoded max chips (2)** — overflow only as `+N`; full list only conceptual (drawer does not re-list DATA_FLOW chips).
5. **Default health TBD (50%)** — unknown adapter ids look “onboarding-gated gold” via `readinessTone(50)` — may mislead.
6. **Error display on card + drawer** — duplicates signal; OK UX but ensure parent never puts stack traces in `error`.
7. **Timezone in `formatFetchedAt`** — uses local `Date` getters (browser local TZ), not ISO timezone label.
8. **Large file (934 lines)** — five subcomponents colocated; maintainability risk as control panel grows.
9. **No RBAC enforcement here** — if explorer is exposed without permission checks, mock run UI is fully interactive.

---

## 4. `src/app/integrations/adapter-meta.ts`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/integrations/adapter-meta.ts` |
| **Lines** | 189 |
| **Role** | **View-layer-only** metadata + pure helpers for integrations connection cards and explorer header. Display derivation of category order/labels, data-flow chips, access-readiness gauges, and connection lifecycle. |
| **Exports** | Types: `IntegrationCategory`, `DataFlow`, `AdapterHealth`, `ConnectionState`. Constants: `CATEGORY_ORDER`, `CATEGORY_LABEL`, `CATEGORY_BLURB`, `DATA_FLOW`, `ADAPTER_HEALTH`. Functions: `readinessTone`, `deriveConnectionState` |
| **Imports** | `type AdapterResult` from `@/features/integrations/types`; `type IntegrationSummary` from `@/features/integrations/registry` |

### Business purpose

Centralizes **control-panel presentation knowledge** that must not pollute the integrations data registry or Server Actions:

- Section order for the supply-chain-shaped board (financial data → KYC → registry → market → reporting → communication).
- Human labels/blurbs for categories.
- Per-adapter IN/OUT chip labels for the mini data-flow diagram.
- Honest **access readiness** scores (0–100) and captions derived from access-requirement/cost-risk narrative (not live health probes).
- Single pure function `deriveConnectionState` shared by explorer counts and per-card UI so board and cards never disagree.

Explicitly **does not** touch data registry, Server Actions, zod, or `force-dynamic`.

### Exports / types (quoted)

```ts
export type IntegrationCategory = IntegrationSummary["category"];

export const CATEGORY_ORDER: IntegrationCategory[] = [
  "financial_data",
  "kyc",
  "registry",
  "market_data",
  "reporting",
  "communication",
];

export const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  financial_data: "Financial data",
  kyc: "KYC & identity",
  registry: "Registry & depository",
  market_data: "Market data",
  reporting: "Reporting & filing",
  communication: "Communication",
};

export const CATEGORY_BLURB: Record<IntegrationCategory, string> = {
  financial_data: "Consented credit-data feeds: the analysis spine.",
  kyc: "Identity verification & KYC profile lookups.",
  registry: "Company / tax / depository registries.",
  market_data: "Pricing, trade reporting & external ratings.",
  reporting: "Regulatory filing & trade-repository workflows.",
  communication: "Channel sync for record retention.",
};

export interface DataFlow {
  in: string[];
  out: string[];
}

export const DATA_FLOW: Record<string, DataFlow>;

export interface AdapterHealth {
  /** 0–100 access-readiness estimate. */
  readiness: number;
  /** One-word / short caption for the gauge. */
  label: string;
}

export const ADAPTER_HEALTH: Record<string, AdapterHealth>;

export function readinessTone(
  readiness: number,
): "emerald" | "gold" | "down";

export type ConnectionState = "connected" | "available" | "failed" | "mock";

export function deriveConnectionState(
  adapter: { status: "mock" | "ready" },
  result: AdapterResult | null,
  error: string | null,
): ConnectionState;
```

### DATA_FLOW table (all keys)

| Adapter id | `in` | `out` |
|------------|------|-------|
| `accountAggregator` | Consent handle, PAN | Deposits, Term deposits, MF / SIP |
| `kra` | PAN | KRA record, KYC status |
| `ckyc` | PAN / CKYC id | CKYC profile, KYC history |
| `gstinPan` | GSTIN, PAN | GST returns, PAN status |
| `mca` | CIN / name | Company master, Charges, Filings |
| `ratingFeed` | ISIN / issuer | External ratings, Rating history |
| `fiuInd` | Suspicious txn | FINnet XML, STR filing |
| `emailCalendar` | OAuth2 consent | Email threads, Calendar events |
| `whatsapp` | Phone (opt-in), Template | Message log, Delivery status |
| `bseNse` | Member login, Date | Debt trades, Bhavcopy |
| `ccil` | Sponsoring member, Trade ref | F-TRAC report, Reconciliation |
| `demat` | BO id / PAN | Demat holdings, Pledge status |

### ADAPTER_HEALTH table (all keys)

| Adapter id | readiness | label | Band (via `readinessTone`) |
|------------|-----------|-------|----------------------------|
| `accountAggregator` | 88 | Ready to onboard | emerald (≥70) |
| `kra` | 82 | Open KRA API | emerald |
| `ckyc` | 74 | CERSAI onboarding | emerald |
| `gstinPan` | 84 | GSTN / NSDL self-serve | emerald |
| `mca` | 76 | MCA21 public portal | emerald |
| `ratingFeed` | 64 | Licensed feed | gold (50–69) |
| `fiuInd` | 58 | Regulatory filing | gold |
| `emailCalendar` | 86 | OAuth self-serve | emerald |
| `whatsapp` | 80 | Meta Cloud API | emerald |
| `bseNse` | 28 | Membership unverified | down (<50) |
| `ccil` | 24 | Not a direct member | down |
| `demat` | 30 | DP registration unverified | down |

**Banding policy (comments):** Phase-1 open/self-serve → high (80–88); Phase-1/2 member-workflow/licensed → mid (58–76); Phase-3 member-only/UNVERIFIED → low (24–30).

### Key logic

#### `readinessTone`

```ts
if (readiness >= 70) return "emerald";
if (readiness >= 50) return "gold";
return "down";
```

#### `deriveConnectionState`

```ts
if (error || (result && !result.ok)) return "failed";
if (result?.ok) return "connected";
if (adapter.status === "ready") return "available";
return "mock";
```

**Order matters:** a failed mock result overrides `ready` status; a successful mock result labels state `"connected"` even though no real upstream is implied by the UI (semantic: “mock run connected,” not production link — card still says Mock output in drawer).

**Note on `error` vs `result.ok`:** any non-null `error` string forces `"failed"` regardless of a prior successful `result` still held in state (parent state shape determines whether error clears result).

### Side effects

- **None.** Pure constants + pure functions. No I/O, no React, no DOM.

### Security / RBAC

- None. Static display metadata.
- Labels mention real Indian regulatory/market entities (CERSAI, GSTN, FINnet, BSE/NSE, CCIL, etc.) — informational only.
- Does not expose credentials or env values (those live on `IntegrationSummary` / registry elsewhere).

### Coupling

| Direction | Target |
|-----------|--------|
| **Type-only deps** | `AdapterResult`, `IntegrationSummary["category"]` / status shape |
| **Consumers** | `adapter-card.tsx` (DATA_FLOW, ADAPTER_HEALTH, deriveConnectionState, readinessTone, CATEGORY_LABEL, ConnectionState); `integrations-explorer.tsx` (expected: CATEGORY_ORDER, CATEGORY_LABEL, CATEGORY_BLURB, deriveConnectionState for header counts) |
| **Must stay in sync with** | Registry adapter ids/categories; feature adapter list; icon maps in `integrations-icons.tsx` |
| **Deliberately decoupled from** | Server Actions, zod, force-dynamic, live health checks, credential presence (`credentialsPresent` not used here) |

### Risks / TODOs

1. **Manual sync of adapter ids** — `DATA_FLOW` / `ADAPTER_HEALTH` are `Record<string, …>` not keyed by a union of known ids; new registry adapters silently get empty flow (`?? { in: [], out: [] }`) and default health in card (`?? { readiness: 50, label: "TBD" }`).
2. **`"connected"` after mock** — naming can overstate production connectivity; product language in drawer mitigates, but header counts using `deriveConnectionState` may say “connected” for mocks that merely returned `ok`.
3. **Readiness is not measured** — static editorial scores; can drift from real onboarding progress or `credentialsPresent`.
4. **Category union drift** — if `IntegrationSummary["category"]` gains a value not in `CATEGORY_ORDER` / `CATEGORY_LABEL` / `CATEGORY_BLURB`, TypeScript should fail the Records; order array may omit new categories unless updated.
5. **No runtime validation** that every registry id has meta — view-layer rule accepts missing fields, but UX degrades.
6. **`AdapterResult` import is type-only** — good; keep it that way to avoid pulling server code into client graphs (this module is imported by client components).

---

## Batch 028 cross-file notes

| Relationship | Detail |
|--------------|--------|
| `global-error.tsx` → `globals.css` | Error boundary re-imports global CSS because it replaces root layout. |
| `globals.css` → app-wide | Tokens (`gold`, `emerald`, `down`, `hairline`, `shadow-pill`, `nums`, `bezel-hi`) power integrations card styling without direct TS import. |
| `adapter-card.tsx` ↔ `adapter-meta.ts` | Card is the primary consumer of meta maps + `deriveConnectionState` / `readinessTone`. |
| Integrations feature boundary | Both integrations files are **view layer**; business adapters/registry live under `src/features/integrations/*`. |
| Security theme | `global-error` suppresses error detail disclosure; adapter card discloses mock payloads only; meta has no secrets. |

**Files in batch:** 4/4 analyzed exhaustively.  
**No docs files** were in the batch list.
