# Agent 042 — File-by-file analysis

**Batch:** `batch-042.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope:** Parties list route — create dialog, server page, explorer client view, party avatar.

---

## 1. `src/app/parties/new-party-dialog.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/parties/new-party-dialog.tsx` |
| **Lines** | 337 |
| **Directive** | `"use client"` |
| **Role** | Create party master via double-bezel dialog + server action |

### Exports + signatures

```ts
export function NewPartyDialog(): JSX.Element

// Internal
function Field({ label, htmlFor, required, hint, children })
function BezelInput(props: React.InputHTMLAttributes<HTMLInputElement>)
function BezelSelect({ id, name, value, onChange, options })
```

### Imports

UI Dialog suite; Phosphor `X`, `Plus`, `ArrowRight`, `CircleNotch`; brand `Button`, `Eyebrow`; `createParty` / `CreatePartyState` from `@/features/parties/actions`; `cn`.

### Constants

```ts
PARTY_NATURES = organization | natural_person | spv | trust | government | regulator
PARTY_TYPES = issuer | investor | intermediary | arranger | underwriter | broker | ifa |
  rating_agency | trustee | registrar | legal_counsel | auditor | guarantor |
  credit_enhancement_provider | spv | prospect
```

### Business purpose

Primary **on-ramp for party master** creation: legal name (required), display name, nature, primary type, city/state; hardcodes `countryOfIncorporation=IN`. On success action redirects to new detail page.

### Key logic

1. Controlled dialog open state; `useActionState(createParty)`.
2. Nature/type via BezelSelect with **hidden input mirror** so FormData includes values (styled native select).
3. Mobile touch targets h-11 / close size-11; desktop compact.
4. Error panel with `role="alert"`.

### Side effects

- `createParty` insert + redirect.
- Local UI state only otherwise.

### Security / RBAC

- Action must enforce create permission; dialog shown to any user who can open parties list UI.
- Country fixed to IN — no client override field (hidden input only).

### Coupling

- Dialog API (`render` prop on Trigger/Close — base-ui style).
- `createParty` FormData field names.

### Risks / TODOs

1. **No multi-type on create** — only primary type; secondary types need later edit (no edit UI in batch 041).
2. **Success path is redirect** — if action returns error-only without redirect, dialog stays open (OK).
3. **Identifiers (PAN/CIN)** not collected at create.
4. Direct Phosphor import vs brand icons boundary (acceptable in client).

---

## 2. `src/app/parties/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/parties/page.tsx` |
| **Lines** | 98 |
| **Directive** | None (RSC) |
| **Route** | `/parties` |
| **Role** | Server loader for Relationship Explorer |

### Exports + signatures

```ts
export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?, page?, id?, type?, risk?, turnover?, sector?, rating?, agency?,
    ratingYear?, investorType?, portfolioSize?, riskAppetite?, highYield?,
    assignedUserId?
  }>;
})
```

### Imports

`PageHeader`, `PageShell`; `requireUser`; `getPartyPreview`, `listParties`, `PartyListFilters`; `Reveal` (**imported unused**); `PartiesExplorer`.

### Business purpose

Parse rich segmentation query string, page parties at 25, resolve selection (`?id=` or first row), fetch preview, hand serializable props to client explorer.

### Key logic

```ts
const user = await requireUser();
// build PartyListFilters from sp (highYield true/false/undefined)
const { rows, total, page, pageSize, summary } = await listParties({ q, page, pageSize: 25, filters, user });
const selectedId = requestedId on page ? requestedId : requestedId ?? rows[0]
const preview = selectedId ? await getPartyPreview(selectedId, user) : null
```

If `id` not on current page, still loads preview (comment: list falls back to first-row highlight).

### Side effects

Auth + two DB query families (list+summary, preview).

### Security / RBAC

`listParties` / `getPartyPreview` receive `user` for visibility/segmentation RBAC.

### Coupling

Strong contract with `PartiesExplorer` props and filter keys shared with URL.

### Risks / TODOs

1. **Unused `Reveal` import**.
2. **Page not clamped to totalPages**.
3. **`Number(sp.page)` float** edge case.
4. **Double query** list + preview sequential (could parallelize when selectedId known from sp before list — but selection depends on rows).
5. **`ratingYear`** coerced with `Number(...) || undefined` — year `0` impossible anyway.

---

## 3. `src/app/parties/parties-list-view.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/parties/parties-list-view.tsx` |
| **Lines** | ~1239 |
| **Directive** | `"use client"` |
| **Role** | Full Relationship Explorer UI |

### Exports + signatures

```ts
export interface PartiesExplorerProps {
  rows: PartyListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q?: string;
  filters: PartyListFilters;
  summary: PartyListSummary;
  selectedId: string | null;
  preview: PartyPreview | null;
}

export function PartiesExplorer(props: PartiesExplorerProps): JSX.Element
```

**Major internals:** `SummaryStrip`, `PartyList`, `LetterBand`, `PartyRow`, `PartyPreviewPane`, `KycDot`, many `*FilterSelect`, `FilterSelect`, `Pagination`, `PagePill`, `useMinWidth`, `groupByLetter`.

### Imports

Router hooks; brand icons + direct Phosphor `SquaresFour`, `UserCirclePlus`; segmentation constants from `@/features/parties/segmentation`; brand CommandBar/PreviewPane/StatCard; `ExportCsvButton`; local NewPartyDialog, PartyAvatar, RelationshipGraph, party-signals.

### Business purpose

**Not a plain table** — two-pane explorer: alphabetized rich list + sticky preview (graph, mandates, exposure, KYC). Mobile navigates to detail; desktop selects `?id=`. URL-driven search/filters.

### Key logic

1. Debounced search 280ms → `router.replace` with `q`, clears `page`+`id`.
2. `setFilter(key, value)` URL updates; advanced filters toggle.
3. `groupByLetter` A–Z/# bands.
4. `useMinWidth(1024)`: desktop `preventDefault` on row Link + `selectParty`; mobile follows `/parties/:id`.
5. Preview: mini graph, top 4 deals, group exposure, KYC snapshot.
6. Pagination Link builder preserves all filter keys.
7. Export CSV type `"parties"`.

### Side effects

Client navigation only; export hits `/reports/export`; create via dialog action.

### Security / RBAC

No client-side permission checks; relies on server-filtered rows/preview. Export gated server-side (super admin).

### Coupling

- Feature types `PartyListItem`, `PartyPreview`, filters/summary.
- Segmentation enum catalogs.
- Design system CommandBar/PreviewPane/PartyAvatar/RelationshipGraph.

### Risks / TODOs

1. **Monolith client file (~1.2k LOC)** — high change cost.
2. **SSR `useMinWidth` starts false** — first click on desktop-width may navigate until effect runs (hydration mismatch UX).
3. **Advanced filters many** — filter bar can overflow on mid widths.
4. **Preview load on every selection** full RSC round-trip (by design URL sync).
5. **Empty vs filtered empty** messaging careful but pagination still shows when totalPages>1 with empty page possible.

---

## 4. `src/app/parties/party-icon.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/parties/party-icon.tsx` |
| **Lines** | 146 |
| **Directive** | `"use client"` |
| **Role** | Type-coded party identity disc |

### Exports + signatures

```ts
export function partyConcept(primaryType: string | null | undefined): Concept

export interface PartyAvatarProps {
  primaryType?: string | null;
  size?: IconSize; // 16 | 20 | 24
  tone?: IconTone;
  className?: string;
}

export function PartyAvatar(props: PartyAvatarProps): JSX.Element
```

### Concept map

| Type | Mark/Icon | Tone |
|------|-----------|------|
| issuer | MandateMark | neutral |
| investor | ExposureGaugeMark | emerald |
| rating_agency | RatingLadderMark | gold |
| guarantor | KycShieldMark | emerald |
| credit_enhancement_provider | KycShieldMark | gold |
| arranger/underwriter | Handshake | neutral |
| broker/intermediary | ArrowsLeftRight | neutral |
| ifa | Chats | neutral |
| trustee | Scales | neutral |
| registrar | FileText | neutral |
| legal_counsel | Briefcase | neutral |
| auditor | CheckCircle | neutral |
| spv | Buildings | neutral |
| prospect | Sparkle | gold |
| default | Buildings | neutral |

### Business purpose

Unified iconography so every party row/detail shares one machined disc language (custom MARKS for core roles, Phosphor for operational).

### Key logic

If `concept.mark` → manual disc classes mirroring IconTile tones; else `IconTile` with Phosphor.

### Side effects / Security

None pure presentational.

### Coupling

Brand `IconTile` + MARKS + icons client boundary; must stay in client modules.

### Risks / TODOs

1. **Unknown types** fall back to buildings — silent.
2. **Multi-type parties** only show primary (first types[] entry) — secondary types invisible in avatar.
3. Disc class duplication vs IconTile can drift.

---

## Cross-file summary (batch 042)

```
page.tsx (RSC filters+list+preview)
  └── PartiesExplorer
        ├── SummaryStrip (summary KPIs)
        ├── CommandBar + filters + ExportCsv + NewPartyDialog→createParty
        ├── PartyList (PartyAvatar + StrengthBar + letter bands)
        └── PartyPreviewPane (RelationshipGraph mini + deals + KYC)
```

### Highest-priority risks

1. Explorer size / maintainability.
2. Desktop selection race before matchMedia hydrates.
3. Create dialog minimal identity (no PAN/tax IDs).
4. Unused `Reveal` on page.

---

*End of agent-042 analysis.*
