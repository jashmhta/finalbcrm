# File-by-file analysis — agent-025

**Batch:** `batch-025.list`  
**Workspace root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4 (dashboard exposure chart + deal detail + deal-type credit/icon language)

---

## 1. `src/app/dashboard-exposure-chart.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/dashboard-exposure-chart.tsx` |
| **Lines** | 304 |
| **Directive** | `"use client"` |
| **Role** | Dashboard visual components: mandate vs credit exposure area chart, stage strip, mini bars. |

### Exports

```ts
export interface ExposurePoint {
  month: string;      // "MMM"
  mandates: number;   // ₹ Cr
  exposure: number;   // ₹ Cr
}

export function HeroExposureChart({
  data, totalMandates, totalExposure,
}: {
  data: ExposurePoint[];
  totalMandates: number;
  totalExposure: number;
}): JSX.Element

export interface StageDatum {
  key: string;
  label: string;
  count: number;
  pct: number;
}

export function StageStrip({
  stages, total,
}: { stages: StageDatum[]; total: number }): JSX.Element

export function MiniBars({
  data,
}: { data: { month: string; mandates: number }[] }): JSX.Element
```

Internal: `LegendDot`, `ExposureTooltip` (+ payload interface).

### Imports

- React, framer-motion `motion`/`useInView`
- recharts: Area/AreaChart/Bar/BarChart/CartesianGrid/ResponsiveContainer/Tooltip/X/Y
- `@/lib/utils` `cn`

### Business purpose

Hero “wow” chart for home dashboard: trailing 12m mandate value vs credit exposure in crore INR (en-IN formatting). Data computed server-side; this file owns presentation + animation only. StageStrip visualizes open pipeline by stage (emerald live / gold near-close pricing+allocation). MiniBars is compact unused-on-desktop variant.

### Key logic

- `useInView` gates recharts animation so draw-in only when visible.
- Dual Area series: gold exposure under emerald mandates; CSS vars `--emerald`/`--gold`/`--hairline`.
- Tooltip double-bezel pill; `aria-live` on total mandates.
- StageStrip: motion width 0→pct; empty copy “The pipeline is quiet.”

### Side effects

None (pure client render of props). No fetch.

### Security / RBAC

None — consumer must scope data.

### Coupling

- Home dashboard / KPI surfaces that pass pre-aggregated series.
- Design tokens via CSS variables; framer-motion + recharts heavy client deps.

### Risks / TODOs

- `MiniBars` marked unused on desktop — dead surface risk.
- Gradient ids `dashMandates`/`dashExposure` global in SVG — multi-instance collision if two charts mount.
- No currency prop (hardcoded ₹ Cr India posture).

---

## 2. `src/app/deals/[id]/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/deals/[id]/page.tsx` |
| **Lines** | 590 |
| **Directive** | RSC |
| **Role** | Canonical shareable deal/mandate detail (full depth vs board inspector). |

### Exports

```ts
export const dynamic = "force-dynamic";
export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element>
```

Internal helpers: `pretty`, `fmtDate`, `fmtDateTime`, `dealVisibilityScope`, `StageLadder`, `MetaCell`, `DL`/`DT`/`DD`.

### Imports (selected)

- Brand shell, icons, Badge/Button/Card/Table/Money/PreviewPane/Reveal
- `can`, `requireUser`, `CrmUser` from rbac
- `db`, drizzle `and/asc/eq/isNull/sql`
- schema: `appUser`, `deal`, `dealParty`, `party`
- `dealTypeSpec`, `stageLadderFor` from deals feature
- `DealTypeGlyph`, `PartyRoleGlyph`, `creditBand` from sibling modules

### Business purpose

Full mandate view: identity (code, type, status, brand, credit band), stage ladder, terms DL, linked parties with roles/commitments. Destination for dashboard recent deals, lead-win “Open deal”, etc. Board keeps inline inspector; this is canonical URL.

### Key logic — visibility

```ts
function dealVisibilityScope(user: CrmUser): SQL {
  if (can(user, "read_all", "deal") || can(user, "manage", "user")) return sql`TRUE`;
  if (!user.appUserId) return sql`FALSE`;
  // lead OR credit analyst OR creator OR deal_party→party assigned_rm/analyst
}
```

1. `requireUser`; load deal with `deletedAt IS NULL` + scope → `notFound()` if missing.
2. Load parties only **after** scoped deal succeeds (roster never leaks for inaccessible deal).
3. Optional lead email from `appUser`.
4. Sort parties: lead first, then role, then name; sum commitments.
5. Render PreviewPane + StageLadder + Terms + Linked parties table.

### Side effects

- Multiple SELECTs; force-dynamic.
- No mutations on this page.

### Security / RBAC

- App-layer visibility SQL (not only RLS).
- Party roster gated by deal access.
- Lead email exposed to any user who can see the deal (email may be sensitive).
- Soft-delete: `isNull(deal.deletedAt)`.

### Coupling

- Direct `db` use in page (bypasses features/deals/queries for detail — architectural split).
- deal catalog + stages + icon language.
- Links to `/parties/{id}`, `/deals` board.

### Risks / TODOs

- Visibility column names: scope uses `assigned_rm_user_id` / `assigned_analyst_user_id` on party; other modules use `assigned_user_id` / `data_owner_user_id` — **inconsistent party ownership model risk**.
- No edit/actions on detail (read-only).
- Status badge map may lag enum additions.

---

## 3. `src/app/deals/deal-type-credit.ts`

| Field | Value |
|--------|--------|
| **Path** | `src/app/deals/deal-type-credit.ts` |
| **Lines** | 43 |
| **Directive** | None (server-safe pure module) |
| **Role** | Pure `creditBand` for deal-type-derived rating chip (SOV/IG/HY). |

### Exports

```ts
export interface CreditBand {
  code: string;   // SOV | IG | HY
  label: string;
  tone: IconTone;
}

export function creditBand(
  dealType: string | null | undefined,
): CreditBand | null
```

### Imports

Type-only: `IconTone` from `@/components/brand/icon-language` (erased at compile — no client graph).

### Business purpose

Deal table has no agency rating; deal_type encodes credit character. Server Components cannot import from `"use client"` `deal-type-icon.tsx` (prior RSC error). This module is shared source of truth; client re-exports from icon file.

### Key logic

| dealType | band |
|----------|------|
| `gsec_auction` | SOV gold |
| `high_yield_bond` | HY down |
| `bond_underwriting` | IG emerald |
| else | null |

### Side effects / Security

None / none.

### Coupling

- Consumed by deal detail page and re-exported by deal-type-icon for board.
- IconTone type only.

### Risks / TODOs

- Only three credit-relevant types get chips; private placement / structured finance show no band.
- Not true agency ratings — must stay clearly view-derived.

---

## 4. `src/app/deals/deal-type-icon.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/deals/deal-type-icon.tsx` |
| **Lines** | 265 |
| **Directive** | `"use client"` |
| **Role** | Machined identity discs for deal types + deal-party roles; re-exports creditBand. |

### Exports

```ts
export function dealTypeConcept(dealType: string | null | undefined): Concept
export function DealTypeGlyph(props: DealTypeGlyphProps): JSX.Element
export function partyRoleConcept(role: string | null | undefined): Concept
export function PartyRoleGlyph(props: PartyRoleGlyphProps): JSX.Element
export { creditBand, type CreditBand } from "./deal-type-credit"
```

### Imports

Phosphor via brand icons boundary; brand marks (BondCoupon, GSec, RatingLadder, Mandate, ExposureGauge, KycShield), `IconTile`, `cn`.

### Business purpose

Icon language: fixed-income types use bespoke MARKS; operational/ECM use Phosphor Light in same disc well. Roles: issuer/investor/rating_agency/guarantor marks; syndicate Handshake; ops Scales/FileText; M&A Target/Briefcase. Lead role forces gold accent.

### Key logic

- `DEAL_TYPE_CONCEPTS` / `ROLE_CONCEPTS` maps + defaults.
- Glyphs: custom mark span or `IconTile` with Phosphor.
- Tone palette restrained (gold for SOV/rating premium).

### Side effects / Security

None / display only.

### Coupling

- Board view, deal detail, any surface showing deal/role identity.
- Must stay client-only for Phosphor module scope.

### Risks / TODOs

- Unknown deal types fall back to MandateMark silently.
- Dual definition sites for disc tones vs IconTile must stay in sync.

---

## Cross-file summary (batch 025)

- **Server/client split for creditBand** is deliberate architecture fix.
- **Deal detail** is a full RSC data page with app-layer visibility SQL.
- **Dashboard chart** is pure presentation of ₹ Cr dual series.
- **Risk:** party assignment field name inconsistency between deal scope and other feature scopes.

*End of agent-025 analysis.*
