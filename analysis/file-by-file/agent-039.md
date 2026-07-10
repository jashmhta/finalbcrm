# File-by-file analysis — agent-039

**Batch:** `batch-039.list`  
**Workspace root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4 (notifications center + page; onboarding case detail view + page)

---

## 1. `src/app/notifications/notifications-center.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/notifications/notifications-center.tsx` |
| **Lines** | 657 |
| **Directive** | `"use client"` |
| **Role** | Interactive notification inbox: stats, filters, dismiss, load more. |

### Exports

```ts
export interface NotificationsCenterProps {
  items: NotificationView[];
  stats: NotificationStats;
  total?: number;
}
export function NotificationsCenter(props: NotificationsCenterProps): JSX.Element
```

PAGE_SIZE = 50 (must match page).

### Imports

**Deep import discipline:** actions from `@/features/workflow/actions`; types from `@/features/workflow/types` — never barrel (postgres).  
markAsRead, markAllAsRead, loadMoreNotifications.

### Business purpose

Computed compliance/ops alerts (KYC, tasks, deals, credit, consent, duplicates). Cookie-backed read state. Stats over full book; list windowed. Mark all on filtered unread entityIds.

### Key logic

1. severity/type/search client filters.
2. `extra` append via loadMore; reset when server `items` key changes (revalidation).
3. Dedup loaded by id.
4. NotificationCard: link navigates + dismiss if unread; X marks read without navigate.
5. Type optgroups Compliance/Tasks/Deals/Credit (party_duplicate in types but not TYPE_OPTIONS filter — may be missing from type select).

### Side effects

Cookie writes via actions; revalidatePath /notifications.

### Security / RBAC

Items pre-scoped by engine with user; dismiss only local cookie (not per-user server store — multi-device desync).

### Risks

- Cookie CAP 50 dismissed ids — older dismissals forgotten → reappear as unread.
- markAll uses entityId not full notification id — one entity multiple types could over-dismiss? (engine design assumes entity uniqueness per type triggers but cookie is entity-only).
- party_duplicate may lack type filter option.

---

## 2. `src/app/notifications/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/notifications/page.tsx` |
| **Lines** | 57 |
| **Directive** | RSC |
| **Role** | Notifications page shell. |

### Exports

```ts
export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications · Binary Capital CRM" };
export default async function NotificationsPage(): Promise<JSX.Element>
```

### Key logic

requireUser; getNotificationsAndStats({ limit: 50, user }); pass items, stats, total=stats.total; calendar link action.

### Business purpose

Engine recomputes every load — completed tasks / advanced deals naturally drop notifications (no stale queue).

### Coupling

workflow queries; center client.

### Risks

Engine full scan every page load at scale (10k parties) — mitigated by bounded WHERE windows but still multi-query Promise.all.

---

## 3. `src/app/onboarding/[id]/onboarding-detail-view.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/onboarding/[id]/onboarding-detail-view.tsx` |
| **Lines** | large (1000+ with stage actions, docs, KYC, compliance, SLA, RM) |
| **Directive** | `"use client"` |
| **Role** | Onboarding case workspace UI + mutation forms. |

### Exports

```ts
export interface OnboardingDetailViewProps {
  detail: OnboardingDetail;
  rms: RmOption[];
}
export function OnboardingDetailView(props: OnboardingDetailViewProps): JSX.Element
```

### Imports

Onboarding types/labels/SLA; actions: advanceStage, approveCompliance, activateClient, markDocumentUploaded, rejectCompliance, rejectDocument, startKyc, updateAssignedRm, verifyDocument; onboarding-icons.

### Business purpose

6-stage funnel: Initiated → Profile → Documents → KYC → Compliance → Active. 7-document checklist with upload/verify/reject. KYC start, compliance approve/reject, activate client flips party active. SLA timeline + RM assign + contacts + interactions/tasks.

### Key logic

- Progress bar from onboardingProgress(stage, documents).
- StageActionArea terminal/active/kyc_verified/compliance_approved branches.
- Per-action useActionState forms (mutation boundary).
- Visible on mount (no whileInView gate).

### Side effects

Many server actions revalidating case page.

### Security / RBAC

Actions must enforce compliance officer vs RM permissions; UI surfaces all CTAs based on stage only.

### Coupling

Compliance/KYC domains; party status on activate.

### Risks

UI stage gates ≠ full RBAC; reject flows need notes validation server-side.

---

## 4. `src/app/onboarding/[id]/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/onboarding/[id]/page.tsx` |
| **Lines** | 189 |
| **Directive** | RSC |
| **Role** | Onboarding case header + detail view mount. |

### Exports

```ts
export const dynamic = "force-dynamic";
export default async function OnboardingDetailPage({
  params,
}: { params: Promise<{ id: string }> }): Promise<JSX.Element>
```

### Key logic

requireUser; getOnboardingDetail + listRms; notFound; PreviewPane with stage icon, SLA badge, KYC badge, compliance rejected; MetaCell signatory/PAN/city/RM; Open party link; OnboardingDetailView.

Server uses ONBOARDING_STAGE_TONE map (cannot call client onboardingStageTone).

### Security

Scoped detail query with user.

### Risks

PAN displayed in header meta (PII).

---

## Cross-file notes (batch 039)

- **Compliance stack:** notifications engine (KYC/consent/tasks) + onboarding KYC/compliance stages.
- **Read state MVP:** cookies not multi-device.
- **Party-centric:** onboarding keyed by partyId; activate updates party.

*End of agent-039 analysis.*
