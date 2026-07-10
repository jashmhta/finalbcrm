# Agent 043 — File-by-file analysis

**Batch:** `batch-043.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope:** Party signals + relationship graph + client portal detail + client directory.

---

## 1. `src/app/parties/party-signals.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/parties/party-signals.tsx` |
| **Lines** | 140 |
| **Directive** | **None** (shared RSC-safe module) |
| **Role** | Display-only relationship strength + relative time + StrengthBar |

### Exports + signatures

```ts
export type StrengthBand = "latent" | "emerging" | "active" | "established" | "strategic";

export interface Strength {
  score: number;      // 0–100
  filled: number;     // 1..5 segments
  band: StrengthBand;
}

export const BAND_LABEL: Record<StrengthBand, string>;

export interface PartySignalInput {
  relationshipCount: number;
  dealCount: number;
  contactCount: number;
  isKycComplete: boolean | null;
}

export function deriveStrength(r: PartySignalInput): Strength
export function formatRelative(d: Date | string | number | null | undefined): string
export function StrengthBar({ strength, className }: { strength: Strength; className?: string })
```

### Imports

`React`, `cn` only.

### Business purpose

Keep **explorer and detail** strength meters identical without pulling client hooks into the server detail page. Pure scoring for UX (never persisted).

### Key logic

**Weights:** deals 40% (cap 6), relationships 30% (cap 4), contacts 15% (cap 3), KYC 15% binary.  
`score = round(...)`; `filled = max(1, min(5, ceil(score/20)))`; band from filled index.  
`formatRelative`: just now / m / h / d / short date; coerces string ISO from SQL aggregates.  
StrengthBar: ascending segment widths; strategic gold-caps last segment with glow.

### Side effects / Security

None. Display-only; not a credit/risk engine.

### Coupling

Consumed by `parties-list-view`, `parties/[id]/page`.

### Risks / TODOs

1. **Heuristic not calibrated** — caps make large books “strategic” quickly.
2. **Always at least 1 filled segment** even score 0 (latent still shows one bar).
3. **No TZ on relative** — uses client/server `Date.now()` environment.
4. Comment claims “never written back” — ensure no future misuse as CRM score.

---

## 2. `src/app/parties/relationship-graph.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/parties/relationship-graph.tsx` |
| **Lines** | 334 |
| **Directive** | `"use client"` |
| **Role** | Vertical node-link ownership graph (mini + full) |

### Exports + signatures

```ts
export interface RelationshipGraphProps {
  partyId: string;
  legalName: string;
  centerSub?: React.ReactNode;
  centerMark?: React.ReactNode;
  relationships: PartyPreviewRelationship[];
  variant?: "mini" | "full";
  className?: string;
}

export function RelationshipGraph(props: RelationshipGraphProps): JSX.Element
```

**Internals:** `ownershipOf`, `sortByOwnership`, `TierLabel`, `Connector`, `CenterNode`, `TierNodes`, `RelNode`.

### Business purpose

Visualize **Controlled by / Self / Controls** strata with ownership %, BO gold tags, ultimate parent caption (≥50% child-direction parent).

### Key logic

1. `direction === "child"` → parents (controlled by); `"parent"` → children (controls).
2. Sort by ownership desc then name.
3. mini max 3 nodes/tier; full max 8; `+N more` chip.
4. Ultimate parent: first parent with ownership ≥ 50%; full variant caption only.
5. Empty → EmptyState.
6. Nodes are Links to `/parties/{otherPartyId}`.

### Side effects

Navigation only.

### Security / RBAC

Shows only relationships already filtered by preview/detail query. No extra ACL.

### Coupling

`PartyPreviewRelationship` type from parties queries; EmptyState; brand icons.

### Risks / TODOs

1. **Not a true multi-hop graph** — one level only; ultimate parent is majority direct owner, not resolved group parent.
2. **Truncation** can hide material owners beyond 3/8.
3. **Direction semantics** must match backend (inverted convention would reverse tiers).
4. Client-only despite mostly presentational (Link hover).

---

## 3. `src/app/portal/client/[id]/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/portal/client/[id]/page.tsx` |
| **Lines** | 714 |
| **Directive** | None (RSC) |
| **Route** | `/portal/client/[id]` |
| **Role** | Read-only issuer/client engagement 360 |

### Exports + signatures

```ts
export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: { params: Promise<{ id: string }> })

// Local: MetaCell, DealsTable, DocumentsTable, ContactsList, KycHistoryTable
// Helpers: fmtDate, fmtDateTime, fmtBytes, kycVariant, dealStatusVariant, dealTypeLabel
```

### Imports

`requireUser`; `getClientDetail`, `PORTAL_ENUM_LABELS`; brand table/money/preview; many icons.

### Business purpose

**Client portal** (sell-side view): identity (PAN/CIN/GSTIN), KPIs (deals, active, raised, docs), issuer deals with placement %, documents (MNPI/confidential flags, **no download**), contacts, full KYC history. Explicit “Read-only” chrome.

### Key logic

1. `getClientDetail(id, user)` or notFound.
2. Identifiers filtered by type PAN / CIN / GSTIN.
3. Deals: `placedPct = min(100, allocatedCr/targetSizeCr*100)`.
4. Documents: labels for document types + KYC categories; size humanized.
5. KYC table marks first row “Latest”.

### Side effects

Auth + DB read only.

### Security / RBAC

- Read-only UI; no mutations.
- Document list surfaces MNPI/confidential badges but no file binary path.
- Visibility via `getClientDetail(user)`.

### Coupling

`@/features/portal` types: `ClientDealRow`, `ClientDocumentRow`, `ClientKycRow`, `ClientContactRow`.

### Risks / TODOs

1. **Unused imports** likely (`PageHeader`, `DetailTopBar`, `fmtDateTime` possibly unused, `Handshake` etc.) — dead code risk.
2. **Deals not linked** to `/deals/[id]`.
3. **Documents not downloadable** — intentional; ensure no accidental storage URLs later.
4. **Email/phone shown** in contacts — PII in portal; rely on RBAC.

---

## 4. `src/app/portal/client/client-directory-view.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/portal/client/client-directory-view.tsx` |
| **Lines** | 324 |
| **Directive** | `"use client"` |
| **Role** | Searchable paginated client directory |

### Exports + signatures

```ts
export interface ClientDirectoryViewProps {
  rows: ClientListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q?: string;
  summary: ClientListSummary;
}

export function ClientDirectoryView(props: ClientDirectoryViewProps): JSX.Element
```

### Business purpose

Ranked directory of **issuers Binary advises**, KPIs for matching set, debounced `?q=`, `?page=` pagination, row links to detail. No create/edit.

### Key logic

- StatCards: clients, total raised (`*1e7` for Money/currency preset), deals, avg deals/client.
- 280ms search debounce → `/portal/client?...`.
- Table columns progressive disclosure (nature/kyc/onboarding hide on small screens).
- Pagination pills client `router.push`.

### Side effects

URL navigation only.

### Security / RBAC

Server pre-filters list; client cannot expand set.

### Coupling

`ClientListItem` / `ClientListSummary` from portal feature.

### Risks / TODOs

1. **Currency unit** for raised: multiplies Cr by 1e7 before Money compact — must match query unit convention.
2. **No sort controls** — ranking is server-defined.
3. **Prev button** always shows ArrowRight icon (visual quirk).

---

## Cross-file summary (batch 043)

Party graph/signals feed both CRM parties and (conceptually) ownership hygiene; client portal is a **read-only slice** of party+deals+docs+kyc for issuer book.

### Highest-priority risks

1. Strength heuristic overconfidence if treated as analytics.
2. Graph single-level only.
3. Portal PII + MNPI visibility depends entirely on query scoping.
4. Dead imports on large client detail page.

---

*End of agent-043 analysis.*
