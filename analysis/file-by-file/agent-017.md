# Agent 017 — File-by-file analysis

**Batch:** `batch-017.list`  
**Workspace root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  

---

## 1. `src/app/admin/users/users-view.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/admin/users/users-view.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/admin/users/users-view.tsx` |
| **Lines** | 1000 |
| **Directive** | `"use client"` |
| **Role** | Admin Users client view layer — full-page data table + create/edit/deactivate dialogs for `app_user` lifecycle management. |

### Exports

```ts
export interface UsersManagerViewProps {
  users: AdminUserRow[];
  roles: { roleId: string; name: string }[];
  desks: string[];
  currentUserId: string;
}

export function UsersManagerView({
  users,
  roles,
  desks,
  currentUserId,
}: UsersManagerViewProps): JSX.Element
```

**Internal (non-exported) components / helpers:**

| Name | Signature / shape | Purpose |
|------|-------------------|---------|
| `UserStatusBadge` | `({ active, locked }: { active: boolean; locked: boolean })` | Active / Inactive / Locked badge |
| `CreateUserDialog` | `({ roles, desks })` | Modal form → `createUser` |
| `EditUserDialog` | `({ user, roles, desks, isSelf })` | Modal form → `updateUser` |
| `DeactivateUserButton` | `({ userId, email, isActive, isSelf })` | Two-tap confirm → `deactivateUser` |
| `RoleCheckboxGrid` | `({ roles, selected: Set<string>, onToggle })` | Multi-role checkbox grid |
| `Field` | `({ label, htmlFor?, required?, hint?, children })` | Label + hint wrapper |
| `BezelInput` | `React.InputHTMLAttributes<HTMLInputElement>` | Double-bezel text/password input |
| `BezelSelect` | controlled select + optional hidden `name` input | Desk / active selects |
| `FilterSelect` | `({ value, onChange, options, ariaLabel })` | CommandBar filter pills |
| `prettify` | `(s: string) => string` | `_` → space |
| `relativeTime` | `(v: string \| Date \| null) => string` | Relative last-login display |
| `EASE` | `[0.32, 0.72, 0, 1] as const` | Motion easing (declared; not heavily used in this file) |

### Imports

| Source | Symbols |
|--------|---------|
| `react` | `* as React`, `useActionState` |
| `@/components/ui/dialog` | `Dialog`, `DialogContent`, `DialogDescription`, `DialogTitle`, `DialogTrigger`, `DialogClose` |
| `@phosphor-icons/react` | `X`, `Plus`, `ArrowRight`, `CircleNotch`, `PencilSimple`, `LockSimple`, `ShieldCheck`, `ShieldWarning`, `Users as UsersIcon`, `Fingerprint`, `EnvelopeSimple`, `ArrowFatDown`, `SealCheck` |
| `@/lib/utils` | `cn` |
| `@/features/admin/queries` | type `AdminUserRow` |
| `@/components/brand` | `Badge`, `Button`, `Card`, `CardBody`, `CommandBar`, `Eyebrow`, `EmptyState`, `IconTile`, `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`, type `Density` |
| `@/features/admin/actions` | `createUser`, `updateUser`, `deactivateUser`, types `CreateUserState`, `UpdateUserState`, `DeactivateUserState` |

**Referenced external type (`AdminUserRow` from `@/features/admin/queries`):**

```ts
export interface AdminUserRow {
  userId: string;
  email: string;
  isActive: boolean;
  desk: string | null;
  barrierClearance: string[] | null;
  lastLoginAt: Date | null;
  mfaEnabled: boolean;
  failedLoginCount: number;
  lockedUntil: Date | null;
  createdAt: Date;
  roles: { roleId: string; name: string }[];
}
```

**Referenced action state types (`@/features/admin/actions`):**

```ts
export type CreateUserState = { error?: string; userId?: string } | undefined;
export type UpdateUserState = { error?: string; ok?: boolean } | undefined;
export type DeactivateUserState = { error?: string; ok?: boolean } | undefined;
```

### Business purpose

Admin console surface for identity provisioning:

1. **List** every non-deleted `app_user` with roles, desk, active/locked status, last login, MFA flag.
2. **Create** users with email, bcrypt password (min 8 chars client-side), desk, active flag, barrier-clearance UUIDs, role grants.
3. **Edit** desk, barrier clearance, active state, optional password reset, role grants.
4. **Deactivate** (soft) active users with a two-step confirm; self-deactivation blocked in UI.

Barrier clearance is free-form comma-separated UUID tags; the form emits one hidden `name="barrierClearance"` input per tag so the server action can `getAll`. Comments state RLS compares `barrier_id::text` against `app.wall` text[]. Role multi-select uses a checkbox grid (~6 roles) rather than a multi-select dropdown.

### Key logic

**Filtering (`UsersManagerView`):**

```ts
// Client-side filter over props.users
// - search: email + role names + desk (case-insensitive substring)
// - deskFilter: exact desk match
// - statusFilter:
//     "active"   → isActive
//     "inactive" → !isActive
//     "locked"   → lockedUntil && lockedUntil > new Date()
//     "mfa"      → mfaEnabled
```

**Summary chips:** `activeCount`, `mfaCount` over full `users` (not filtered set).

**Create flow:**
- `useActionState(createUser, undefined)`
- Controlled local state: `email`, `desk`, `isActive`, `barrierCsv`, `selectedRoles: Set<string>`
- Password uncontrolled (name=`password`, `minLength={8}`)
- On `state?.userId` while open → close dialog and reset form fields
- Hidden inputs: `barrierClearance` (per tag), `roleNames` (per selected role name)

**Edit flow:**
- `useActionState(updateUser, undefined)`
- Hidden `userId`
- Reset form from `user` when dialog opens (`useEffect` on `open`)
- Close when `state?.ok`
- Self-edit: Active select disables option `"false"`; helper text “You cannot deactivate your own account.”
- Password optional; blank keeps current hash (server-side)

**Deactivate flow:**
- `disabled = !isActive || isSelf` → locked icon with title
- First click sets `confirming`; second shows Cancel + Confirm submit with hidden `userId`
- On `state?.ok` resets confirming

**`BezelSelect` quirk:** native `<select>` is controlled via React state; form submission uses a sibling `<input type="hidden" name={name} value={value} />` because the visible select has no `name`.

**`relativeTime`:** buckets just now / Nm ago / Nh ago / Nd ago / else `toLocaleDateString("en-IN", { month: "short", day: "2-digit" })`.

**Admin role styling:** role name `"admin"` → gold `Badge` / gold checkbox; others neutral / emerald.

### Side effects

| Effect | Mechanism |
|--------|-----------|
| Create user | Form `action={createUser}` via `useActionState` → server action (hash password, insert `app_user`, role grants, revalidate) |
| Update user | Form `action={updateUser}` |
| Deactivate user | Form `action={deactivateUser}` |
| UI-only | Dialog open/close, filter/search/density local state, confirm toggle — no direct DB access from this file |

No `fetch`, no cookies, no router calls in this file; revalidation is expected inside server actions.

### Security / RBAC

- **Client presentation only.** Authorization for create/update/deactivate is enforced in `@/features/admin/actions` (not in this file). Parent page must gate admin access.
- **Self-protection (UI only):** cannot set self inactive; cannot deactivate self. Server must still enforce (UI can be bypassed).
- **Password fields:** `type="password"`, `autoComplete="new-password"`; min length 8 client-side only.
- **Barrier clearance:** free-form UUID strings; no client UUID validation — invalid tags depend on server.
- **Role grants:** checkbox by role *name* (not id) via `roleNames` hidden inputs; server must map/validate names.
- **Sensitive data in DOM:** full user list (emails, MFA status, lock state, barrier UUIDs) is client-props — any user who can load the page sees it.
- **Error display:** `state.error` rendered with `role="alert"` (create/edit) or inline (deactivate).

### Coupling

| Coupling | Detail |
|----------|--------|
| Strong | `@/features/admin/actions` — create/update/deactivate contracts and FormData field names (`email`, `password`, `desk`, `isActive`, `barrierClearance`, `roleNames`, `userId`) |
| Strong | `@/features/admin/queries` type `AdminUserRow` shape |
| Strong | Parent server page must pass `users`, `roles`, `desks`, `currentUserId` |
| UI | Brand design system + Dialog primitive |
| Weak | Role catalogue assumed small (~6); desks list from props |

Does **not** import `@/db` or server query loaders at runtime (type-only for `AdminUserRow` if tree-shaken; import is `import type` so safe).

### Risks / TODOs

1. **No UUID validation** on barrier clearance before submit.
2. **Self-protection is UI-only** for active/deactivate; edit could still change own roles/barriers depending on server rules (not visible here).
3. **`BezelSelect` `disabled` prop** disables options *and* disables the whole select when `disabled.includes(value)` — for self-edit when already active, select remains enabled but `"false"` option disabled; if somehow `value` were `"false"`, entire select would disable.
4. **Create success detection** uses `state?.userId` only; error state does not clear previous success markers beyond re-submit.
5. **Password strength:** only `minLength={8}`; no complexity rules client-side.
6. **Locked filter** uses client `new Date()` — timezone/clock skew vs server lock expiry.
7. **No pagination** — entire user list in memory/props; scales poorly if user count grows large.
8. **Deactivate errors** show as tiny inline text; easy to miss.
9. **`EASE` constant unused** in this file (dead code / copy-paste residue).
10. **Checkbox roles not submitted as native checkbox names** — only hidden `roleNames`; if JS fails, no roles submitted.
11. **Email not editable** in edit dialog (identity immutable here) — intentional but worth documenting for operators.

---

## 2. `src/app/ai/ai-hub-view.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/ai/ai-hub-view.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/ai/ai-hub-view.tsx` |
| **Lines** | 486 |
| **Directive** | `"use client"` |
| **Role** | AI Insights hub pure presentation component — next-best-actions hero, client-insight cards, recent interaction auto-summaries rail. |

### Exports

```ts
interface AiHubViewProps {  // not exported
  actions: NextAction[];
  recentSummaries: RecentInteractionSummary[];
  clientInsights: ClientInsight[];
  userName?: string;
}

export function AiHubView({
  actions,
  recentSummaries,
  clientInsights,
  userName,
}: AiHubViewProps): JSX.Element
```

**Internal components:**

| Name | Props | Purpose |
|------|-------|---------|
| `ScoreBar` | `{ label, score, band, tone?: "gold"\|"emerald"\|"down", delay? }` | Animated 0–100 score bar |
| `ActionRow` | `{ action: NextAction, index }` | Next-best-action link row |
| `ClientInsightCard` | `{ insight: ClientInsight, index }` | Party relationship/deal potential card |
| `RecentSummaryRow` | `{ item: RecentInteractionSummary, index }` | Interaction distill row |
| `SectionCard` | `{ eyebrow, icon: Icon, title, description?, action?, children, className? }` | Section shell |

### Imports

| Source | Symbols |
|--------|---------|
| `react` | `* as React` |
| `next/link` | `Link` |
| `framer-motion` | `motion` |
| `@phosphor-icons/react` | `ArrowUpRight`, `Buildings`, `Chats`, `Clock` (**imported but unused**), `Handshake`, `IdentificationCard`, `Lightning`, `ListChecks`, `Phone`, `ShieldCheck`, `Sparkle`, type `Icon` |
| `@/lib/utils` | `cn` |
| `@/components/brand` | `Card`, `CardBody`, `CardHeader`, `CardTitle`, `CardDescription`, `Badge`, `Button`, `Eyebrow`, `EmptyState` |
| `@/components/brand` | type `BadgeProps` |
| `@/features/ai/types` | `AI_PRIORITY_BADGE`, `AI_PRIORITY_LABEL`, `INSIGHT_ACTION_LABEL`, `NEXT_ACTION_KIND_LABEL`, types `ClientInsight`, `InsightActionKind`, `NextAction`, `NextActionKind`, `RecentInteractionSummary` |

**Explicit import strategy (commented):** imports pure display constants/types from `@/features/ai/types` **not** the feature barrel, to avoid pulling `postgres` / `@/db` into the client bundle.

### Types consumed (from `@/features/ai/types`)

```ts
export type AiPriority = "critical" | "warning" | "info" | "positive";

export type NextActionKind =
  | "task_overdue"
  | "deal_stuck"
  | "credit_committee_pending"
  | "kyc_expiring"
  | "no_recent_interaction";

export interface NextAction {
  kind: NextActionKind;
  title: string;
  description: string;
  href: string;
  priority: AiPriority;
  entityLabel: string;
  occurredAt: string;
  relative: string;
}

export type InsightActionKind =
  | "re_engage"
  | "advance_mandate"
  | "committee_review"
  | "refresh_kyc"
  | "deepen_coverage"
  | "maintain";

export interface ClientInsight {
  partyId: string;
  legalName: string;
  relationshipStrength: number;      // 0..100
  relationshipBand: string;
  dealPotential: number;             // 0..100
  dealPotentialBand: string;
  recommendedAction: InsightActionKind;
  actionRationale: string;
  interactionCount: number;
  dealCount: number;
  activeDealCount: number;
  daysSinceLastInteraction: number | null;
  totalTargetSizeCr: number;
  href: string;
}

export interface RecentInteractionSummary {
  interactionId: string;
  subject: string | null;
  partyName: string | null;
  dealCode: string | null;
  channel: string | null;
  occurredAt: string;
  relative: string;
  topic: string;
  actionItem: string | null;
  href: string;
}
```

**Local maps:**

```ts
const NEXT_ACTION_ICON: Record<NextActionKind, Icon> = {
  task_overdue: ListChecks,
  deal_stuck: Handshake,
  credit_committee_pending: ShieldCheck,
  kyc_expiring: IdentificationCard,
  no_recent_interaction: Phone,
};

const INSIGHT_ACTION_VARIANT: Record<InsightActionKind, BadgeProps["variant"]> = {
  re_engage: "gold",
  advance_mandate: "gold",
  committee_review: "info",
  refresh_kyc: "down",
  deepen_coverage: "emerald",
  maintain: "neutral",
};
```

### Business purpose

Coverage-officer “AI insights” desk UI (deterministic heuristics, not external LLM):

1. **Next best actions** — prioritized list (tasks, stuck deals, committee, KYC, cold coverage) with deep links.
2. **Client insights** — relationship strength + deal potential score bars, recommended nurture action, touch/deal/₹ Cr footprint.
3. **Recent auto-summaries** — latest interactions with topic + action item + channel.

Greeting: ``Coverage desk for ${userName}`` or `"Your coverage desk"`.

### Key logic

**ScoreBar tone thresholds (client display only):**
- Relationship: `>= 70` emerald, `< 20` down, else gold.
- Deal potential: `>= 60` emerald, `< 15` down, else gold.
- Width clamped: `Math.max(0, Math.min(100, score))%` via framer-motion `whileInView`.

**Last-touch label:**
```ts
daysSinceLastInteraction === null → "never"
=== 0 → "today"
else → `${n}d ago`
```

**Channel pretty-print:** underscores → spaces; capitalize word starts; null → `"Note"`.

**₹ display:** if `totalTargetSizeCr > 0`, show `₹{n.toFixed(0)} Cr`.

**Empty states:** three `EmptyState` variants when arrays empty.

**Layout:** hero full-width actions; `lg:grid-cols-12` with insights col-span-7, summaries col-span-5; link to `/interactions` when summaries exist.

**Keys:**
- Actions: `` `${a.kind}-${a.entityLabel}-${i}` ``
- Insights: `c.partyId`
- Summaries: `s.interactionId`

### Side effects

- **None on data layer.** Pure render from props.
- **Client motion:** framer-motion animations on mount / in-view.
- **Navigation:** `Link` to `action.href`, `insight.href`, `item.href`, `/interactions`.

### Security / RBAC

- No auth checks in this file; assumes parent server page already filtered actions/insights/summaries to the current user’s book (ownership scoping).
- All `href` values come from server-generated props — trust that server does not emit privileged routes for unauthorized entities.
- No secrets, no mutations, no server actions.

### Coupling

| Coupling | Detail |
|----------|--------|
| Strong | `@/features/ai/types` constants + type shapes must stay in sync with engines |
| Strong | Parent `/ai` page supplies precomputed arrays |
| UI | Brand cards/badges, Phosphor icons, framer-motion |
| Bundle safety | Deliberately avoids feature barrel / `@/db` |

### Risks / TODOs

1. **Unused import:** `Clock` from phosphor.
2. **Action list keys** include index — reorder/refresh may remount rows.
3. **No client-side priority sort** — assumes server already ordered critical → warning → …
4. **Score thresholds** hard-coded in UI; may diverge from engine band labels.
5. **`dealCount` on `ClientInsight` unused** in UI (only `activeDealCount` shown).
6. **No error boundary / loading** — loading lives in sibling `loading.tsx`; this view assumes valid props.
7. **Currency hard-coded to ₹ Cr** — India-desk assumption.

---

## 3. `src/app/ai/credit-summary.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/ai/credit-summary.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/ai/credit-summary.tsx` |
| **Lines** | 315 |
| **Directive** | `"use client"` |
| **Role** | Self-contained client panel that fetches and renders an AI (heuristic) credit memo for one credit analysis; designed for composition into `/credit/[id]` Overview tab. |

### Exports

```ts
interface AiCreditSummaryProps {
  creditAnalysisId: string;
}

export function AiCreditSummary({
  creditAnalysisId,
}: AiCreditSummaryProps): JSX.Element
```

**Internal:**

| Name | Role |
|------|------|
| `LoadState` | Discriminated union for panel state |
| `SummaryBody` | Renders ready summary |
| `Paragraph` | Labeled prose block |
| `BulletList` | Strengths / concerns list |
| `SummarySkeleton` | Loading skeleton mirroring layout |
| `BuildingsIcon` / `CoinsIcon` / `ScalesIcon` | Local phosphor wrappers |

```ts
type LoadState =
  | { status: "loading" }
  | { status: "ready"; summary: CreditSummaryType }
  | { status: "error" }
  | { status: "empty" };
```

### Imports

| Source | Symbols |
|--------|---------|
| `react` | `* as React` |
| `framer-motion` | `motion` |
| `@phosphor-icons/react` | `ArrowClockwise`, `Buildings`, `ChartLineUp`, `CheckCircle`, `Scales`, `Sparkle`, `Warning` |
| `@/lib/utils` | `cn` |
| `@/components/brand` | `Card`, `CardBody`, `CardHeader`, `CardTitle`, `CardDescription`, `Badge`, `Button`, `Eyebrow`, `EmptyState`, `Skeleton` |
| `@/components/brand` | type `BadgeProps` |
| `@/features/ai/types` | `AI_PRIORITY_LABEL`, type `CreditSummary as CreditSummaryType` |
| `@/features/ai/actions` | `fetchCreditSummary` |

**Import strategy (commented):** types from `@/features/ai/types`; server action from `@/features/ai/actions` directly — **not** feature barrel — to avoid client bundle including `postgres`.

**`CreditSummary` type:**

```ts
export interface CreditSummary {
  creditAnalysisId: string;
  issuer: string;           // paragraph 1
  financials: string;       // paragraph 2
  assessment: string;       // paragraph 3
  strengths: string[];
  concerns: string[];
  recommendation: string;
  recommendationPriority: AiPriority;  // "critical" | "warning" | "info" | "positive"
  ratingLine: string;
  generatedAt: string;      // ISO — not displayed in this UI
}
```

**Local map:**

```ts
const PRIORITY_VARIANT: Record<string, BadgeProps["variant"]> = {
  critical: "down",
  warning: "gold",
  info: "info",
  positive: "up",
};
```

### Business purpose

Generate (server-side heuristic) and display a committee-memo-style credit summary:

- Rating line header
- Issuer / Financial highlights / Credit assessment paragraphs
- Strengths (up tone) + Concerns (down tone)
- Recommendation badge + text

Ownership note in file: lives under `src/app/ai/*` so credit page need only import and drop:

```tsx
import { AiCreditSummary } from "@/app/ai/credit-summary";
// ...
<AiCreditSummary creditAnalysisId={a.creditAnalysisId} />
```

Single serializable prop; fetches own data via server action (Next 16 RSC: no function props across boundary). Owns loading / error / empty / regenerate UX.

### Key logic

```ts
const load = React.useCallback(async () => {
  setState({ status: "loading" });
  try {
    const summary = await fetchCreditSummary(creditAnalysisId);
    if (!summary) setState({ status: "empty" });
    else setState({ status: "ready", summary });
  } catch {
    setState({ status: "error" });
  }
}, [creditAnalysisId]);

React.useEffect(() => { load(); }, [load]);
```

- **Regenerate** button calls `load` again; disabled while `status === "loading"`.
- `SummaryBody` animates opacity/y on enter.
- Recommendation badge: `PRIORITY_VARIANT[summary.recommendationPriority] ?? "neutral"`; label from `AI_PRIORITY_LABEL[...] ?? "Recommendation"`.
- `CoinsIcon` reuses `ChartLineUp` (naming mismatch cosmetic only).

### Side effects

| Effect | Mechanism |
|--------|-----------|
| Fetch credit summary | `await fetchCreditSummary(creditAnalysisId)` server action |
| Re-fetch on id change / regenerate | `useEffect` + button `onClick={load}` |
| Local React state only | `LoadState` |

Server action (`fetchCreditSummary`) calls `requireUser()` then `getCreditSummary(id, user)` — generation/RBAC happen server-side.

### Security / RBAC

- Client does **not** check permissions; relies on `fetchCreditSummary` → `requireUser()` + engine-level access to credit analysis.
- Only `creditAnalysisId` (string) sent to server; IDOR risk if server does not scope by user/desk/barrier.
- Error path swallows exception details (good for not leaking internals; bad for diagnostics).
- Generated content is advisory (“review and edit before circulating”) — not a hard control.

### Coupling

| Coupling | Detail |
|----------|--------|
| Strong | `@/features/ai/actions.fetchCreditSummary` return type `CreditSummary \| null` |
| Strong | `@/features/ai/types.CreditSummary` + `AI_PRIORITY_LABEL` |
| Soft | Intended consumer: credit detail Overview tab (`/credit/[id]`) |
| UI | Brand + framer-motion + phosphor |

### Risks / TODOs

1. **`generatedAt` not shown** — operators cannot see staleness of memo.
2. **No cache key / debounce** — rapid regenerate hammers server action.
3. **Catch-all errors** — no distinction auth vs not-found vs generation failure (auth may surface as error or empty depending on action).
4. **Bullet list keys** are array indices.
5. **PRIORITY_VARIANT** uses `Record<string, ...>` not `Record<AiPriority, ...>` — weaker typing.
6. **No edit/copy-to-clipboard** despite “paste into committee memo” product intent.
7. **Empty vs null** semantics depend entirely on `getCreditSummary` returning `null` for incomplete analyses.
8. Integration into credit page is documented in comments but **not enforced** by this module — may be unmounted if page owner never imports it.

---

## 4. `src/app/ai/loading.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/ai/loading.tsx` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/ai/loading.tsx` |
| **Lines** | 36 |
| **Directive** | None (Server Component by default) |
| **Role** | Next.js App Router `loading.tsx` fallback for the `/ai` route segment while force-dynamic aggregate queries resolve. |

### Exports

```ts
export default function AiLoading(): JSX.Element
```

### Imports

| Source | Symbols |
|--------|---------|
| `@/components/brand` | `SkeletonCard`, `SkeletonPage`, `Skeleton` |

### Business purpose

Instant navigation feedback for AI Insights: skeleton that **mirrors hub layout**:

1. Page chrome via `SkeletonPage` with eyebrow `"AI · Insights"`, title `"AI insights"`, `cards={0}`.
2. Hero next-actions `SkeletonCard` (`lines={4}`).
3. Split grid `lg:grid-cols-12`:
   - col-span-7: four `Skeleton` tiles (`h-36`) in 1–2 column grid (client insight cards).
   - col-span-5: `SkeletonCard` with `lines={6}` (recent summaries rail).

### Key logic

Presentational only; no data, no state, no branching.

```tsx
export default function AiLoading() {
  return (
    <SkeletonPage eyebrow="AI · Insights" title="AI insights" cards={0}>
      <SkeletonCard className="mb-5 md:mb-6" lines={4} />
      <div className="grid grid-cols-1 gap-5 md:gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <SkeletonCard className="h-full">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          </SkeletonCard>
        </div>
        <div className="lg:col-span-5">
          <SkeletonCard className="h-full" lines={6} />
        </div>
      </div>
    </SkeletonPage>
  );
}
```

### Side effects

None.

### Security / RBAC

None. Loading UI is unauthenticated shell content; actual data still gated by the page/layout auth.

### Coupling

| Coupling | Detail |
|----------|--------|
| Layout parity | Structure intentionally matches `AiHubView` (hero + 7/5 split) |
| Brand | `SkeletonPage` / `SkeletonCard` / `Skeleton` API |

### Risks / TODOs

1. **Copy drift:** eyebrow/title must stay aligned with real page metadata.
2. **Fixed 4 insight skeletons** — real grid may have more/fewer cards; minor layout jump on resolve.
3. **Does not cover** nested routes under `/ai/*` unless those segments inherit this loading boundary (depends on folder structure).
4. No `Suspense` keying / progressive partials — whole segment waits on loading UI.

---

## Cross-file notes (batch 017)

| Theme | Notes |
|-------|--------|
| **Client vs server** | Three client views (`users-view`, `ai-hub-view`, `credit-summary`); one RSC loading shell (`loading`). |
| **AI module pattern** | Display types/constants from `@/features/ai/types`; mutations/fetches from `@/features/ai/actions` (or parent loaders for hub); never feature barrel on client to avoid `postgres` in bundle. |
| **Admin mutations** | Users view uses `useActionState` + FormData field contracts with `@/features/admin/actions`. |
| **RBAC locus** | UI self-guards (admin self-deactivate) + server `requireUser` / admin checks outside these files. |
| **Shared UX** | Brand bezel cards, Phosphor light icons, gold/emerald/down priority vocabulary, EmptyState patterns. |
| **No DB tables touched directly** | All four files are view/loading layers; tables implied indirectly: `app_user`, `user_role`, `role`, credit analysis + ratio/scorecard engines, parties/deals/tasks/interactions/KYC via AI engines. |

### Batch inventory

| # | Path | Lines | Export(s) |
|---|------|------:|-----------|
| 1 | `src/app/admin/users/users-view.tsx` | 1000 | `UsersManagerView`, `UsersManagerViewProps` |
| 2 | `src/app/ai/ai-hub-view.tsx` | 486 | `AiHubView` |
| 3 | `src/app/ai/credit-summary.tsx` | 315 | `AiCreditSummary` |
| 4 | `src/app/ai/loading.tsx` | 36 | `default AiLoading` |

**Total lines analyzed:** 1837  
