# File-by-file analysis — agent-032

**Batch:** `batch-032.list`  
**Workspace root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4 (leads board + new lead form/page + list page)

---

## 1. `src/app/leads/leads-board-view.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/leads/leads-board-view.tsx` |
| **Lines** | 897 |
| **Directive** | `"use client"` |
| **Role** | Lead & Opportunity kanban + conversion analytics dashboard. |

### Exports

```ts
export interface LeadsBoardViewProps {
  groups: LeadPipelineGroup[];
  analytics: ConversionAnalytics;
  rms: RmOption[];
}
export function LeadsBoardView(props: LeadsBoardViewProps): JSX.Element
```

Internal: DealTypeDisc, RmAvatar, ProbabilityBar, BantDots, LeadCard, AnalyticsDashboard, BreakdownCard, FilterSelect, KanbanColumn, helpers.

### Imports

- framer-motion, recharts BarChart, phosphor
- brand: Badge, Card, CommandBar, EmptyState, StatCard, compactINR, buttonVariants, chart-theme
- lead-icons + **types only from `@/features/leads/types`**
- type-only from queries: LeadPipelineGroup, LeadRow, RmOption, ConversionAnalytics

### Business purpose

Pipeline New→Qualified→Opportunity→Won/Lost. Filters source/deal type/RM + search. Cards link `/leads/{partyId}`. Analytics: open count, pipeline ₹ Cr, conversion %, won value; charts over time + by source/type/RM. Load-more per column (20) to avoid multi-MB SSR of fat “new” stage.

### Key logic

- Client filter/regroup after server full groups.
- `LEAD_VISIBLE_INCREMENT = 20`; visiblePerColumn state.
- Mount-based motion (initial→animate), not whileInView — headless screenshot rule.
- Probability bar scaleX; overdue close dates text-down.
- Empty/filter empty states with New lead CTA.

### Side effects

None (presentation of server props). Navigation via Link.

### Security / RBAC

Data already scoped at query layer; board does not re-check.

### Coupling

Leads queries types + types constants; `/leads/new`, `/leads/[id]`.

### Risks / TODOs

- Full pipeline still transferred to client even if only 20 cards painted per column.
- Analytics not re-filtered when client filters board (KPIs are global).
- Hardcoded deal type list in FilterSelect must track LEAD_DEAL_TYPE_ORDER.

---

## 2. `src/app/leads/new/new-lead-form.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/leads/new/new-lead-form.tsx` |
| **Lines** | 566 |
| **Directive** | `"use client"` |
| **Role** | Lead capture form: new company or link existing relationship. |

### Exports

```ts
export function NewLeadForm({
  rms,
  parties,
}: {
  rms: { userId: string; name: string }[];
  parties: { partyId: string; legalName: string }[];
}): JSX.Element
```

### Imports

`createLead` action; types labels/orders from types (not barrel); lead-icons; brand Card/Button etc.

### Business purpose

Capture prospect into qualification funnel. Mode `new` creates prospect party + lead_meta; `existing` stamps lead_meta on existing party. Deal-type icon grid (12 service lines); source/size/close/RM/contact/notes.

### Key logic

- Live “Will appear as” preview.
- Hidden `mode`, `dealType`; required company or linkPartyId.
- Submit disabled if new name <2 chars or no link.
- createLead redirects to lead workspace on success.

### Side effects

Server action createLead.

### Security / RBAC

createLead permission; parties list pre-filtered by page.

### Coupling

Leads actions; parties list from parent.

### Risks

- Existing-party mode may re-lead an already-lead party — server must reject.
- Est size max 50000 Cr client-only.

---

## 3. `src/app/leads/new/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/leads/new/page.tsx` |
| **Lines** | 49 |
| **Directive** | RSC |
| **Role** | New lead page: load RMs + parties, render form. |

### Exports

```ts
export const dynamic = "force-dynamic";
export const metadata = { title: "New lead · Binary Capital CRM" };
export default async function NewLeadPage(): Promise<JSX.Element>
```

### Key logic

`requireUser`; parallel `listRms`, `listParties({ pageSize: 300, user })`; filter parties: keep if status !== onboarding OR partyNature organization; pass to form.

### Security

Auth + scoped parties.

### Risks

- Filter excludes some onboarding non-org parties from “existing” picker.
- DetailTopBar imported? (not in imports list — clean).

---

## 4. `src/app/leads/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/leads/page.tsx` |
| **Lines** | 40 |
| **Directive** | RSC |
| **Role** | Leads pipeline index. |

### Exports

```ts
export const dynamic = "force-dynamic";
export const metadata = { title: "Leads & Opportunities · Binary Capital CRM" };
export default async function LeadsPage(): Promise<JSX.Element>
```

### Key logic

`requireUser`; Promise.all `getLeadsPipeline`, `getConversionAnalytics`, `listRms`; render LeadsBoardView **without** whileInView Reveal wrapper (board has own mount motion).

### Coupling

Leads queries; board view.

### Risks

Heavy concurrent queries on large books.

---

## Cross-file architecture (batch 032)

```
/leads → pipeline+analytics+rms → LeadsBoardView
/leads/new → rms+parties → NewLeadForm → createLead → /leads/[id]
```

**Party-centric leads** (lead_meta on party).  
**Mutation boundary** createLead only on new form.

*End of agent-032 analysis.*
