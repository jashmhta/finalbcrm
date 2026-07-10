# File-by-file analysis — agent-031

**Batch:** `batch-031.list`  
**Workspace root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4 (root layout + lead detail: BANT, workflow actions, page)

---

## 1. `src/app/layout.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/layout.tsx` |
| **Lines** | 147 |
| **Directive** | RSC root layout |
| **Role** | App shell: fonts, metadata, theme, nav, page transition, toaster, session. |

### Exports

```ts
export const metadata: Metadata
export const viewport: Viewport
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<JSX.Element>
```

### Imports

Geist/Geist_Mono, globals.css, ThemeProvider, SiteNav, Toaster, PageTransition, `auth` from `@/lib/auth`.

### Business purpose

Binary CRM chrome for Binary Capital Advisors LLP + Binary Bonds. Dual-brand product described in metadata. Sidebar width CSS var (`--sidebar-w` 16rem) shared by nav and body padding; no-flash script reads `localStorage.sidebar-collapsed` pre-hydration.

### Key logic

1. `await auth()` for session → pass user email/name/roles to SiteNav (null on login).
2. Theme forced light (`forcedTheme="light"`, `enableSystem={false}`).
3. Skip-to-content a11y link; main `#main-content` with PageTransition.
4. OpenGraph/Twitter use `/logo.png` and `NEXT_PUBLIC_SITE_URL` default `https://binarycapital.in`.

### Side effects

- Auth JWT cookie decode on every layout render → entire app dynamic.
- Inline script mutates CSS var from localStorage.

### Security / RBAC

- Layout does **not** enforce auth (proxy does coarse gate).
- Session user roles exposed to SiteNav client for menu visibility only.
- `suppressHydrationWarning` on html for theme/sidebar.

### Coupling

All pages; brand theme; Auth.js.

### Risks / TODOs

- Forced light theme disables dark mode permanently for now.
- Sidebar script in body is string-eval (standard next-themes pattern).
- Layout always dynamic — no static marketing shell.

---

## 2. `src/app/leads/[id]/bant-checklist.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/leads/[id]/bant-checklist.tsx` |
| **Lines** | 297 |
| **Directive** | `"use client"` |
| **Role** | BANT qualification toggle chips (Budget/Authority/Need/Timeline). |

### Exports

```ts
export function BantChecklist({
  partyId,
  initialBant,
  readOnly,
}: {
  partyId: string;
  initialBant: BantQualification;
  readOnly?: boolean;
}): JSX.Element
```

Internal: ChipToggle, BantRing.

### Imports

- `updateBant` from `@/features/leads/actions`
- Types/constants from `@/features/leads/types` **not** feature barrel (postgres/tls client bundle guard)
- Phosphor, framer-motion, cn

### Business purpose

Qualification checklist: each criterion form posts partyId+criterion; action toggles from DB state and auto-promotes fully-qualified `new` → `qualified`. Progress ring + Qualified banner.

### Key logic

1. Optimistic local bant + sync from `initialBant` on revalidate.
2. Per-criterion **separate forms** — React 19 strips `name` on formAction buttons; hidden inputs as form siblings.
3. Value not sent — server toggles authoritative state.
4. readOnly for won/lost; pending disables toggles.

### Side effects

Server action updateBant → revalidate lead page.

### Security / RBAC

Permission in action; UI readOnly for closed.

### Coupling

Leads actions/types; lead detail page.

### Risks

Optimistic UI can desync if action fails after toggle (partial: error shown, local may still flipped until effect resync — effect only on initialBant change, not on error rollback).

---

## 3. `src/app/leads/[id]/lead-workflow-actions.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/leads/[id]/lead-workflow-actions.tsx` |
| **Lines** | 416 |
| **Directive** | `"use client"` |
| **Role** | Lead conversion/close/delete/note mutation UI. |

### Exports

```ts
export function ConvertToOpportunity({ partyId, qualified, isClosed, isOpportunity, rms })
export function WinLeadButton({ partyId, eligible, alreadyWon })
export function LoseLeadButton({ partyId, eligible })
export function DeleteLeadButton({ partyId })
export function AddNoteForm({ partyId })
export function LossReasonBadge({ reason })
```

### Imports

Actions: `convertToOpportunity`, `winLead`, `loseLead`, `deleteLead`, `addLeadNote` + state types.  
Types: `LEAD_LOSS_REASONS`, labels — from `./types` deep import.

### Business purpose

Funnel workflow: qualified → opportunity (prob/close/RM) → win creates deal mandate → lose with reason → stop tracking clears lead_meta (party remains) → notes as outbound interactions.

### Key logic

- Convert gated UI on `qualified`; server re-checks.
- Win shows link to `/deals/{dealId}` on success.
- Lose requires lossReason select.
- Delete armed two-step confirm.
- Note maxLength 20000; body required.

### Side effects

Server actions + revalidation/redirects in feature layer.

### Security / RBAC

Actions enforce can(); destructive delete needs arming only (no password).

### Coupling

Leads feature; deal creation on win; interaction log on note.

### Risks

- Win eligible when opportunity OR qualified — can skip convert step.
- No brand scoping visible in UI.

---

## 4. `src/app/leads/[id]/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/leads/[id]/page.tsx` |
| **Lines** | 822 |
| **Directive** | RSC |
| **Role** | Lead workspace: KPIs, BANT, convert/close, contact, activity tables. |

### Exports

```ts
export const dynamic = "force-dynamic";
export default async function LeadDetailPage({
  params,
}: { params: Promise<{ id: string }> }): Promise<JSX.Element>
```

Helpers: fmtDate/fmtDateTime (Asia/Kolkata), relativeClose, bytes, dealTypeTone (server-safe mirror of client lead-icons), Row, Target4, cnT.

### Imports

- `getLeadDetail`, `listRms`, `listDocuments`
- leads types/labels/isQualified/bantScore from barrel (server-safe path)
- brand components; icons via `@/components/brand/icons` (Phosphor RSC rule)
- BantChecklist + workflow action components

### Business purpose

Party-centric lead: stage strip, won→Open mandate, KPIs (size/prob/BANT/RM), BANT checklist, convert & close, notes, profile, contact, stop tracking, interactions/tasks/documents tables (MNPI flags).

### Key logic

1. Parallel: getLeadDetail, listRms, listDocuments(partyId).
2. notFound if no lead.
3. Stages drive badge/ambient/actions eligibility.
4. Documents from documents feature; interactions/tasks from lead detail aggregate.

### Side effects

DB reads only on page; mutations via client islands.

### Security / RBAC

- requireUser + getLeadDetail user scope.
- MNPI shown as gold label (visibility of MNPI fields depends on query).

### Coupling

Leads/documents features; party activity graph.

### Risks / TODOs

- Interaction rows not linked to interaction detail.
- Target4 inline SVG vs phosphor Target elsewhere.
- Import DetailTopBar unused patterns similar elsewhere.

---

## Cross-file notes (batch 031)

- **Root layout** dual-brand metadata + forced light + sessioned nav.
- **Lead detail** = party-id keyed workspace (lead_meta on party).
- **Client import discipline** critical (types vs barrel).
- **Mutation boundary:** all write via server actions with useActionState.

*End of agent-031 analysis.*
