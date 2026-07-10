# Agent 062 — Extreme detail analysis

Batch files: `src/components/ui/sonner.tsx`, `src/components/ui/table.tsx`, `src/components/ui/tabs.tsx`, `src/db/context.ts`

Transition batch: last UI primitives + the **RLS transaction context** helper that every feature write path depends on.

---

## `src/components/ui/sonner.tsx`

- **Lines:** 50 | **Role:** Themed toast host wrapping `sonner`
- **Exports:** `const Toaster = ({ ...props }: ToasterProps) => ...`
- **Imports:** `next-themes` (`useTheme`); `sonner` (`Toaster as Sonner`, `ToasterProps`); lucide icons (`CircleCheckIcon`, `InfoIcon`, `TriangleAlertIcon`, `OctagonXIcon`, `Loader2Icon`)
- **Business purpose:** Global success/error toasts after server actions (user created, KYC transitioned, ratios run)
- **Key logic:**
  - `theme` from `useTheme()` default `"system"`, cast to `ToasterProps["theme"]`
  - Icon map for success/info/warning/error/loading
  - CSS variables: `--normal-bg: var(--popover)`, `--normal-text`, `--normal-border`, `--border-radius: var(--radius)`
  - `toastOptions.classNames.toast = "cn-toast"`
- **Side effects:** Client theme subscription; toast queue in memory
- **Security / RBAC:** Never put secrets/PII in toast strings (client-visible)
- **Coupling:** Requires `ThemeProvider` + root layout mount of `<Toaster />`
- **Risks / TODOs:** Uses `React.CSSProperties` without explicit `import React` — relies on JSX runtime ambient types

---

## `src/components/ui/table.tsx`

- **Lines:** 117 | **Role:** Semantic HTML table composition with horizontal scroll shell
- **Exports:** `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableHead`, `TableRow`, `TableCell`, `TableCaption`
- **Imports:** `react`; `@/lib/utils`
- **Business purpose:** Admin users grid, audit log, KYC lists, deal parties, ratio tables
- **Key logic:**
  - `Table` wraps `<table>` in `div[data-slot=table-container].relative.w-full.overflow-x-auto`
  - Row hover: `hover:bg-muted/50`, selected: `data-[state=selected]:bg-muted`
  - Checkbox-aware padding: `[&:has([role=checkbox])]:pr-0`
  - Footer: `border-t bg-muted/50 font-medium`
- **Side effects / Security:** None
- **Coupling:** Pure HTML — works in RSC and client
- **Risks / TODOs:** No virtualization; large audit pages need pagination (handled in query layer)

---

## `src/components/ui/tabs.tsx`

- **Lines:** 83 | **Role:** Tab navigation via `@base-ui/react/tabs` + CVA variants
- **Exports:** `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `tabsListVariants`
- **Imports:** `@base-ui/react/tabs`; `class-variance-authority` (`cva`, `VariantProps`); `@/lib/utils`
- **Business purpose:** Credit detail tabs (overview/ratios/scorecard), compliance KYC/consent, party 360 sections
- **Key logic:**
  - `Tabs` root: `orientation = "horizontal"` default; `data-orientation`; horizontal layout uses `data-horizontal:flex-col` on group
  - `tabsListVariants`: `variant: default | line` (default = muted pill bg; line = underline style)
  - Trigger active: `data-active:bg-background data-active:text-foreground`; line variant uses `after:` underline opacity
  - Content: `flex-1 text-sm outline-none`
- **Side effects / Security:** None
- **Coupling:** Base UI Tab/List/Panel prop names (not Radix `value` semantics may differ slightly)
- **Risks / TODOs:** Complex group-data CSS for line variant may break if Base UI changes `data-active` attribute names

---

## `src/db/context.ts`

- **Lines:** 160 | **Role:** **Critical infrastructure** — sets Postgres session GUCs for Row Level Security per transaction
- **Exports:**
  - `async function withContext(tx: Tx, userId: string, wallTags: string[] = [], mandateIds: string[] = []): Promise<void>`
  - `async function withRls<T>(userId: string, wallTags: string[], mandateIds: string[], work: (tx: Tx) => Promise<T>): Promise<T>`
  - `async function withRlsRead<T>(userId: string, wallTags: string[], mandateIds: string[], work: (tx: Tx) => Promise<T>): Promise<T>`
  - Internal type `Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]`
- **Imports:** `drizzle-orm` `sql`; `@/db` (`db`)
- **Business purpose & domain concepts:**
  - Implements ARCHITECTURE §4.4 Chinese-wall / mandate-scope ABAC at the DB session level
  - GUCs:
    - `app.user_id` — acting `app_user.user_id` as text
    - `app.wall` — barrier clearance tags (text array literal form)
    - `app.mandate_ids` — deal IDs user is staffed on
  - Tables whose policies consult these: `deal`, `deal_party`, `allocation_event`, `credit_*`, `interaction`, `document`, `party`, etc. (see `WALLED_TABLES` in `rls.ts`)
- **Key logic / algorithms / data shapes:**
  1. **Literal embedding (not `$1`):** `SET LOCAL` is a utility command and cannot take parameters. Values are trusted JWT-derived UUIDs/tags embedded via `sql.raw` after quote escaping:
     - `lit(s)` → `'...'` with `'` doubled
     - `textArrLit(arr)` → `'{"a","b"}'` with `\` and `"` escaped; empty → `'{}'`
  2. **withRls ordering:**
     - `db.transaction` → `withContext` → `work(tx)` → **POST-TXN GUC cleanup**:
       - `SET app.wall = '{}'` and `SET app.mandate_ids = '{}'` (session-level `SET`, not `SET LOCAL`) as last statements **inside** the committing txn so they persist on the pooled connection
  3. **Why cleanup exists (documented bugfix):**
     - After commit, `SET LOCAL` reverts custom GUCs to `''` (empty string), not NULL
     - RLS helpers cast `current_setting('app.wall')::text[]`; `''::text[]` throws "malformed array literal"
     - Postgres `OR` does not short-circuit, so fail-open `app.user_id IS NULL` cannot save the cast
     - Symptom: RSC re-render after every write action 500'd on reused pool connection
     - Residual effect: `app.user_id` stays `''`; fail-open IS NULL won't fire; **walled rows (1.8–13% with barrier_id) may be hidden** on post-write re-render, but query succeeds
  4. **withRlsRead:** same SET LOCAL, no session-level cleanup (read path expects txn-scoped GUCs only)
- **Side effects:** Session GUCs on pooled connections; must only run server-side with real auth context
- **Security / RBAC:**
  - Values are auth-context only — **never user free-text** (comment insists); still double-escapes quotes
  - App role must have FORCE RLS; never use BYPASSRLS app connection
  - Incomplete wall tags → under-privilege (hidden MNPI) not over-privilege if policies default deny
- **Coupling:** Every `features/*/actions.ts` that mutates walled tables; `requireUser()` supplies wall tags; pairs with `drizzle/0003_rls.sql` policies
- **Risks / TODOs:**
  - Residual walled-row hide after write is an intentional trade-off (document for ops)
  - Cannot RESET GUC to NULL; RLS functions owned by `postgres` cannot be replaced by app role
  - If a caller passes user-controlled strings into wallTags, quote escape is last line of defense — callers must not
