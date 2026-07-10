# File-by-file analysis — agent-040

**Batch:** `batch-040.list`  
**Workspace root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4 (onboarding wizard, new page, board view, pipeline page)

---

## 1. `src/app/onboarding/new/onboarding-wizard.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/onboarding/new/onboarding-wizard.tsx` |
| **Lines** | ~500+ (4-step wizard) |
| **Directive** | `"use client"` |
| **Role** | 4-step capture wizard for new onboarding cases. |

### Exports

```ts
export interface OnboardingWizardProps { rms: RmOption[] }
export function OnboardingWizard({ rms }: OnboardingWizardProps): JSX.Element
```

### Steps

1. **Company** — name*, client type*, RM, PAN/CIN/GSTIN, state/city  
2. **Contact** — authorized signatory name/title/email/phone  
3. **Documents** — 7 docs mark “in hand”  
4. **Review** — summary + submit  

### Imports

createOnboarding action; ONBOARDING_* labels/orders from types; framer-motion AnimatePresence; brand cards.

### Business purpose

Open case at profile stage with documents pre-flagged for verification. Single form keeps all fields mounted (hidden inactive steps) so values persist across Back/Next.

### Key logic

- step 0 canProceed if companyName ≥ 2.
- docsInHand Set toggled; serialized into form on submit (implementation in remaining steps).
- useActionState createOnboarding → redirect case on success.

### Side effects

createOnboarding party + onboarding meta insert.

### Security / RBAC

create permission in action; PII fields (PAN).

### Risks

Client-only step gating (can jump via setStep if exposed); submit still validates server-side required company.

---

## 2. `src/app/onboarding/new/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/onboarding/new/page.tsx` |
| **Lines** | 23 |
| **Directive** | RSC |
| **Role** | New onboarding page shell. |

### Exports

```ts
export const dynamic = "force-dynamic";
export default async function NewOnboardingPage(): Promise<JSX.Element>
```

### Key logic

requireUser; listRms; PageHeader + OnboardingWizard. force-dynamic for RM list.

### Coupling

onboarding feature listRms.

### Risks

Auth only; no role gate for who can open onboarding cases.

---

## 3. `src/app/onboarding/onboarding-board-view.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/onboarding/onboarding-board-view.tsx` |
| **Lines** | large (kanban + analytics) |
| **Directive** | `"use client"` |
| **Role** | Onboarding pipeline board parallel to leads board. |

### Exports

```ts
export interface OnboardingBoardViewProps {
  groups: OnboardingPipelineGroup[];
  analytics: OnboardingAnalytics;
  rms: RmOption[];
}
export function OnboardingBoardView(...): JSX.Element
```

### Business purpose

Kanban by stage Initiated→…→Active; filters client type / SLA / RM; cards → `/onboarding/[id]`. Analytics dashboard + doc progress bars (verified/total, rejected→down tone). SLA badges overdue/due_soon/on_track. KYC status chips. Load-more pattern like leads.

### Key logic

- Mount motion not whileInView.
- DocProgressBar scaleX animation.
- StageDisc with OnboardingStageIcon.
- CommandBar New onboarding CTA.

### Side effects

None beyond navigation.

### Security

Data pre-scoped.

### Risks

Same as leads: full groups to client; analytics not filter-coupled.

---

## 4. `src/app/onboarding/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/onboarding/page.tsx` |
| **Lines** | 31 |
| **Directive** | RSC |
| **Role** | Onboarding pipeline index. |

### Exports

```ts
export const dynamic = "force-dynamic";
export default async function OnboardingPage(): Promise<JSX.Element>
```

### Key logic

requireUser; Promise.all getOnboardingPipeline, getOnboardingAnalytics, listRms; OnboardingBoardView. Header visible on mount.

### Coupling

`@/features/onboarding` barrel (server OK).

---

## Cross-file architecture (batch-040)

```
/onboarding → pipeline+analytics → board
/onboarding/new → wizard → createOnboarding → /onboarding/[id]
```

**Compliance stack:** document verification + KYC + compliance sign-off funnel.  
**Party-centric:** cases are parties with onboarding_meta.  
**Dual brand:** client types include issuer/investor; brand on party create in action.

*End of agent-040 analysis.*
