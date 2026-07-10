# Agent 015 — File-by-file analysis

**Batch:** `batch-015.list`  
**Scope root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Date:** 2026-07-09  

---

## 1. `src/app/admin/audit/page.tsx`

| Field | Value |
|--------|--------|
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/admin/audit/page.tsx` |
| **Lines** | 102 |
| **Kind** | Next.js App Router **server** page (`async` RSC) |
| **Route** | `/admin/audit` |

### Role

Admin forensic audit-log page. Server component that gates access, parses URL search params into filters, loads paginated audit rows + filter option lists, and renders `AdminAuditView` (client) inside the brand page shell. More detailed than the compliance audit surface: advanced filters (entity type, operation, actor, date range, barrier) plus a per-row diff inspector (in the child view).

### Exports

| Export | Kind | Signature / value |
|--------|------|-------------------|
| `dynamic` | const | `export const dynamic = "force-dynamic"` |
| `metadata` | const | `{ title: "Audit log · Admin · Binary Capital CRM" }` |
| `default` | async function | `AdminAuditPage({ searchParams }: { searchParams: Promise<{ q?: string; entityType?: string; operation?: string; actorUserId?: string; from?: string; to?: string; barrierId?: string; page?: string }> })` |

**Module-local constants (not exported):**

```ts
const PAGE_SIZE = 50;
const OPERATIONS = ["insert", "update", "delete", "merge", "approve", "reject"];
```

### Imports

| Import | From | Usage |
|--------|------|--------|
| `requireUser`, `can` | `@/lib/rbac` | Auth + permission gate |
| `redirect` | `next/navigation` | Deny → `/parties` |
| `listAuditEntries`, `listAuditEntityTypes`, `listAuditBarriers`, `listUsers` | `@/features/admin/queries` | Data loaders |
| `Reveal` | `@/components/brand` | Header entrance motion |
| `AdminAuditView` | `./audit-view` | Client forensic table UI |
| `PageShell`, `PageHeader`, `DetailTopBar` | `@/components/brand/page-shell` | Layout shell / header |

**Note:** `DetailTopBar` is imported but **never used** in this file.

### Re-export / type chain (data layer)

`listAuditEntries` is a re-export alias:

```ts
// @/features/admin/queries
export {
  listAuditLog as listAuditEntries,
  type AuditLogFilter,
  type AuditLogRow,
  type AuditLogResult,
} from "@/features/compliance/audit";
```

**`AuditLogFilter`** (filter object passed as `filter`):

```ts
{
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
  operation?: string;
  correlationId?: string;
  barrierId?: string;
  from?: string;   // ISO lower bound inclusive
  to?: string;     // ISO upper bound inclusive
  q?: string;      // substring on entity_type / actor_role_at_time
}
```

**`AuditLogRow`** (row shape returned / passed to client):

```ts
{
  auditLogId: string;
  entityType: string;
  entityId: string | null;
  fieldName: string | null;
  oldValue: unknown;
  newValue: unknown;
  operation: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorRoleAtTime: string | null;
  barrierId: string | null;
  occurredAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  prevHash: string | null;
  rowHash: string | null;
}
```

**`AuditLogResult`:** `{ rows: AuditLogRow[]; total: number; page: number; pageSize: number }`

### Business purpose

- Provide admins (and roles with `audit:read` or `user:manage`) a **forensic, filterable, paginated** view of the immutable `audit_log`.
- Surface hash-chain narrative in the page description (`prev_hash → row_hash` tamper-evidence).
- Barrier filter is exposed here (admin-specific vs thinner compliance audit UX).
- Actor filter is backed by full `listUsers()` (email + userId for dropdown).

### Key logic

1. **Auth gate**
   ```ts
   const user = await requireUser();
   if (!can(user, "read", "audit") && !can(user, "manage", "user")) {
     redirect("/parties");
   }
   ```
   - `requireUser()` → redirects to `/login` if unauthenticated.
   - `can(user, action, resource)` checks `admin`/`super_admin` roles OR permission set key `` `${resource}:${action}` `` → so `"read","audit"` → `audit:read`; `"manage","user"` → `user:manage`.

2. **Search-param parsing** (awaited `Promise` — Next 15+/16 style):
   - `q` trimmed or `undefined`
   - `entityType`, `operation`, `actorUserId`, `from`, `to`, `barrierId` passthrough or `undefined`
   - `page = Math.max(1, Number(sp.page) || 1)`

3. **Parallel data fetch**
   ```ts
   Promise.all([
     listAuditEntries({ filter: { q, entityType, operation, actorUserId, from, to, barrierId }, page, pageSize: PAGE_SIZE }),
     listAuditEntityTypes(),
     listAuditBarriers(),
     listUsers(),
   ])
   ```
   - `totalPages = Math.max(1, Math.ceil(total / pageSize))`

4. **Render**
   - `PageShell` → `Reveal` + `PageHeader` (title/description) → `AdminAuditView` with rows, pagination, filter state, entityTypes, static `OPERATIONS`, barriers, and `users.map(u => ({ userId, email }))` only (strips roles, MFA, lock state, etc.).

### Side effects

| Effect | Detail |
|--------|--------|
| Session read | `requireUser` / `getCurrentUser` (cookie/session) |
| Redirects | Unauthenticated → `/login`; unauthorized → `/parties` |
| DB reads | `audit_log` (filtered/paginated + distinct entity types + barrier counts); `app_user` (+ roles join via `listUsers`) |
| No mutations | Read-only page; audit_log is INSERT-only by design elsewhere |
| Force dynamic | No static generation / no caching of this route |

### Security / RBAC

| Control | Detail |
|---------|--------|
| **Required** | Authenticated user |
| **Permission** | `audit:read` **OR** `user:manage` (OR with admin/super_admin short-circuit inside `can`) |
| **Fail mode** | Soft redirect to `/parties` (not 403 page) |
| **Data sensitivity** | Audit rows include `oldValue`/`newValue` (may hold PII/financial diffs), `ipAddress`, `userAgent`, actor email, barrier IDs |
| **User list exposure** | Full non-deleted user list emails passed to client for actor filter — appropriate for admin, but broader than audit-only if someone has only `user:manage` without audit (still allowed by gate) |
| **Input** | Search params trusted only as filter strings; SQL composition lives in compliance `listAuditLog` (eq/ilike/gte/lte) — page does not sanitize dates beyond pass-through |

### Coupling

| Coupled to | How |
|------------|-----|
| `./audit-view` (`AdminAuditView`) | Props contract must stay in sync with `AdminAuditViewProps` |
| `@/features/admin/queries` | Data API + re-export of compliance audit |
| `@/features/compliance/audit` | Actual query + `AuditLogRow` shape |
| `@/lib/rbac` | Gate |
| Brand shell / Reveal | Presentation |
| URL query string | Source of truth for filters (client view also writes URL) |

### Risks / TODOs

1. **Unused import:** `DetailTopBar` — dead import noise; same pattern on sibling admin pages.
2. **Static `OPERATIONS` vs DB:** Filter options hardcode six verbs; if DB gains ops not in list, they still appear in rows but not in dropdown.
3. **`Number(sp.page)`:** Non-numeric `page` → `NaN` → `|| 1` OK; scientific / huge numbers not capped.
4. **`listUsers()` cost:** Loads every user (with role joins) only to project `{userId, email}` for a filter dropdown — heavy for large orgs.
5. **Permission OR:** Comment says “Gated to audit:read (admin / compliance / partner roles)” but code also allows `user:manage` alone — document drift.
6. **No layout-level gate:** Relies on page-level check only; any nested client leak is N/A here since data is server-fetched into props.
7. **Hash chain:** Described in copy only; integrity verification is not performed on this page (only row_hash fields available in child view).

---

## 2. `src/app/admin/dashboard-view.tsx`

| Field | Value |
|--------|--------|
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/admin/dashboard-view.tsx` |
| **Lines** | 564 |
| **Kind** | Client component (`"use client"`) |
| **Route consumer** | Rendered by `/admin` server page (not in this batch) |

### Role

Presentational client view for the **admin system dashboard**: KPI bento, security-posture health rail, audit hash-chain status, top actors, recent audit table, operation/entity breakdown bars. Mount-based framer-motion (initial→animate), not `whileInView`, so headless snapshots and first paint stay animated/predictable. Only transform/opacity animate.

### Exports

| Export | Kind | Signature |
|--------|------|-----------|
| `AdminDashboardViewProps` | interface | See below |
| `AdminDashboardView` | function component | `({ stats, health, recent, entityBreak, opBreak, topActors }: AdminDashboardViewProps) => JSX` |

**`AdminDashboardViewProps`:**

```ts
export interface AdminDashboardViewProps {
  stats: SystemStats;
  health: SystemHealth;
  recent: AuditLogRow[];
  entityBreak: { entityType: string; n: number }[];
  opBreak: { operation: string; n: number }[];
  topActors: { actorEmail: string | null; n: number }[];
}
```

**Types imported from `@/features/admin/queries`:**

```ts
interface SystemStats {
  userCount: number;
  activeUserCount: number;
  roleCount: number;
  permissionCount: number;
  dealCount: number;
  partyCount: number;
  creditAnalysisCount: number;
  auditLogCount: number;
  dbSizeBytes: number;
}

interface SystemHealth {
  activeUsers: number;
  inactiveUsers: number;
  lockedUsers: number;
  mfaEnrolledUsers: number;
  neverLoggedIn: number;
  auditChainedRows: number;
  auditTotalRows: number;
  lastEventAt: Date | null;
}

// AuditLogRow — same as §1 (from compliance re-export)
```

**Module-local (not exported):**

| Symbol | Kind | Role |
|--------|------|------|
| `EASE` | `const [0.32, 0.72, 0, 1]` | cubic-bezier token |
| `relativeTime(v)` | function | Relative time strings |
| `prettify(s)` | function | `_` → space |
| `maxEntity(rows)` | arrow | max `n` for bar scale |
| `maxOp(rows)` | function | max `n` for bar scale |
| `KpiTile` | function component | KPI card + motion |
| `HealthTile` | function component | Health metric tile |

### Imports

| Import | From |
|--------|------|
| `* as React` | `react` |
| `Link` | `next/link` |
| `motion` | `framer-motion` |
| Phosphor icons: `Users`, `Keyhole`, `Handshake`, `Buildings`, `Database`, `ShieldCheck`, `ShieldWarning`, `LockSimple`, `Fingerprint`, `UserCircle`, `ArrowRight`, `SealCheck`, `LinkBreak`, `Hash`, `Lightning` | `@phosphor-icons/react` |
| type `Icon as PhosphorIcon` | `@phosphor-icons/react` |
| `cn` | `@/lib/utils` |
| types `SystemStats`, `SystemHealth`, `AuditLogRow` | `@/features/admin/queries` |
| Brand UI: `Card`, `CardBody`, `CardHeader`, `CardTitle`, `Eyebrow`, `StatCard`, `Badge`, `ActionBadge`, `actionFromVerb`, `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`, `EmptyState`, `IconTile` | `@/components/brand` |

**Allowed here:** Direct `@phosphor-icons/react` is OK because this is a **client** component (AGENTS.md restriction is for RSC).

### Business purpose

- At-a-glance **system volume** (users, roles, deals, parties, DB size).
- **Security posture**: active/inactive/locked/MFA/never-logged-in + audit chain coverage %.
- **Operational forensics preview**: last audit events, top actors, op mix, entity mix — with link to full `/admin/audit`.

### Key logic

1. **Chain health**
   ```ts
   const chainPct =
     health.auditTotalRows > 0
       ? Math.round((health.auditChainedRows / health.auditTotalRows) * 100)
       : 0;
   const chainHealthy = chainPct === 100;
   ```
   - 100% only when every sampled/total row has `row_hash`; else “Chain gap detected” with missing-row count.

2. **KPI bento (5 tiles)**
   - Users → `stats.userCount`, hint active
   - Roles → `stats.roleCount`, hint permissions
   - Deals → `stats.dealCount`
   - Parties → `stats.partyCount`
   - DB size → `stats.dbSizeBytes / (1024*1024)`, preset `decimal1`, suffix `" MB"`, hint audit row count (`en-IN` locale)

3. **Health tiles (6)** with tone:
   - `good` | `warn` | `bad` | `neutral` driven by zero/nonzero thresholds
   - Audit chain uses % + good/bad

4. **Top actors list**  
   - Rank 1…n; null email → `"System / trigger"`; badge with count

5. **Recent audit table**  
   - Columns: Operation (`ActionBadge` via `actionFromVerb(row.operation)`), Entity (`prettify` + optional `fieldName`), Actor (md+), When (`relativeTime`)
   - Link: `/admin/audit` “Open forensic view”
   - Empty: “The log is at genesis.”

6. **Breakdown bars**  
   - Op bars: gold motion width = `n / maxOpN * 100`
   - Entity bars: emerald; label width fixed `w-28`

7. **`relativeTime`** thresholds: just now / 1m / Nm / Nh / Nd / else `en-IN` short date

8. **`KpiTile` props**
   ```ts
   {
     icon: PhosphorIcon;
     label: string;
     value: number;
     preset: "int" | "decimal1" | "decimal3" | "percent1" | "currency" | "raw";
     suffix?: string;
     hint?: string;
     ambient?: boolean; // gold IconTile tone on lead tile
   }
   ```

9. **`HealthTile` props**
   ```ts
   {
     icon: PhosphorIcon;
     label: string;
     value: number;
     suffix?: string;
     tone: "good" | "warn" | "bad" | "neutral";
   }
   ```

### Side effects

| Effect | Detail |
|--------|--------|
| Client-only | `"use client"`; no server data fetch |
| No network | Pure props rendering |
| Motion | framer-motion on mount for KPI tiles + bar widths |
| Navigation | Next `Link` to `/admin/audit` |
| Time | `Date.now()` in `relativeTime` — values drift if long-lived SPA without remount |

### Security / RBAC

- **No auth checks in this file** — assumes parent `/admin` page already gated.
- Displays security-sensitive aggregates (locked users, MFA counts) and recent audit actor emails / operations.
- Does not expose `oldValue`/`newValue` (recent rail is summary-only).
- If parent mis-gates, entire dashboard data is visible.

### Coupling

| Coupled to | How |
|------------|-----|
| Parent `src/app/admin/page.tsx` | Must supply all props (not in batch) |
| `@/features/admin/queries` types | Structural contract |
| Brand kit + `actionFromVerb` | Verb → ActionType mapping for badges |
| `/admin/audit` route | Deep link |
| Phosphor + framer-motion | UI/animation |

### Risks / TODOs

1. **`stats.creditAnalysisCount` unused** — fetched in `SystemStats` but never shown in KPIs.
2. **`health.activeUsers`** — queries.ts comment notes it may be filled from stats; if left 0, “Active users” health tile can be wrong while KPI shows correct active count via `stats`.
3. **Chain “integrity” is coverage, not verification** — % with non-null `row_hash`, not cryptographic walk of `prev_hash`.
4. **Locale hardcoding** — `en-IN` for numbers/dates (product choice for Binary Capital India).
5. **No pagination on recent** — fully parent-controlled limit.
6. **Accessibility** — motion widths decorative; rank list is semantic `ol`; table empty state uses `colSpan={4}`.

---

## 3. `src/app/admin/loading.tsx`

| Field | Value |
|--------|--------|
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/admin/loading.tsx` |
| **Lines** | 60 |
| **Kind** | Next.js App Router **loading UI** (Suspense boundary for `/admin/*`) |
| **Route** | Applies while any `/admin` segment (and children that bubble) load |

### Role

Instant-feedback skeleton shell for admin routes (dashboard, users, roles, master-data, audit). Mirrors admin dashboard layout: 5 KPI cards, health grid + side rail, then table rows — so navigation feels native vs generic global `loading.tsx`.

### Exports

| Export | Kind | Signature |
|--------|------|-----------|
| `default` | function | `AdminLoading(): JSX.Element` |

### Imports

| Import | From |
|--------|------|
| `SkeletonPage`, `SkeletonCard`, `Skeleton` | `@/components/brand/skeleton` |

### Business purpose

Perceived performance / layout stability while server components under `/admin` resolve auth + DB. Not business-data related.

### Key logic

```tsx
export default function AdminLoading() {
  return (
    <SkeletonPage title="Admin" eyebrow="System · Users · Roles · Audit" cards={0}>
      {/* 5 KPI skeleton cards: grid 2 / md:3 / lg:5 */}
      {/* Health + side: lg:col-span-2 (6 cells) + 5 list rows */}
      {/* Bottom table: 8 row skeletons */}
    </SkeletonPage>
  );
}
```

- `cards={0}` on `SkeletonPage` — custom children fully own the skeleton body.
- Uses `Array.from({ length: N }).map` for fixed skeleton counts: 5 KPIs, 6 health cells, 5 side items, 8 table rows.

### Side effects

- None: pure presentational; no data, no auth, no redirects.
- Shown by framework during streaming/navigation pending states.

### Security / RBAC

- No RBAC — skeletons are not sensitive.
- Does not leak counts or emails (placeholders only).
- Does not replace authorization; unauthorized users still hit page-level redirects after load completes (may briefly flash skeleton then redirect).

### Coupling

| Coupled to | How |
|------------|-----|
| Next.js loading convention | File name + placement under `admin/` |
| `@/components/brand/skeleton` | Visual primitives |
| Visual parity with `dashboard-view.tsx` | Layout echo (KPI + health + table) |

### Risks / TODOs

1. **Shared across all admin children** — users/roles/audit/master-data get a **dashboard-shaped** skeleton even when their final UI differs (acceptable UX trade-off; slight layout jump possible).
2. **No exclusive loading.tsx under subroutes** in this batch — this file is the segment-level default.
3. **No dynamic data** — cannot show real partial stats during load (by design).

---

## 4. `src/app/admin/master-data/page.tsx`

| Field | Value |
|--------|--------|
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/src/app/admin/master-data/page.tsx` |
| **Lines** | 367 |
| **Kind** | Next.js App Router **server** page (`async` RSC) |
| **Route** | `/admin/master-data` |

### Role

Read-only admin surface for firm **reference catalogues**:

1. **`sector_code`** — hierarchical sector taxonomy (NIC / RBI codes, segment class, level, active).
2. **`rating_ladder`** — cross-agency rating rank reference.
3. **Enum catalogues** (hardcoded mirrors of Postgres enums): `deal_type`, `instrument_type`, `rating_agency`, `rating_scale`.

Edits deferred (“future pass”); schema already supports soft-delete + `updated_at` on reference tables.

### Exports

| Export | Kind | Signature / value |
|--------|------|-------------------|
| `dynamic` | const | `export const dynamic = "force-dynamic"` |
| `metadata` | const | `{ title: "Master data · Admin · Binary Capital CRM" }` |
| `default` | async function | `AdminMasterDataPage(): Promise<JSX>` |

**Module-local helpers (not exported):**

| Symbol | Props / signature |
|--------|-------------------|
| `MasterSection` | `{ icon: React.ReactNode; eyebrow: string; title: string; description: string; count: number; children: React.ReactNode }` |
| `EnumSection` | `{ icon: React.ReactNode; eyebrow: string; title: string; description: string; codes: { code: string; hint: string \| null }[] }` |
| `prettify(s: string): string` | `s.replace(/_/g, " ")` |
| `SectionIcon` | `{ children: React.ReactNode; tone?: "neutral" \| "gold" }` |

### Imports

| Import | From | Usage |
|--------|------|--------|
| `redirect` | `next/navigation` | Unauthorized → `/parties` |
| `requireUser`, `can` | `@/lib/rbac` | Gate `user:manage` |
| `listSectorCodes`, `listRatingLadder`, `countDealsByType`, `DEAL_TYPES`, `INSTRUMENT_TYPES`, `RATING_AGENCIES`, `RATING_SCALES`, type `SectorCodeRow`, type `RatingLadderRow` | `@/features/admin/queries` | Data + enums |
| Brand: `Reveal`, `Card`, `CardBody`, `Eyebrow`, `Badge`, `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `EmptyState`, `RatingLadderMark` | `@/components/brand` | UI |
| `Buildings`, `Handshake`, `Coins`, `SealCheck` | `@/components/brand/icons` | **RSC-safe** phosphor boundary |
| `PageShell`, `PageHeader`, `DetailTopBar` | `@/components/brand/page-shell` | Layout |

**Critical pattern (commented in file):** Phosphor icons **must not** be imported from `@phosphor-icons/react` in server components — use `@/components/brand/icons`.

**Unused import:** `DetailTopBar` (imported, never used).  
**Type-only imports:** `SectorCodeRow`, `RatingLadderRow` are imported as types but **only used implicitly via inference** from query results — not referenced as annotations in the file body (may be unused type imports depending on `verbatimModuleSyntax` / eslint).

### Quoted types / catalogues (from data layer)

**`SectorCodeRow`:**

```ts
{
  sectorCodeId: string;
  code: string;
  nicCode: string | null;
  rbiSectoralDeploymentCode: string | null;
  label: string;
  parentSectorCodeId: string | null;
  segmentClass: string | null;
  level: number;
  isActive: boolean;
}
```

**`RatingLadderRow`:**

```ts
{
  ladderId: string;
  agency: string;
  scale: string;
  symbol: string;
  rank: number;
  definition: string | null;
}
```

**`DEAL_TYPES` (18):**  
`bond_underwriting`, `gsec_auction`, `high_yield_bond`, `rating_advisory`, `m_and_a`, `project_finance`, `structured_finance`, `supply_chain_finance`, `ecm_ipo`, `ecm_fpo`, `ecm_qip`, `ecm_rights`, `dcm_advisory`, `private_placement_debt`, `valuation`, `fairness_opinion`, `portfolio_management_mandate`, `secondary_trading_advisory`

**`INSTRUMENT_TYPES` (14):**  
`corp_bond`, `ncd`, `cp`, `gsec`, `sdl`, `tbill`, `sgb`, `structured_credit`, `municipal_bond`, `eco_bond`, `equity`, `preference_share`, `warrant`, `convertible`

**`RATING_AGENCIES` (7):**  
`CRISIL`, `ICRA`, `CARE`, `India_Ratings`, `Acuite`, `Infomerics`, `Brickwork`

**`RATING_SCALES` (5):**  
`long_term`, `short_term`, `structured`, `sovereign`, `state_guaranteed`

**`countDealsByType(): Promise<Map<string, number>>`** — live deal counts per `deal_type` (non-deleted).

### Business purpose

- Single admin place to **inspect** reference data that drives CRM dropdowns and credit routing.
- Sector taxonomy → credit-scorecard template routing + sectoral exposure.
- Rating ladder → cross-agency rank comparability; `external_rating.rating_rank` snapshotted historically.
- Enum chips → mandate types / instruments / SEBI CRAs / scale taxonomy.
- Deal-type chips annotate usage: `` `${count} deals` `` when count present.

### Key logic

1. **Auth**
   ```ts
   const user = await requireUser();
   if (!can(user, "manage", "user")) redirect("/parties");
   ```
   Stricter than audit page: **only** `user:manage` (or admin/super_admin via `can`).

2. **Parallel load**
   ```ts
   Promise.all([listSectorCodes(), listRatingLadder(), countDealsByType()])
   ```

3. **Sector table columns:** Code, Label (+ inactive badge), NIC (md+), RBI (lg+), Class (md+, prettified), Level (right).  
   Key: `s.sectorCodeId`. Empty → seed hint.

4. **Rating ladder columns:** Agency, Scale (prettified), Symbol, Rank (right), Definition (md+).  
   Key: `r.ladderId`. Empty → CRISIL seed hint.

5. **Enum grid** `lg:grid-cols-2` with four `EnumSection`s; only deal types get live counts from `Map`.

6. **`SectionIcon`** — local disc well accepting `ReactNode` (Phosphor **or** `RatingLadderMark`); mirrors IconTile but without Phosphor component type constraint. Tones: `neutral` | `gold`.

7. **`MasterSection`** — gold section opener + row count badge + description + children table card.

### Side effects

| Effect | Detail |
|--------|--------|
| Session + RBAC | `requireUser` / `can` |
| Redirects | Login / `/parties` |
| DB reads | `sector_code`, `rating_ladder`, `deal` (grouped count) |
| Mutations | None (read-only UI) |
| Force dynamic | Always re-render with fresh DB |

### Security / RBAC

| Control | Detail |
|---------|--------|
| **Permission** | `user:manage` (admin surface) |
| **Data sensitivity** | Low–medium: firm taxonomy and enum catalogues; deal counts reveal volume by mandate type (not party-level) |
| **Write surface** | None — reduces blast radius |
| **Enum drift risk** | Hardcoded arrays can diverge from Postgres enums if migration adds values without updating `DEAL_TYPES` etc. |

### Coupling

| Coupled to | How |
|------------|-----|
| `@/features/admin/queries` | Tables + enum constants + counts |
| `@/db/schema` (indirect) | `sector_code`, `rating_ladder`, `deal` |
| Brand icons boundary | RSC-safe phosphor |
| Spec comments | “Credit spec §13 · DATA_MODEL §2.23.11”, “§2.23.7” — documentation coupling only |
| Future edit UI | Soft-delete/updated_at readiness mentioned but not implemented |

### Risks / TODOs

1. **Unused `DetailTopBar` import.**
2. **Possible unused type imports** (`SectorCodeRow`, `RatingLadderRow`) if not referenced in value positions.
3. **`React.ReactNode` used without `import React` / `import type { ReactNode }`** — relies on global JSX namespace / automatic runtime types; may fail under stricter TS configs.
4. **Read-only / future edits** — explicit TODO in file header for mutation UI.
5. **Enum catalogues duplicated** from `src/db/schema/enums.ts` into queries constants — dual source of truth.
6. **No hierarchical tree UI for sectors** — flat table ordered by code; `parentSectorCodeId` loaded but **not displayed**.
7. **No filter/search/pagination** — full sector + ladder dump; can grow large.
8. **Instrument/agency/scale counts** not computed (only deal types) — asymmetric UX.
9. **Eyebrow copy hardcodes counts** (“18 values”, “14 values”, …) — will rot if arrays change without copy update.

---

## Cross-file summary (batch 015)

| File | Server/Client | Primary gate | Data |
|------|---------------|--------------|------|
| `admin/audit/page.tsx` | Server | `audit:read` **or** `user:manage` | Paginated audit + filters |
| `admin/dashboard-view.tsx` | Client | (parent) | Props: stats/health/recent/breaks |
| `admin/loading.tsx` | Shared loading | None | Skeleton only |
| `admin/master-data/page.tsx` | Server | `user:manage` | Sectors, ladder, enum chips, deal counts |

### Shared patterns

- Admin brand: `PageShell` + `PageHeader` + `Reveal` (pages).
- `force-dynamic` on data pages.
- Soft unauthorized redirect to `/parties` (not HTTP 403).
- `DetailTopBar` imported unused on both pages — consistent dead import across admin.
- Locale `en-IN` on dashboard numbers.
- Phosphor: client direct import OK; server uses `@/components/brand/icons`.

### Tables / entities touched (via queries)

| Table / concept | Used by |
|-----------------|---------|
| `audit_log` | audit page, (dashboard-view displays props from parent) |
| `app_user` | audit page (`listUsers`), dashboard health/stats (via parent) |
| `sector_code` | master-data |
| `rating_ladder` | master-data |
| `deal` | master-data (`countDealsByType`) |
| Postgres enums (mirrored) | master-data display |

### Suggested follow-ups (not implemented)

- Remove unused `DetailTopBar` imports.
- Align audit gate comment with code (`user:manage` OR).
- Show `parentSectorCodeId` / tree view; paginate master tables.
- Verify `health.activeUsers` wiring on admin parent page.
- Deduplicate enum lists with schema single source.
- Optional dedicated `loading.tsx` under heavy subroutes if layout jump becomes an issue.
