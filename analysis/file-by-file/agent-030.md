# Agent 030 — File-by-file analysis

**Batch:** `batch-030.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope note:** Paths are relative to app root. Docs ignored per instructions. Related modules (`@/features/interactions/*`, `@/lib/rbac`) consulted only for coupling/context (not listed in batch).

---

## 1. `src/app/interactions/[id]/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/interactions/[id]/page.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/interactions/[id]/page.tsx` |
| **Lines** | 352 |
| **Directive** | None (Server Component by default) |
| **Route** | `/interactions/[id]` — dynamic interaction detail |
| **Role** | Server-rendered detail page for a single engagement-log row: header meta, party/deal/contact anchors, follow-up, free-text notes, attendee table |

### Exports

```ts
export const dynamic = "force-dynamic";

export default async function InteractionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element>
```

**Internal (non-exported) components:**

| Name | Signature | Purpose |
|------|-----------|---------|
| `MetaItem` | `({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode })` | Meta-rail cell (icon + uppercase label + value) |
| `AnchorRow` | `({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode })` | Anchors card row (icon + label left, value right) |

**Module-level constant:**

```ts
const CHANNEL_ICON: Record<string, React.ReactNode> = {
  meeting: <ChatCircle weight="light" className="size-4" />,
  call: <Phone weight="light" className="size-4" />,
  email: <EnvelopeSimple weight="light" className="size-4" />,
  whatsapp: <WhatsappLogo weight="light" className="size-4" />,
  rfq: <ArrowsLeftRight weight="light" className="size-4" />,
  ndsom_chat: <Chats weight="light" className="size-4" />,
  site_visit: <Handshake weight="light" className="size-4" />,
  management_presentation: <PresentationChart weight="light" className="size-4" />,
};
```

### Imports

| Source | Symbols |
|--------|---------|
| `next/link` | `Link` |
| `next/navigation` | `notFound` |
| `@/components/brand/icons` | `ArrowLeft`, `ArrowUpRight`, `ChatCircle`, `Phone`, `EnvelopeSimple`, `WhatsappLogo`, `ArrowsLeftRight`, `PresentationChart`, `Handshake`, `Chats`, `SealWarning`, `Clock`, `Users`, `CalendarBlank`, `Buildings`, `User`, `Sparkle`, `ArrowRight` |
| `@/lib/rbac` | `requireUser` |
| `@/features/interactions/queries` | `getInteractionDetail` |
| `@/components/brand` | `Card`, `Badge`, `Button`, `Reveal`, `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`, `TableEmpty` |
| `@/components/brand/text` | `Eyebrow`, `SectionHeading` |
| `@/components/brand/money` | `Num` |
| `@/components/brand/page-shell` | `PageShell`, `PageHeader`, `DetailTopBar` |

**Note:** `PageHeader` and `DetailTopBar` are imported but **never used** in this file (dead imports).

**Referenced external type (`InteractionDetail` from `@/features/interactions/queries`):**

```ts
export interface InteractionDetail {
  interaction: typeof interaction.$inferSelect; // full Drizzle row
  partyName: string | null;
  dealCode: string | null;
  dealName: string | null;
  contactName: string | null;
  primaryContactName: string | null;
  attendees: InteractionAttendeeRow[];
}

export interface InteractionAttendeeRow {
  interactionAttendeeId: string;
  contactId: string;
  contactName: string;
  roleAtMeeting: string | null;
}
```

**Fields of `detail.interaction` used in this file (subset of full row):**

| Field | Usage |
|-------|--------|
| `interactionId` | Breadcrumb short id (`slice(0, 8)`) |
| `channel` | Eyebrow + meta rail + icon lookup |
| `subject` | Title (fallback `"(no subject)"`) |
| `occurredAt` | Locale-formatted occurred time (`en-IN`, medium date + short time) |
| `durationMin` | Duration meta (`Num` + `" min"`) |
| `barrierId` | Optional barrier meta (truncated UUID) |
| `partyId` | Party link `/parties/${partyId}` |
| `nextAction` | Follow-up card body |
| `body` | Notes card (`whitespace-pre-wrap`) |

Also uses joined names: `partyName`, `dealCode`, `dealName`, `contactName`, `primaryContactName`, and `attendees[]`.

### Business purpose

Read-only **engagement thread detail** for Binary CRM’s interaction log (DATA_MODEL §2.18 conceptually):

1. Identify the interaction (subject, channel, when, how long, attendee count, optional info barrier).
2. Show **anchors** — party (navigable), deal (code + name), contact, primary contact.
3. Surface **follow-up** (`nextAction`) with a soft affordance to open `/tasks` (“Track as task” — navigation only, no task create).
4. Render free-text **notes** (`body`) when present.
5. List **attendees** (contact name + role-at-meeting badge).

Supports compliance-adjacent visibility (barrier id when set) and relationship-management memory (who was in the room, what was said, what’s next).

### Key logic

**Auth + load:**

```ts
const user = await requireUser();
const { id } = await params; // Next.js 15+ Promise params
const detail = await getInteractionDetail(id, user);
if (!detail) notFound();
```

- `requireUser()` gates unauthenticated access (redirect/throw per `@/lib/rbac`).
- `getInteractionDetail` applies soft-delete filter + `interactionVisibilityClause(user)` (app-layer scoping).
- Missing / invisible rows → HTTP 404 via `notFound()`.

**Date formatting:**

```ts
const occurred = i.occurredAt
  ? i.occurredAt.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    })
  : null;
```

**Layout structure:**

1. Breadcrumb: `/interactions` ← short id + “All interactions” button.
2. Header `Card`: `SectionHeading` (display) with channel eyebrow + subject; meta rail (Channel, Occurred, Duration, Attendees, optional Barrier).
3. Two-column grid (`md:grid-cols-2`): Anchors card | Follow-up card.
4. Conditional Notes card if `i.body`.
5. Attendees table card (always rendered; empty → `TableEmpty`).

**Attendee row key:** `a.interactionAttendeeId`.

**Role badge:** `a.roleAtMeeting.replace(/_/g, " ")` inside `Badge variant="neutral"`.

**Channel icon fallback:** `CHANNEL_ICON[i.channel ?? ""] ?? <Chats …>`.

**Deal link:** always `href="/deals"` (list), **not** a deal-detail deep link — even when `dealCode` is present.

**Contact / primary:** plain text only (no `/contacts/...` links).

### Side effects

| Effect | Mechanism |
|--------|-----------|
| Auth session read | `requireUser()` |
| DB read | `getInteractionDetail(id, user)` (server-side) |
| 404 navigation | `notFound()` when null |
| No mutations | Pure GET render; no forms, no server actions, no `revalidatePath` |

`export const dynamic = "force-dynamic"` forces per-request render (no static prerender of DB-backed detail).

### Security / RBAC

| Layer | Behavior |
|-------|----------|
| **Auth** | `requireUser()` — must be logged in |
| **Read scope** | Delegated to `getInteractionDetail(…, user)` → `interactionVisibilityClause` (owner of interaction, party assignee/owner/creator, deal lead/analyst/creator, contact creator / party_contact scope). Admins / `read_all` on `interaction` / `manage` user bypass scope |
| **MNPI / walls** | UI shows `barrierId` truncated when set; does **not** surface an explicit `containsMnpi` badge. Wall enforcement is expected in DB/RLS/`withRls` paths (queries comment: RLS-aware once policies migrated; until then plain queries) |
| **IDOR mitigation** | Out-of-scope IDs return `null` → 404 (no leak of existence beyond timing) if visibility clause is correct |
| **XSS** | React text interpolation for subject/body/names; `whitespace-pre-wrap` on body only (no `dangerouslySetInnerHTML`) |
| **PII / sensitive notes** | Full body, contact names, deal codes rendered to any authorized viewer of the row — body may contain MNPI when `containsMnpi` was set at create |

No page-level `can(user, "read", "interaction")` check beyond `requireUser` + query visibility.

### Coupling

| Direction | Target |
|-----------|--------|
| **Strong** | `@/features/interactions/queries.getInteractionDetail` + `InteractionDetail` / attendee shape |
| **Strong** | `@/lib/rbac.requireUser` → `CrmUser` passed into query |
| **Strong** | Brand UI (`PageShell`, `Card`, `Table*`, `Reveal`, `SectionHeading`, icons) |
| **Nav** | `/interactions`, `/parties/${partyId}`, `/deals`, `/tasks` |
| **Weak** | Channel enum strings mirrored from product domain (`meeting`, `call`, …) — local icon map, not imported from schema enums |
| **Dead** | Unused `PageHeader`, `DetailTopBar` imports |

Does **not** import `@/db` directly.

### Risks / TODOs

1. **Unused imports:** `PageHeader`, `DetailTopBar` — lint noise / incomplete refactor from a shared detail shell.
2. **No `containsMnpi` badge** on detail despite list view highlighting MNPI — compliance UX gap.
3. **Deal deep-link missing:** deal always goes to `/deals` list, not a deal detail route (if one exists elsewhere).
4. **Contact not navigable** (name-only); `contactId` available on attendees but not linked.
5. **“Track as task”** is a naked link to `/tasks` with no prefill of subject/nextAction/interactionId — incomplete workflow.
6. **`React.ReactNode` types** used without `import React` / `import type { ReactNode }` — relies on global JSX namespace config; may fail under stricter TS settings.
7. **Barrier display** shows only first 8 chars of UUID — weak for ops correlation without full copy/link to barrier entity.
8. **No edit UI** on detail page (update action exists in `features/interactions/actions.ts` as `updateInteraction` but is not wired here).
9. **No audit / creator** display (`userId`, createdAt not shown).
10. **Direction** (`inbound`/`outbound`) not shown on detail (shown on list).

---

## 2. `src/app/interactions/interactions-list-view.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/interactions/interactions-list-view.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/interactions/interactions-list-view.tsx` |
| **Lines** | 462 |
| **Directive** | `"use client"` |
| **Role** | Client view layer for the interactions timeline: command bar (search, MNPI toggle, density), double-bezel table, pagination pills, export + “Log interaction” entry points |

### Exports

```ts
export interface InteractionsListViewProps {
  rows: InteractionListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q?: string;
  mnpiOnly: boolean;
}

export function InteractionsListView({
  rows,
  total,
  page,
  pageSize,
  totalPages,
  q,
  mnpiOnly,
}: InteractionsListViewProps): JSX.Element
```

**Internal (non-exported):**

| Name | Signature | Purpose |
|------|-----------|---------|
| `formatOccurredAt` | `(value: Date \| null) => string` | `en-IN` short datetime or `"-"` |
| `Pagination` | `({ page, totalPages, q, mnpiOnly }: { page: number; totalPages: number; q?: string; mnpiOnly: boolean })` | Prev/next + windowed page pills |
| `PagePill` | `({ href, active, children }: { href: string; active: boolean; children: React.ReactNode })` | Circular page link |
| `CHANNEL_ICON` | `Record<string, React.ReactNode>` | Channel → icon (size-3.5) |

### Imports

| Source | Symbols |
|--------|---------|
| `react` | `* as React` |
| `next/link` | `Link` |
| `next/navigation` | `useRouter`, `usePathname`, `useSearchParams` |
| `@phosphor-icons/react` | `ArrowLeft`, `ArrowRight`, `ChatCircle`, `Phone`, `EnvelopeSimple`, `WhatsappLogo`, `ArrowsLeftRight`, `PresentationChart`, `Handshake`, `Chats`, `Sparkle`, `SealWarning`, `Clock`, `Users` |
| `@/lib/utils` | `cn` |
| `@/features/interactions/queries` | type `InteractionListItem` |
| `@/components/brand` | `Card`, `Badge`, `Button`, `CommandBar`, `Reveal`, `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`, `TableEmpty`, type `Density` |
| `@/components/brand/money` | `Num` |
| `@/features/reports/export-button` | `ExportCsvButton` |
| `./new-interaction-dialog` | `NewInteractionDialog` |

**Referenced type (`InteractionListItem`):**

```ts
export interface InteractionListItem {
  interactionId: string;
  subject: string | null;
  channel: string | null;
  direction: string | null;
  occurredAt: Date | null;
  durationMin: number | null;
  containsMnpi: boolean;
  partyId: string | null;
  partyName: string | null;
  dealId: string | null;
  dealCode: string | null;
  contactId: string | null;
  contactName: string | null;
  attendeeCount: number;
  nextAction: string | null;
}
```

### Business purpose

Operational **timeline UI** for relationship engagement:

- Browse meetings/calls/email/WhatsApp/etc. newest-first (ordering owned by server query).
- **Search** subjects/body/nextAction/anchors (server-side via `q` URL param).
- **MNPI-only filter** for compliance review of walled interactions.
- Jump to interaction detail, party, deals list.
- Export CSV of interactions (report feature).
- Open create dialog (`NewInteractionDialog`).

Comment in file: *“Search + MNPI stay URL-driven (shareable); density is pure client state.”*

### Key logic

**Local state:**

```ts
const [density, setDensity] = React.useState<Density>("comfortable");
const [search, setSearch] = React.useState(q ?? "");
// sync when server q changes
React.useEffect(() => { setSearch(q ?? ""); }, [q]);
```

**Debounced search → URL (280ms):**

```ts
const pushSearch = (value: string) => {
  const params = new URLSearchParams(sp.toString());
  if (value.trim()) params.set("q", value.trim());
  else params.delete("q");
  params.delete("page"); // reset page on new search
  router.replace(qs ? `${pathname}?${qs}` : pathname);
};
// onSearchChange: setSearch + debounce pushSearch
// cleanup clears debounce timer on unmount
```

**MNPI toggle href:**

```ts
function mnpiHref(on: boolean) {
  const params = new URLSearchParams(sp.toString());
  if (on) params.set("mnpi", "1");
  else params.delete("mnpi");
  params.delete("page");
  return qs ? `${pathname}?${qs}` : pathname;
}
```

Rendered as `Button asChild` + `Link href={mnpiHref(!mnpiOnly)}` — full navigation (not soft client filter).

**Range labels:**

```ts
const rangeFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
const rangeTo = Math.min(page * pageSize, total);
```

**Table columns:**

| Column | Visibility | Content |
|--------|------------|---------|
| Occurred | always | `formatOccurredAt(r.occurredAt)` |
| Subject | always | Link to `/interactions/${id}`; subline `Next: {nextAction}` if set |
| Channel | `hidden md:table-cell` | Icon + channel label + optional direction uppercase |
| Anchor | `hidden md:table-cell` | Party link, deal code link → `/deals`, contact name text |
| Attendees | `hidden md:table-cell` right | Users icon + `Num` count |
| Flags | always right | MNPI `Badge variant="down"`; duration `Nm` |

**Empty states:**

- `total === 0`: “The log is quiet - for now.” + first-log hint.
- Filtered empty: “No interactions match this view.” + clear MNPI / refine search.

**Pagination:**

```ts
const pageHref = (p: number) =>
  `/interactions?${new URLSearchParams({
    ...(q ? { q } : {}),
    ...(mnpiOnly ? { mnpi: "1" } : {}),
    page: String(p),
  }).toString()}`;
```

Window: `page ± 1`, with first/last + ellipsis. Prev/next use `aria-disabled` + CSS `pointer-events-none opacity-40` (links still in DOM).

**Only renders Pagination when `totalPages > 1`.**

### Side effects

| Effect | Mechanism |
|--------|-----------|
| URL replace on search | `router.replace` via debounced `pushSearch` |
| URL navigation on MNPI / pages | Next `Link` full navigation |
| CSV export | `ExportCsvButton type="interactions"` (child feature) |
| Create interaction | `NewInteractionDialog` → server action (on submit) |
| Client-only | density, controlled search string, debounce timer |

No direct DB access from this file.

### Security / RBAC

- **Presentation-only.** Row set is already filtered by the parent server page via `listInteractions({ user, … })`.
- Client cannot expand visibility by changing URL alone beyond what server re-queries (search/MNPI/page still pass through server on navigation).
- **MNPI rows** are fully visible in the list (subject, nextAction snippet, party names) when the user can read them — filter is convenience, not a wall.
- **Search debounce** uses client-side URL; no secrets in client state beyond props already granted.
- Export button inherits report-feature auth (not enforced in this file).

### Coupling

| Coupling | Detail |
|----------|--------|
| Strong | Parent `page.tsx` prop contract (`InteractionsListViewProps`) |
| Strong | type `InteractionListItem` from queries |
| Strong | `./new-interaction-dialog` |
| Medium | `@/features/reports/export-button` (`type="interactions"`) |
| Medium | Next App Router searchParams conventions: `q`, `mnpi=1`, `page` |
| UI | Brand CommandBar / Table / Badge / density system |
| Parallel | Duplicates channel icon map with detail page (not shared module) |

**Does not import** server actions or `@/db`.

### Risks / TODOs

1. **Channel icon map duplicated** with `[id]/page.tsx` — drift risk if new channels added only in one place.
2. **Deal link** uses `/deals` not deal detail; `dealId` on row unused for href.
3. **Contact** never linked despite `contactId` on row.
4. **Pagination `pageHref` hardcodes** `/interactions` path (does not use `pathname`) — breaks if route ever nested/rewritten.
5. **Search debounce + URL replace** can race with fast typing / browser back; effect resets `search` from `q` which is correct but may feel jumpy.
6. **Disabled prev/next still expose `href`** to adjacent pages; `pointer-events-none` only — keyboard focus may still hit them depending on browser (mitigated somewhat by `aria-disabled`).
7. **Direction** shown raw (`inbound`/`outbound`) without pretty label beyond CSS uppercase.
8. **No channel/direction filters in UI** though `InteractionListFilters` supports `channel` / `direction` server-side — product gap.
9. **Body content not shown** in list (good) but server search still matches `body` — users may get “match” rows whose hit is invisible.
10. **Date serialization:** `occurredAt` as `Date` over RSC boundary — depends on Next serialization (typically ISO string rehydrated); if plain string, `toLocaleString` may still work as Date constructor isn’t used — if it arrives as string, `Date` methods fail unless Next revives Dates. Worth verifying runtime (common Next RSC pitfall).
11. **Phosphor vs brand icons:** list uses `@phosphor-icons/react` directly; detail uses `@/components/brand/icons` — inconsistency.

---

## 3. `src/app/interactions/new-interaction-dialog.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/interactions/new-interaction-dialog.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/interactions/new-interaction-dialog.tsx` |
| **Lines** | 488 |
| **Directive** | `"use client"` |
| **Role** | Modal form to create an interaction + attendee junction rows via `createInteraction` server action (`useActionState`) |

### Exports

```ts
export function NewInteractionDialog(): JSX.Element
```

**Internal (non-exported):**

| Name | Signature | Purpose |
|------|-----------|---------|
| `Attendee` | `{ contactId: string; name: string; roleAtMeeting: string }` | Client attendee draft |
| `Field` | `({ label, htmlFor?, required?, hint?, children })` | Label + optional required/hint |
| `BezelInput` | `React.InputHTMLAttributes<HTMLInputElement>` | Double-bezel text/number/datetime input |
| `BezelTextarea` | `React.TextareaHTMLAttributes<HTMLTextAreaElement>` | Double-bezel textarea |
| `BezelSelect` | `({ id?, name?, value, onChange, options: readonly string[] })` | Controlled native select + optional hidden `name` mirror |

**Module constants (mirrored from server action enums):**

```ts
const CHANNELS = [
  "meeting", "call", "email", "whatsapp", "rfq",
  "ndsom_chat", "site_visit", "management_presentation",
] as const;

const DIRECTIONS = ["inbound", "outbound"] as const;

const ATTENDEE_ROLES = [
  "host", "chair", "presenter", "issuer_side", "investor_side",
  "advisor", "observer", "other",
] as const;
```

### Imports

| Source | Symbols |
|--------|---------|
| `react` | `* as React`, `useActionState` |
| `@/components/ui/dialog` | `Dialog`, `DialogContent`, `DialogDescription`, `DialogTitle`, `DialogTrigger`, `DialogClose` |
| `@phosphor-icons/react` | `X`, `Plus`, `ArrowRight`, `CircleNotch`, `SealWarning`, `Users`, `ArrowFatDown` |
| `@/lib/utils` | `cn` |
| `@/components/brand/button` | `Button` |
| `@/components/brand/text` | `Eyebrow` |
| `@/features/interactions/actions` | `createInteraction`, type `CreateInteractionState` |

**Referenced types / action:**

```ts
export type CreateInteractionState = { error?: string } | undefined;

export async function createInteraction(
  _prev: CreateInteractionState,
  formData: FormData,
): Promise<CreateInteractionState>
```

Server-side schema (for field contract; not imported in this file):

```ts
// createInteractionSchema (zod) — features/interactions/actions.ts
{
  subject?: string max 300,
  body?: string max 20_000,
  channel?: enum CHANNELS,
  direction?: enum DIRECTIONS,
  occurredAt?: z.iso.datetime(),
  durationMin?: int nonnegative max 10_000,
  partyId?: uuid,
  dealId?: uuid,
  contactId?: uuid,
  primaryContactId?: uuid,
  containsMnpi: boolean default false,
  barrierId?: uuid,
  nextAction?: string max 500,
  attendees: { contactId: uuid; roleAtMeeting?: enum ATTENDEE_ROLES }[] max 50,
}
// Business rule: at least one of partyId | dealId | contactId required
```

### Business purpose

Capture a new **engagement log entry** from the interactions list (and any parent that mounts the dialog):

1. Subject, channel, direction, occurred-at, duration.
2. Anchor UUIDs: party / deal / contact (raw text; “must anchor to ≥1”).
3. Free-text notes + next action.
4. Optional attendee list (contact UUID + role).
5. **Contains MNPI** checkbox — flags interaction for walling (“Walls this interaction from trading desks”).

On success, server action redirects to `/interactions/${interactionId}` (dialog itself does not handle success navigation).

Comment: *“zod validation + action are untouched - only the VIEW changed.”*

### Key logic

**Action binding:**

```ts
const [state, action, pending] = useActionState<CreateInteractionState, FormData>(
  createInteraction,
  undefined,
);
```

**Local state:**

| State | Default | Role |
|-------|---------|------|
| `open` | `false` | Dialog open |
| `channel` | `"meeting"` | Controlled select → hidden `name="channel"` |
| `direction` | `"outbound"` | Controlled select → hidden `name="direction"` |
| `attendees` | `[]` | Client-accumulated list |
| `attendeeContactId` | `""` | Draft contact uuid (not named form field) |
| `attendeeRole` | `"observer"` | Draft role (`name="attendeeRole"` hidden exists but is **not** part of create schema — only used for draft) |

**Add attendee:**

```ts
function addAttendee() {
  if (!attendeeContactId) return;
  if (attendees.some((a) => a.contactId === attendeeContactId)) return; // dedupe
  setAttendees((prev) => [
    ...prev,
    { contactId: attendeeContactId, name: "-", roleAtMeeting: attendeeRole },
  ]);
  setAttendeeContactId("");
}
```

**Serialize attendees for form:**

```tsx
<input
  type="hidden"
  name="attendees"
  value={JSON.stringify(
    attendees.map(({ contactId, roleAtMeeting }) => ({
      contactId,
      roleAtMeeting,
    })),
  )}
/>
```

**Form fields submitted (named):**

| `name` | Control | Notes |
|--------|---------|-------|
| `subject` | BezelInput | optional |
| `channel` | BezelSelect hidden mirror | enum |
| `direction` | BezelSelect hidden mirror | enum |
| `occurredAt` | `type="datetime-local"` | **format concern** vs `z.iso.datetime()` |
| `durationMin` | `type="number" min={0}` | |
| `partyId` | text uuid | |
| `dealId` | text uuid | |
| `contactId` | text uuid | |
| `body` | textarea | |
| `nextAction` | text | |
| `attendees` | hidden JSON | |
| `containsMnpi` | checkbox | server maps `=== "on"` |

**Not in form UI:** `primaryContactId`, `barrierId` (server accepts them but UI never collects them).

**BezelSelect pattern:** native `<select>` is controlled without `name`; sibling `<input type="hidden" name={name} value={value} />` carries form value when `name` provided. Attendee-role select passes `name="attendeeRole"` unnecessarily (extra field ignored by server parser).

**Error UI:** `state?.error` with `role="alert"`.

**Submit button:** disabled while `pending`; spinner + “Logging…”.

**Dialog chrome:** double-bezel (outer floating ring + `bezel-hi` surface), max width 600px, max height 90vh scroll.

### Side effects

| Effect | Mechanism |
|--------|-----------|
| Create interaction + attendees | Form `action={createInteraction}` → server: `requireUser`, `can(user,"create","interaction")`, zod parse, `withRls` insert `interaction` + `interaction_attendee`, `revalidatePath("/interactions")`, `redirect(/interactions/:id)` |
| UI-only | Dialog open, channel/direction/attendee drafts |

On success, redirect unmounts page context; dialog does not reset state on reopen after cancel (state may linger until remount).

### Security / RBAC

- **Authorization is server-side only** (`can(user, "create", "interaction")` in action). Dialog shows for anyone who can load the list page; unauthorized submit returns error string.
- **UUID anchors** free-typed — no client proof of access to party/deal/contact. Server inserts FKs; integrity depends on FK constraints + RLS (`withRls` with `user.wall`). Risk: create referencing entities outside wall if RLS incomplete.
- **Attendee contactIds** same risk — no existence/permission check in UI.
- **MNPI checkbox** is user-asserted only; no forced barrierId linkage in UI when MNPI checked.
- **No CSRF surface beyond Next server actions** standard protections.
- **Client-side validation minimal** — empty anchors allowed until server rejects; no UUID format check before add-attendee.
- Errors returned as plain strings (safe for React text).

### Coupling

| Coupling | Detail |
|----------|--------|
| Strong | `@/features/interactions/actions.createInteraction` FormData contract |
| Strong | Enum lists must stay in sync with action `CHANNELS` / `DIRECTIONS` / `ATTENDEE_ROLES` (triplicated: action + this dialog + icon maps) |
| Medium | Dialog primitive from `@/components/ui/dialog` (render-prop `DialogTrigger` / `DialogClose`) |
| Medium | Parent list mounts component without props |
| Weak | Queries export `PartyOption` / `DealOption` / `ContactOption` for pickers — **not used** here (raw UUID UX instead) |

### Risks / TODOs

1. **`datetime-local` vs `z.iso.datetime()`:** HTML `datetime-local` yields values like `2026-07-09T14:30` (no timezone / often no seconds). Zod `z.iso.datetime()` typically requires full ISO-8601 with timezone — **likely validation failures** for occurred-at unless server normalizes (parser passes string through unchanged). High-priority product bug risk.
2. **Raw UUID UX** for party/deal/contact/attendees — operators cannot practically log without copy-pasting IDs; options queries exist but unused.
3. **Attendee `name` always `"-"`** — list in dialog shows contactId only; no resolve-to-name.
4. **No dialog reset** on close/success cancel path — reopening may show old channel/attendees/errors until remount.
5. **`primaryContactId` / `barrierId` missing from UI** despite server support — MNPI path cannot attach barrier from this form.
6. **Triplicated enums** across action, dialog, icon maps — add channel in one place → silent UI omission elsewhere.
7. **`attendeeRole` hidden input** submitted but ignored — harmless noise.
8. **Checkbox MNPI** without confirmation when body may hold material non-public info.
9. **No client max lengths** matching zod (300 / 20k / 500) — users hit server errors late.
10. **Duplicate attendee** only checked by contactId client-side; server allows up to 50.
11. **Dialog stays open on error** (good); success uses redirect so no `open` false handling needed — but if redirect fails, UX unclear.
12. **Queries comment** mentions RLS GUCs may be no-ops until policies migrated — create path uses `withRls` but list/detail reads may not, asymmetry.

---

## 4. `src/app/interactions/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/interactions/page.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/interactions/page.tsx` |
| **Lines** | 50 |
| **Directive** | None (async Server Component) |
| **Route** | `/interactions` |
| **Role** | Server page entry for the interactions timeline: auth, parse searchParams, load paginated rows, compose shell + list view |

### Exports

```ts
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25; // module-local, not exported

export default async function InteractionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mnpi?: string; page?: string }>;
}): Promise<JSX.Element>
```

### Imports

| Source | Symbols |
|--------|---------|
| `@/components/brand/page-shell` | `PageHeader`, `PageShell` |
| `@/lib/rbac` | `requireUser` |
| `@/features/interactions/queries` | `listInteractions` |
| `@/components/brand` | `Reveal` |
| `./interactions-list-view` | `InteractionsListView` |

**Note:** `Reveal` is imported but **never used** (dead import). Header/description sit on `PageHeader`; list view has its own `Reveal` wrappers.

### Business purpose

Top-level **Interactions** app route: “Meetings, calls, email, and WhatsApp logs.” Loads the user’s visible timeline with optional text search and MNPI-only filter, page size 25, and hands data to the client list view for chrome/filters/pagination UI.

### Key logic

```ts
const user = await requireUser();
const sp = await searchParams; // Promise searchParams (modern Next)
const q = sp.q?.trim() || undefined;
const page = Math.max(1, Number(sp.page) || 1);
const mnpiOnly = sp.mnpi === "1";

const { rows, total, page: curPage, pageSize } = await listInteractions({
  mnpiOnly,
  filters: { q },
  user,
  page,
  pageSize: PAGE_SIZE,
});

const totalPages = Math.max(1, Math.ceil(total / pageSize));
```

**Render:**

```tsx
<PageShell>
  <PageHeader
    title="Interactions"
    description="Meetings, calls, email, and WhatsApp logs."
  />
  <InteractionsListView
    rows={rows}
    total={total}
    page={curPage}
    pageSize={pageSize}
    totalPages={totalPages}
    q={q}
    mnpiOnly={mnpiOnly}
  />
</PageShell>
```

**SearchParams contract:**

| Param | Meaning |
|-------|---------|
| `q` | Free-text search (trimmed; empty → undefined) |
| `mnpi` | Only `"1"` enables MNPI-only filter |
| `page` | 1-based; invalid/NaN → 1; clamped to ≥ 1 only (not to totalPages) |

**force-dynamic:** comment states DB-backed timeline must never prerender / run query at build time.

### Side effects

| Effect | Mechanism |
|--------|-----------|
| Auth | `requireUser()` |
| DB reads | `listInteractions` (rows + count + attendee counts) |
| No mutations | Read-only page |

### Security / RBAC

| Layer | Behavior |
|-------|----------|
| Auth | `requireUser()` required |
| Row visibility | `listInteractions({ user })` → `interactionVisibilityClause` |
| MNPI filter | Optional subset when `containsMnpi === true`; does not grant extra access |
| Permission check | No explicit `can(user, "read", "interaction")` on page — any authenticated user with query scope sees their rows; empty list if none |

Search matches include `interaction.body` server-side — users with access can search note text that may be MNPI-bearing.

### Coupling

| Direction | Target |
|-----------|--------|
| Strong | `listInteractions` API + pagination return shape |
| Strong | `./interactions-list-view` props |
| Strong | `requireUser` / `CrmUser` |
| UI | `PageShell` / `PageHeader` |
| URL | Shared searchParams with list view (`q`, `mnpi`, `page`) |
| Dead | Unused `Reveal` import |

Does not import create dialog or actions (list view owns create UX).

### Risks / TODOs

1. **Unused `Reveal` import** — dead code.
2. **`page` not clamped to `totalPages`** — requesting `?page=999` yields empty `rows` with high page number; list still shows range math / possibly confusing empty filtered-vs-empty states (`total > 0` but empty page).
3. **No channel/direction/party filters** at page level despite query support (`partyId`, `dealId`, `contactId`, `filters.channel`, `filters.direction`).
4. **PAGE_SIZE hardcoded 25** — not user-configurable; density only changes visual density not page size.
5. **`Number(sp.page)`** accepts floats (`1.9` → 1 via Math.max with truncation? Actually `Number("1.9")` is 1.9, `Math.max(1, 1.9)` is 1.9 — offset math may break). Edge case: non-integer page.
6. **Relies entirely on app-layer visibility** — if RLS incomplete, same as rest of interactions feature.
7. **No metadata export** (`generateMetadata`) — tab title may be generic app default.

---

## Cross-file summary (batch 030)

### Architecture

```
page.tsx (RSC, auth + listInteractions)
  └── InteractionsListView (client)
        ├── CommandBar (search URL, density, MNPI Link, ExportCsv, NewInteractionDialog)
        ├── Table of InteractionListItem
        └── Pagination Links → /interactions?...

[id]/page.tsx (RSC, auth + getInteractionDetail)
  └── Detail cards (anchors, follow-up, notes, attendees)
        └── NewInteractionDialog NOT present

NewInteractionDialog → createInteraction (server action) → redirect /interactions/:id
```

### Shared domain vocabulary

| Concept | Values |
|---------|--------|
| Channels | `meeting`, `call`, `email`, `whatsapp`, `rfq`, `ndsom_chat`, `site_visit`, `management_presentation` |
| Directions | `inbound`, `outbound` |
| Attendee roles | `host`, `chair`, `presenter`, `issuer_side`, `investor_side`, `advisor`, `observer`, `other` |
| URL filters | `q`, `mnpi=1`, `page` |
| Page size | `25` |

### Highest-priority risks (batch)

1. **`occurredAt` format mismatch** (`datetime-local` vs `z.iso.datetime()`) may block or mis-parse create.
2. **Raw UUID-only anchors/attendees** in create dialog — usability and permission UX gap.
3. **No MNPI badge / barrier workflow on detail**; create cannot set `barrierId`.
4. **Duplicated channel constants/icons** across three UI files + actions.
5. **Deal/contact navigation incomplete** (list + detail).
6. **Dead imports:** `PageHeader`/`DetailTopBar` on detail; `Reveal` on list page.
7. **No edit surface** despite `updateInteraction` existing in feature actions.

### Tables / entities touched (via features, not directly in batch)

| Table | Ops from feature layer used by these pages |
|-------|-----------------------------------------------|
| `interaction` | SELECT list/detail; INSERT create |
| `interaction_attendee` | COUNT (list), SELECT (detail), INSERT (create) |
| `party`, `deal`, `contact` | LEFT JOIN for names/codes; visibility scope |
| `party_contact` | Visibility EXISTS subquery (scoped users) |

---

*End of agent-030 analysis.*
