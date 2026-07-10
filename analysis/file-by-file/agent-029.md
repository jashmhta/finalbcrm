# File-by-file analysis — agent-029

**Batch:** `batch-029.list`  
**Workspace root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4 (integrations control panel: explorer, icons, live stats, page)

---

## 1. `src/app/integrations/integrations-explorer.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/integrations/integrations-explorer.tsx` |
| **Lines** | 420 |
| **Directive** | `"use client"` |
| **Role** | Interactive control panel over India regulatory/financial adapter registry. |

### Exports

```ts
export interface IntegrationsExplorerProps {
  adapters: IntegrationSummary[];
}
export function IntegrationsExplorer({ adapters }: IntegrationsExplorerProps): JSX.Element
```

### Imports

- React, sonner toast
- brand Button/EmptyState/Eyebrow
- `runAllIntegrationMocks`, `runIntegrationMock` from `@/features/integrations/actions`
- type `IntegrationSummary` from registry
- sibling: AdapterCard, LiveStatTile, adapter-meta (CATEGORY_*, deriveConnectionState), integrations-icons

### Business purpose

Open-architecture adapter catalog as a live “connection rack”: run mocks individually or batch; Connected/Available/In mock/Total stats tick from lifted run state. Filters by category + search. Phase-1 (AA, KRA, CKYC, GSTIN, email, WhatsApp) vs Phase-3 member feeds (BSE/NSE, CCIL, demat). No real credentials — mock payloads only.

### Key logic

1. State: active category (`all`|category), query, runningAll, `runStates` map per adapter id.
2. `handleRun(id)` → `runIntegrationMock` → store result/error; friendly error string, never raw exception.
3. `handleRunAll` → `runAllIntegrationMocks` → fold results; toast success/warning/error.
4. `liveCounts` via `deriveConnectionState(adapter, result, error)`.
5. Filter + group by CATEGORY_ORDER; re-key grids for stagger.
6. Primary content visible on mount (no whileInView opacity-0 gate — screenshot audit lesson).

### Side effects

- Server actions for mock runs (may log/sample; no production upstream).
- Toasts via sonner.

### Security / RBAC

- Auth only on page; no adapter-level permission matrix.
- Mock mode badges; must never send real secrets from UI (registry-owned).

### Coupling

- Integrations feature actions + registry types.
- AdapterCard/meta not in batch — shared surface.

### Risks / TODOs

- Run-all lights board as “Connected” on mock OK — easy to misread as live production.
- No rate limiting client-side.
- Failed count computed but no dedicated “Failed” tile (only connected/available/inMock/total).

---

## 2. `src/app/integrations/integrations-icons.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/integrations/integrations-icons.tsx` |
| **Lines** | 137 |
| **Directive** | `"use client"` |
| **Role** | Phosphor Light wrappers + per-adapter icon/vendor metadata. Isolates Phosphor from RSC. |

### Exports

- Light wrappers: `BankIcon`, `IdentificationCardIcon`, … `ArrowCounterClockwiseIcon` (≈25)
- `ADAPTER_ICONS: Record<string, IconComponent>` — map adapter id → glyph
- `ADAPTER_VENDOR: Record<string, string>` — Sahamati, CERSAI, CRISIL/ICRA, CDSL/NSDL, etc.

### Business purpose

Turbopack/RSC: Phosphor `createContext` at module top breaks server import. Client isolation mirrors credit-icons. Vendor micro-text is display-only (does not mutate registry).

### Adapter identity map (examples)

| id | icon concept | vendor |
|----|--------------|--------|
| accountAggregator | Bank | Sahamati |
| kra | IdentificationCard | CVL·CAMS·Kfintech·NDML |
| ckyc | Certificate | CERSAI |
| whatsapp | WhatsappLogo | Meta·WhatsApp |
| bseNse | ChartLine | BSE·NSE |
| demat | Vault | CDSL·NSDL |

### Side effects / Security / Coupling

None / view metadata / AdapterCard + drawer consumers.

### Risks

- New adapters without ADAPTER_ICONS entry need fallback in consumer.

---

## 3. `src/app/integrations/live-stat-tile.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/integrations/live-stat-tile.tsx` |
| **Lines** | 169 |
| **Directive** | `"use client"` |
| **Role** | KPI tile with mount count-up + live prev→next tick animation. |

### Exports

```ts
export interface LiveStatTileProps {
  label: string;
  value: number;
  ambient?: "emerald" | "gold";  // prop exists; Card ambient not always wired
  tone?: "default" | "emerald" | "gold";
  caption?: string;
  live?: boolean;  // aria-live + pulse
  className?: string;
}
export function LiveStatTile(props: LiveStatTileProps): JSX.Element
```

Internal: `useLiveCount(value, inView, duration)`.

### Business purpose

Header instrument cluster: animate from previous displayed value on change (not 0→N every time). Reduced motion snaps. tabular-nums for en-IN. Live tiles: polite aria-live + emerald heartbeat.

### Key logic

- framer-motion `animate` from `currentRef` → value; onUpdate/onComplete setDisplay.
- Avoid setState synchronously in effect body for lint.

### Side effects / Security

Animation only / none.

### Coupling

Brand Card, Eyebrow, framer-motion.

### Risks

- `ambient` prop documented but not applied to Card in current body (dead prop?).

---

## 4. `src/app/integrations/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `src/app/integrations/page.tsx` |
| **Lines** | 83 |
| **Directive** | RSC |
| **Role** | Integrations registry page: auth, cached adapter list, status band, explorer. |

### Exports

```ts
export const dynamic = "force-dynamic";
export default async function IntegrationsPage(): Promise<JSX.Element>
```

### Imports

`requireUser`, `listIntegrationsCached`, Card/Badge, IntegrationsExplorer.

### Business purpose

View-only conceptual redesign; data wiring untouched. Live counts derived in explorer from run state (superset of static `integrationStatusCounts` which is preserved in registry but unused here). Editorial registry status: Phase-1 sequenced first; member feeds Phase-3; badges Mock mode / No real credentials / India data residency / Vendor = DPDP processor.

### Key logic

1. `requireUser()`.
2. `listIntegrationsCached()` — 300s cache; page still force-dynamic due to session.
3. Render header + status Card + explorer with serializable summaries only.

### Side effects

Session + cached registry read.

### Security / RBAC

- Authenticated staff only.
- No super_admin-only gate (all logged-in users see mock catalog).
- DPDP processor framing is UX compliance messaging, not technical control.

### Coupling

Integrations queries/registry; explorer client island.

### Risks / TODOs

- Cache may hide env-driven adapter availability until TTL.
- No audit of who ran mocks.

---

## Cross-file architecture (batch 029)

```
IntegrationsPage (RSC, force-dynamic)
  → listIntegrationsCached
  → IntegrationsExplorer (client)
       LiveStatTile ×4
       AdapterCard[] + runIntegrationMock / runAllIntegrationMocks
  icons: ADAPTER_ICONS / ADAPTER_VENDOR
```

**Compliance stack touchpoint:** India residency + DPDP processor badges; mock-only.  
**Production gap:** mock “Connected” semantics vs real credentialed adapters.

*End of agent-029 analysis.*
