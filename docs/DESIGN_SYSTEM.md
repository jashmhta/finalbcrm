# Binary Capital CRM — World-Class Design System (Awwwards-tier)

> Adapted from the `high-end-visual-design` skill for a **data-dense financial CRM dashboard** (not a landing page). The bar: the restrained, expensive, precise feel of Linear / Stripe / Mercury / Ramp / Vercel — not flashy marketing motion. Premium + dense + calm. Dark-first with a flawless light mode. On-brand with Binary Capital (emerald/teal + gold).

---

## 1. Aesthetic direction

**Vibe: "Ethereal Glass" — dark-first fintech.**
- Deepest ink background (`#050507` / oklch near-black with a faint emerald tint), NOT pure `#000`.
- Subtle **radial mesh gradient** background — 2–3 soft emerald/gold orbs at very low opacity (~0.06–0.10), fixed, `pointer-events-none`, behind everything. Never on scrolling containers.
- Vantablack/ink **cards** with `ring-1 ring-white/8` hairlines (NO gray borders) + inner highlight `shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]`.
- `backdrop-blur` ONLY on fixed/sticky elements (nav, command bar, sticky table headers, overlays). Never on scrolling content.
- Optional fine **noise/grain** overlay on a fixed `::before` at `opacity-[0.025]` for a physical, non-banded feel.
- Light mode: warm-neutral paper (`#FBFAF8`), ink text, same hairline/emerald/gold system recalibrated for contrast.

**On-brand accent system (from Binary Capital's site):**
- Primary: **emerald/teal** (`emerald-400/500`, e.g. `oklch(0.74 0.15 165)`) — used sparingly for active/positive/primary actions.
- Signature: **gold/amber** (`amber-300/400`, e.g. `oklch(0.83 0.13 85)`) — the "Binary" brand accent; used for the single most premium accent (logo mark, key CTAs, the bond-calculator result highlight, score rings).
- Semantic: green (positive/up), red/rose (negative/down/over-limit), blue (info), muted neutrals for the rest.
- Financial figures use **tabular-nums** + Geist Mono; up/down with subtle color + a light icon, never garish.

## 2. Typography

**Banned:** Inter, Roboto, Arial, Open Sans, Helvetica (the skill bans these — and the scaffold currently ships Inter, which we replace).

**Stack:**
- **Geist Sans** — UI body, labels, nav, table cells. (`geist` package / next/font.)
- **Geist Mono** — all financial numbers, ISINs, ratings, IDs, deal sizes. `font-variant-numeric: tabular-nums`. This is the single biggest "expensive fintech" tell.
- **Fraunces** (or **Instrument Serif**) — display/editorial only: the dashboard hero greeting, section openers, the bond-calculator headline, empty-state poetry. Optical sizing, light weight, tight leading. Used SPARINGLY for contrast against the Grotesk.

**Scale (rem, fluid where possible):**
- Display: `clamp(2.4rem, 1.6rem + 2vw, 3.4rem)` — Fraunces, weight 400, `tracking-[-0.02em]`, `leading-[1.05]`.
- H1: 1.875rem / H2: 1.5rem / H3: 1.25rem — Geist, weight 600, `tracking-[-0.01em]`.
- Body: 0.9375rem (15px) — Geist 400, `leading-[1.55]`. (Slightly under 16px for density.)
- Small/label: 0.8125rem (13px), weight 500.
- Micro/eyebrow: 0.6875rem (11px), `uppercase tracking-[0.18em]` — for KPI labels, table headers, section eyebrows.
- Numeric: Geist Mono, tabular-nums, weight 500.

## 3. Layout archetypes (applied per screen, not one-size-fits-all)

- **Dashboard** → **Asymmetrical Bento**: a 12-col grid of varying KPI cards (a large hero KPI `col-span-8 row-span-2` + stacked `col-span-4` cards) + a wide deals-by-stage strip + a recent-activity rail. Breaks the boring "4 equal stat cards" trap.
- **Bond calculator / Credit workspace** → **Editorial Split + Double-Bezel**: inputs left, live results right; results panel is a double-bezel "instrument" with an animated score ring / price readout.
- **Lists (parties, deals, KYC, audit, interactions)** → **Dense premium tables** (see §6) inside a double-bezel container, with a floating glass command/filter bar on top.
- **Detail pages** → **Z-axis subtle layering**: a header band + stacked double-bezel sections (overview, relationships, deals, credit, KYC) with hairline separation, not flat tabs-only.
- **Mobile (<768px)**: every asymmetric layout collapses to single-column `w-full px-4 py-8`, all `col-span-*` reset, rotations/overlaps removed. Use `min-h-[100dvh]`, never `h-screen`.

## 4. Spacing & shadow

**Spacing scale (4-based):** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96. Page gutters: `px-6 md:px-10 lg:px-16`. Section vertical rhythm: `gap-6 md:gap-8`. Macro-whitespace reserved for the dashboard hero / empty states (`py-16` to `py-24`); data screens stay dense (`gap-4`, cell `px-4 py-3`).

**Shadow system (soft, diffused, layered — never harsh `shadow-md`):**
- `shadow-soft`: `0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.02)`
- `shadow-lift` (hover): `0 8px 30px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.06)`
- `shadow-floating` (nav/popover): `0 20px 60px -10px rgba(0,0,0,0.35), 0 8px 20px -8px rgba(0,0,0,0.20)`
- Dark mode shadows are subtle; rely on hairlines + inset highlights for depth instead of heavy black shadows.

## 5. The "Double-Bezel" (Doppelrand) — every major container

Never place a card flat on the background. Machined, nested enclosure:
- **Outer shell:** `rounded-2xl` (or `rounded-[1.5rem]`), `p-1.5`, `ring-1 ring-white/8 dark:ring-white/10`, faint `bg-white/[0.02]`.
- **Inner core:** `rounded-[calc(1.5rem-0.375rem)]`, distinct `bg-[--surface]`, `shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]`.
- Concentric radii (inner radius = outer radius − shell padding) so curves nest perfectly.
- Inputs/selects get the same treatment (outer hairline ring + inner field), not flat borders.

## 6. Premium data tables (the heart of a CRM)

- Container: double-bezel; sticky header gets `backdrop-blur-xl` + hairline bottom (sticky = allowed blur).
- **No vertical row borders.** Hairline `border-b border-white/6` between rows only.
- Header row: micro-uppercase eyebrow style (`text-[11px] uppercase tracking-[0.14em] text-white/45`), `py-3 px-4`, no heavy fill.
- Body cells: `px-4 py-3.5`, `text-[13.5px]`, `text-white/80`; primary cell (name) `text-white font-medium`.
- **Numeric cells: Geist Mono, tabular-nums, right-aligned.**
- Row hover: `bg-white/[0.03]` with a `transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]`; the row's primary cell gets a subtle emerald left-accent that grows on hover (`before:` pseudo, `w-[2px] → w-[3px]`).
- Selected row: `bg-emerald-500/10` + emerald hairline left.
- Empty state: Fraunces one-liner + a quiet Phosphor Light glyph, not a generic "No data."
- Pagination: pill buttons, mono page numbers, no heavy chrome.
- Density toggle (Comfortable/Compact) in the command bar — a premium desk feature.

## 7. Navigation — floating glass "island"

- NOT an edge-to-edge sticky bar. A **floating detached pill**: `mx-auto mt-5 w-max rounded-full`, `backdrop-blur-2xl bg-white/5 dark:bg-black/40 ring-1 ring-white/10 shadow-floating`, `px-2 py-2`.
- Left: a small gold/emerald logo mark (the "B" binary motif) + wordmark.
- Center: nav items as pill-segments; active item gets a `bg-white/10` inset pill with an emerald dot.
- Right: command (⌘K) trigger pill, user avatar menu, sign-out.
- On mobile: collapses to a floating hamburger that morphs lines→X (`rotate-45`/`-rotate-45`) and opens a full-screen `backdrop-blur-3xl bg-black/80` overlay with staggered link reveals (`translate-y-8 opacity-0 → 0` with `delay-100/150/200`).

## 8. Buttons & CTAs

- Primary: `rounded-full px-5 py-2.5`, emerald or gold (gold for the single most important action per screen), `font-medium text-[13.5px]`.
- **Button-in-button trailing icon:** arrow/icon lives in its own `w-6 h-6 rounded-full bg-black/10 dark:bg-white/10` circle flush to the right padding; on hover the circle `translate-x-0.5` + `scale-105`, button `active:scale-[0.98]` (magnetic).
- Secondary: hairline pill (`ring-1 ring-white/12`), no fill.
- Ghost: text-only with an underline-reveal on hover.
- All transitions: `duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]`. Never `linear`/`ease-in-out`.

## 9. Motion choreography

- **Custom easing token:** `--ease: cubic-bezier(0.32,0.72,0,1)`; spring for physics-y moments.
- **Entry reveals:** Framer Motion `whileInView` — `opacity-0 translate-y-4 blur-sm → opacity-100 translate-y-0 blur-0`, `duration: 0.6, ease`. Stagger lists by `0.04` per item. Never animate on `scroll` listeners.
- **Page transitions:** subtle fade + 4px rise between routes (App Router `template.tsx` + Framer Motion `AnimatePresence`).
- **Magnetic hover** on cards/buttons: `group-hover` translate + scale, only `transform`/`opacity`.
- **Number count-ups** on KPIs: animate from 0 → value on mount, `duration: 1.1s, ease`, tabular-nums so digits don't jitter.
- **Score ring / price readout** in the bond calculator + credit workspace: animated SVG ring (stroke-dashoffset) on mount + when inputs change.
- GPU discipline: ONLY `transform` + `opacity`; `will-change` only on actively animating elements; `backdrop-blur` only fixed/sticky; noise only on fixed `::before`.

## 10. Iconography

**Banned:** thick Lucide / FontAwesome / Material. Replace lucide-react usage with **Phosphor Light** (`@phosphor-icons/react`, `weight="light"` or `"thin"`). Ultra-thin, precise strokes. Mono tone, `text-white/55`, emerald/gold only for active/semantic. Consistent 20px (lists) / 18px (nav) / 16px (inline) sizing.

## 11. Charts & data viz

- Use **recharts** (or visx for the hero chart) with a heavy custom theme: no default gridlines/colors. Hairline `stroke="rgba(255,255,255,0.08)"` grid, emerald/gold series, mono axis labels, soft area fills (`fill-opacity 0.12` + gradient), animated draw-in on mount. Tooltips = double-bezel pill with mono numbers.
- Hero dashboard chart: exposure/deal-value over time, with a moving accent.
- Score ring (credit): custom SVG arc, gold→emerald gradient by band, animated.

## 12. The "wow" screens (where Awwwards moments live)

1. **Dashboard** — bento KPIs with count-up numbers, a hero exposure/league chart, deals-by-stage strip with animated stage cards, recent-activity rail. This is the first impression.
2. **Bond calculator** — a double-bezel "instrument": inputs left, live price/YTM/duration/convexity readout right with an animated price-yield curve; gold accent on the headline result.
3. **Credit workspace** — financial-spreading grid (mono numbers, hairline cells) + an animated score ring + rating-scale ladder with the issuer's notch highlighted.
4. **Login** — a quiet, cinematic split: Fraunces editorial line + floating glass auth card on the mesh gradient. Not a generic form.

## 13. Defaults to avoid (the "cheap" tells)

- ❌ Inter font, thick Lucide icons, `border-gray-200`, `shadow-md`, edge-to-edge nav, 4 equal stat cards, `ease-in-out`, static load, pure `#000` or pure `#fff`, garish red/green finance colors, generic "No data" empty states, heavy black drop shadows, `h-screen`.

## 14. Implementation notes for the elevation pass

- Add deps: `geist`, `@phosphor-icons/react`, `framer-motion`, `recharts`. Remove/replace lucide usage progressively.
- Set fonts in `app/layout.tsx` via `next/font` (Geist Sans + Geist Mono + Fraunces).
- Define CSS variables (Tailwind v4 `@theme`) for color tokens, `--ease`, shadow vars, surface layers — in `globals.css`.
- Build a small set of bespoke primitives mirroring shadcn APIs but with the double-bezel + motion treatment: `Card`, `Table`, `Button`, `Badge`, `Dialog`, `Sheet`, `CommandBar`, `StatCard`, `ScoreRing`, `Money` (mono/tabular formatter).
- Preserve ALL functionality + data wiring from the functional build; this is a visual/interaction elevation, not a rewrite of logic.
- Re-validate after: `next build` clean + `next dev` smoke test every route + seeded data renders.

## 15. Pre-output checklist (per screen)

- [ ] No banned fonts/icons/borders/shadows/layouts/motion
- [ ] Dark-first + light-mode parity; on-brand emerald + gold used sparingly
- [ ] Major containers use double-bezel; hairlines not gray borders
- [ ] Tables: hairline rows, mono tabular numbers, no vertical borders, refined hover
- [ ] Nav is a floating glass pill; mobile collapses + morphs
- [ ] Buttons: pill, button-in-button where applicable, magnetic hover
- [ ] Custom cubic-bezier motion; entry reveals on key content; count-ups on KPIs
- [ ] Only `transform`/`opacity` animated; blur only on fixed/sticky; noise on fixed `::before`
- [ ] Collapses gracefully <768px (`w-full px-4 py-8`, no overlaps/rotations, `min-h-[100dvh]`)
- [ ] Reads as "$150k agency fintech dashboard", not "shadcn defaults"
