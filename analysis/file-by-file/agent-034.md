# File-by-file analysis — agent-034

**Batch:** `batch-034.list`  
**Workspace root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4 (Investor Matching Engine: workspace + full matrix)

---

## 1. `src/app/matching/[id]/match-matrix-view.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/matching/[id]/match-matrix-view.tsx` |
| **Lines** | 1006 |
| **Directive** | `"use client"` |
| **Role** | Full issuer×investor match matrix with select/commitment and Send-to-deal. |

### Exports

```ts
export function MatchMatrixView({ matrix }: { matrix: MatchMatrix }): JSX.Element
```

Large internal surface: SummaryStrip, CriteriaLegend, MatrixRow/Card, SelectToggle, WarmIntroBadge, SendToDealPanel, SuccessBanner, formatRelative.

### Imports

Brand icons, ScoreRing, StatCard, compactINR; types MatchMatrix/InvestorMatch/CriterionResult from matching queries; `bandForScore`, `SCORE_BAND_LABEL`, WarmIntroStrength from engine; `sendToDeal` action.

### Business purpose

**Matching USP:** rank every investor vs issuer on seven criteria (rating, tenor, sector, ticket, demat, KYC, relationship) with warm-intro path; shortlist → placement mandate via sendToDeal.

### Key logic

1. Pre-select score ≥ 65 (strong fits).
2. MAX_ROWS = 100 UI cap.
3. Deal config defaults from issuer primary deal (name/type/size/tenor).
4. `handleSubmit` → sendToDeal({ issuerId, dealName, dealType, targetSizeCrores, targetTenorYears, investors: [{partyId, commitmentCrores}] }).
5. Desktop sticky table + mobile cards.
6. SuccessBanner: dealCode, addedInvestors, created; link to `/deals` board (not deal id deep link).

### Side effects

sendToDeal creates/updates deal + deal_party rows; revalidation in action.

### Security / RBAC

- Auth on page only; action must enforce create/update deal.
- Commitments client-supplied — server must validate.

### Coupling

Matching engine/queries/actions; deals board.

### Risks / TODOs

- Success ignores `dealId` for deep link; re-submit possible after success.
- Duplicated formatRelative/WarmIntro vs workspace (timezone: matrix version sometimes lacks Asia/Kolkata).
- Copy “investors scanned” may exceed rendered cap.

---

## 2. `src/app/matching/[id]/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/matching/[id]/page.tsx` |
| **Lines** | 49 |
| **Directive** | RSC |
| **Role** | Match matrix detail route for one issuer. |

### Exports

```ts
export const dynamic = "force-dynamic";
export default async function MatchingDetailPage({
  params,
}: { params: Promise<{ id: string }> }): Promise<JSX.Element>
```

### Key logic

requireUser; getMatchMatrix(id, user); notFound if null; SectionHeading with rating/sector/tenor/target/pool; MatchMatrixView.

### Security

User passed to query for party/deal scoping.

### Risks

No feature can() beyond auth; any staff who can see matchable issuers can open matrix.

---

## 3. `src/app/matching/matching-workspace.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/matching/matching-workspace.tsx` |
| **Lines** | 671 |
| **Directive** | `"use client"` |
| **Role** | Two-pane matching instrument: issuer selector + ranked matches + filters. |

### Exports

```ts
export interface MatchingWorkspaceProps {
  issuers: IssuerSummary[];
  selectedId: string | null;
  result: MatchResult | null;
  initialQuery?: string;
}
export function MatchingWorkspace(props: MatchingWorkspaceProps): JSX.Element
```

### Key logic

1. URL `?id=` source of truth via router.replace.
2. Client issuer search over loaded list.
3. Client MATCH_FILTERS (demat/kyc/relationship/warm).
4. Top 24 cards + “View all in matrix”.
5. ScoreRing bands; CriteriaIndicators; WarmIntroBadge (bankerName, desk, touches).

### Side effects

Navigation only; no mutations in workspace.

### Coupling

matching engine filters pure client; queries types.

### Risks

Filter state lost on issuer switch (reset intentional).

---

## 4. `src/app/matching/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/matching/page.tsx` |
| **Lines** | 57 |
| **Directive** | RSC |
| **Role** | Matching workspace index. |

### Key logic

```ts
// Cap matches streamed to workspace at 200 (matrix page full list separately)
// Default selectedId: requested if in list else first issuer
// NOTE: ternary may keep invalid requestedId without fallback in some branches
```

getMatchableIssuers; getInvestorMatches(selectedId, 200, user).

### Risks / TODOs

**Invalid `?id=` bug risk:** selection logic:

```ts
const selectedId =
  (requestedId && issuers.some((i) => i.partyId === requestedId)
    ? requestedId
    : requestedId ?? issuers[0]?.partyId) ?? null;
```

If `requestedId` is set but not in issuers list, expression evaluates to `requestedId` (truthy second branch of outer ternary via `requestedId ?? first`) — **invalid id can be selected** and match query may fail/empty without falling back to first issuer.

---

## Cross-file architecture (batch 034)

```
/matching?id= → workspace (cap 200, show 24)
/matching/[id] → matrix (show 100) → sendToDeal → /deals
Seven criteria + warm intro = placement USP
```

**Matching USP** is the core product differentiator in this batch.  
**Party-centric** issuers/investors are parties; deals created from shortlist.

*End of agent-034 analysis.*
