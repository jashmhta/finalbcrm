# Agent 005 — File-by-file analysis

**Batch:** `batch-005.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Note on routing layout:** The Next.js App Router for this project lives under `src/app/` (see `tsconfig.json` paths `@/*` → `./src/*`, and the full route tree under `src/app/`). The batch paths `page.tsx` and `login/page.tsx` sit at the **project root**, not under `app/` or `src/app/`. They are therefore **not** registered as App Router routes by Next.js unless some nonstandard convention applies. Parallel, more complete implementations exist at `src/app/page.tsx` and `src/app/login/page.tsx`. Root copies look like early/stub UI retained alongside the production `src/app` tree.

---

## 1. `login/page.tsx`

| Field | Value |
|--------|--------|
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/login/page.tsx` |
| **Lines** | 27 |
| **Kind** | Next.js page module (Server Component by default; no `"use client"`) |
| **Route (if under App Router)** | Would be `/login` only if this file lived under `app/login/` or `src/app/login/`. At project root `login/`, it is **not** an App Router page. Production login is `src/app/login/page.tsx`. |

### Role

Thin presentational **sign-in shell**: page metadata + centered card wrapping the client `LoginForm`. No auth logic, no DB, no server actions in this file.

### Exports

```ts
export const metadata: Metadata = {
  title: "Sign in — Binary CRM",
};

export default function LoginPage(): JSX.Element
```

- **`metadata`**: Next.js static metadata object (`import type { Metadata } from "next"`).
- **`LoginPage`**: default page component; no props, no async.

### Imports

| Import | From | Purpose |
|--------|------|---------|
| `Metadata` (type) | `next` | Typed page metadata |
| `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle` | `@/components/ui/card` → resolves to `src/components/ui/card` | shadcn-style card chrome |
| `LoginForm` | `./login-form` → `login/login-form.tsx` | Client form; binds to `login` server action |

### Business purpose

Entry surface branding for **Binary Capital / Binary Bonds CRM** staff authentication. Copy identifies the firm product; form collects email/password for session establishment (actual credential check is in sibling `login/actions.ts` / Auth.js, not here).

### Key logic

1. Set document title via `metadata`.
2. Render full-width flex center layout (`bg-muted/30`).
3. Card max width `max-w-sm` with title “Sign in”, description “Binary Capital / Binary Bonds CRM”, body = `<LoginForm />`.

No branching, no data fetching, no searchParams handling (contrast: `src/app/login/page.tsx` accepts `callbackUrl`, brand panel, logo, `force-dynamic`).

### Side effects

- None at runtime in this module (pure render).
- Child `LoginForm` uses `useActionState` → server action `login` (session cookie mutation lives outside this file).
- Metadata export affects HTML `<title>` only if this page is actually routed.

### Security / RBAC

| Concern | Assessment |
|---------|------------|
| Auth gate | Page itself is intended as **public**; does not call `requireUser`. Proxy (`src/proxy.ts`) treats `/login` as public and redirects already-authenticated users away from `/login`. |
| Secrets | None in this file. |
| CSRF / credentials | Deferred to form action + Auth.js; not handled here. |
| Information disclosure | Description only names the product; no stack/error leakage. |
| Dev stub risk (sibling) | `login-form.tsx` documents: *“Dev-only credentials stub: any non-empty password works for a known app_user email. Replace with a real IdP + MFA before production.”* — not in this file but product-critical adjacent surface. |

No permission codes, walls, or brand scopes applied here.

### Coupling

- **Tight:** `./login-form` (must export `LoginForm`).
- **UI kit:** `@/components/ui/card` (design-system dependency).
- **Parallel/orphan risk:** Duplicates concept of `src/app/login/page.tsx` with different components (`@/components/brand/card` vs ui/card) and richer UX. Root `login/` may confuse maintainers if both trees are edited.
- **Sibling modules in same folder:** `login/actions.ts`, `login/login-form.tsx` (not in this batch).

### Risks / TODOs

1. **Likely dead / non-routed** if Next only uses `src/app` — risk of editing the wrong login page.
2. No `callbackUrl` support (open-redirect-safe handling exists only in `src/app/login/page.tsx`).
3. No `export const dynamic` (immaterial for static shell).
4. No accessibility extras beyond form fields inside child.
5. Depends on stub auth story in form/actions until production IdP+MFA.

### Signature / structure quote

```tsx
export const metadata: Metadata = {
  title: "Sign in — Binary CRM",
};

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-sm">
        {/* ... */}
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 2. `next.config.ts`

| Field | Value |
|--------|--------|
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/next.config.ts` |
| **Lines** | 29 |
| **Kind** | Next.js configuration module |
| **Runtime** | Build / dev server load only |

### Role

Project-wide Next.js config: security header hygiene, compression, React Strict Mode, and package import optimization for icon tree-shaking.

### Exports

```ts
const nextConfig: NextConfig = { /* ... */ };
export default nextConfig;
```

- Typed as `import type { NextConfig } from "next"`.
- Default export consumed by Next CLI (`next dev` / `next build` / `next start`).

### Imports

| Import | From |
|--------|------|
| `NextConfig` (type only) | `next` |

No runtime app imports.

### Business purpose

Infrastructure defaults for the Binary CRM web app:

- Reduce fingerprinting (`x-powered-by` off).
- Keep response compression enabled for Node `next start` (comment notes flip if reverse proxy does Brotli).
- Pin React Strict Mode so double-invocation guards stay on.
- Ensure `@phosphor-icons/react` is in `experimental.optimizePackageImports` so only used icons enter the bundle (~80 icons claimed in comment; recharts already in Next defaults).

### Key logic / config surface

```ts
const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
};
```

| Key | Type (conceptually) | Effect |
|-----|---------------------|--------|
| `poweredByHeader` | `boolean` | Omits `X-Powered-By: Next.js` |
| `compress` | `boolean` | gzip for `next start` |
| `reactStrictMode` | `boolean` | Dev double-render / strict lifecycle |
| `experimental.optimizePackageImports` | `string[]` | Barrel-import optimization for Phosphor |

No `images`, `headers()`, `rewrites`, `redirects`, `output: 'standalone'`, env, or transpilePackages here (those may live elsewhere or rely on defaults).

### Side effects

- Applied process-wide when Next starts/builds.
- Changes icon evaluation graph and HTTP response headers for all routes.
- No DB, auth, or filesystem writes from this file.

### Security / RBAC

| Setting | Security angle |
|---------|----------------|
| `poweredByHeader: false` | Minor info-leak reduction |
| No CSP / security headers | Not defined here; if needed, must be elsewhere (proxy, hosting, or `headers()`) |
| No auth config | Auth is Auth.js / `src/lib/auth.ts` + `src/proxy.ts`, not Next config |

No RBAC.

### Coupling

- Package name string **`@phosphor-icons/react`** must match `package.json` dependency.
- Assumes App Router + React 19 / Next 16 stack from `package.json` (`next: 16.2.9`).
- Comment references Turbopack tree-shaking behavior and recharts default list — coupled to Next version internals.

### Risks / TODOs

1. **`experimental` API** can change across Next minor versions (project already on Next 16.2.9).
2. No `output: "standalone"` here despite `Dockerfile` in repo — deploy may rely on other config or defaults; worth verifying against `docs/DEPLOYMENT.md` (docs ignored for deep content per brief).
3. Compression double-work if nginx/CDN also compresses (comment already flags this).
4. No image remotePatterns / domains if external avatars/logos are added later.
5. Missing explicit security headers (HSTS, CSP, X-Frame-Options) if not at edge.

---

## 3. `package.json`

| Field | Value |
|--------|--------|
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/package.json` |
| **Lines** | 57 |
| **Kind** | npm package manifest |
| **Name / version** | `"name": "app"`, `"version": "0.1.0"`, `"private": true` |

### Role

Declares project identity, npm scripts, production and development dependencies for the Binary CRM Next.js application (auth, ORM, UI, charts, validation, DB tooling, tests).

### Exports

Not a JS module export surface. JSON keys:

- `name`, `version`, `private`
- `scripts` (object)
- `dependencies` (object)
- `devDependencies` (object)

### Imports

N/A (manifest). Consumed by npm/yarn/pnpm and tooling.

### Business purpose

Locks the technology stack for an India capital-markets CRM:

| Domain | Packages |
|--------|----------|
| Framework | `next@16.2.9`, `react@19.2.4`, `react-dom@19.2.4` |
| Auth / sessions | `next-auth@^5.0.0-beta.31`, `@auth/drizzle-adapter@^1.11.2`, `bcryptjs`, `otpauth` (TOTP/MFA ready) |
| Data | `drizzle-orm@^0.45.2`, `postgres@^3.4.9`, `drizzle-kit` (dev) |
| UI | `@base-ui/react`, `shadcn@^4.12.0`, `lucide-react`, `@phosphor-icons/react`, `framer-motion`, `next-themes`, `sonner`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css` |
| Charts / data UX | `recharts`, `papaparse` (+ `@types/papaparse`) |
| Validation | `zod@^4.4.3` |
| CSS pipeline | `tailwindcss@^4`, `@tailwindcss/postcss@^4` |
| Quality | `eslint`, `eslint-config-next@16.2.9`, `typescript@^5`, `vitest@^4.1.9` |
| Automation / dogfood | `puppeteer-core@^24.43.1` (scripts/screenshots) |

### Scripts (signatures)

```json
"dev": "next dev",
"build": "next build",
"start": "next start",
"lint": "eslint",
"db:generate": "drizzle-kit generate",
"db:push": "drizzle-kit push",
"db:migrate": "drizzle-kit migrate",
"db:studio": "drizzle-kit studio",
"db:drop": "drizzle-kit drop"
```

No `test` script defined despite `vitest` and `src/__tests__/` (tests likely invoked via `npx vitest` / CI config outside this file).

### Key logic

Declarative only. Version pins:

- **Exact:** `next`, `react`, `react-dom`, `eslint-config-next` (patch-locked `16.2.9` / `19.2.4`).
- **Caret ranges:** most libraries, including **Auth.js beta** (`next-auth@^5.0.0-beta.31`).

### Side effects

- Installing deps populates `node_modules` / lockfile.
- `db:*` scripts mutate schema/migrations when run (operational risk if misused in prod).
- `db:drop` is destructive.

### Security / RBAC

| Item | Note |
|------|------|
| `private: true` | Prevents accidental npm publish |
| `bcryptjs`, `otpauth` | Password hashing + TOTP stack present |
| `next-auth` beta | Pre-stable Auth.js v5; watch CVE/changelog |
| `puppeteer-core` | Dev automation; ensure not exposed in production image unnecessarily |
| No dependency audit in-file | Supply-chain risk managed outside manifest |

No application RBAC encoding.

### Coupling

- Must stay aligned with `next.config.ts` (`optimizePackageImports` ↔ `@phosphor-icons/react`).
- `drizzle-kit` scripts ↔ `drizzle.config.ts` + `drizzle/` migrations.
- `eslint-config-next` version should track `next`.
- Path alias `@/*` → `src/*` is in `tsconfig.json`, not here, but all app imports assume this layout.
- Auth adapter package couples Auth.js to Drizzle schema tables (`src/db/schema/auth.ts` et al.).

### Risks / TODOs

1. **`next-auth` still on beta** — production readiness and API stability risk.
2. **No `test` / `typecheck` scripts** — easy for CI to omit Vitest/tsc.
3. **`db:push` / `db:drop`** available as npm scripts — dangerous if run against shared/prod DBs without guardrails.
4. Dual icon libraries (`lucide-react` + `@phosphor-icons/react`) increase bundle surface if both used broadly.
5. `zod` v4 major — ensure all validators match v4 APIs.
6. Package name `"app"` is generic; fine for private monorepo leaf, weak for identification in logs/registries.
7. Version `0.1.0` signals early product stage.

### Full dependency quote (production)

```json
"@auth/drizzle-adapter": "^1.11.2",
"@base-ui/react": "^1.6.0",
"@phosphor-icons/react": "^2.1.10",
"bcryptjs": "^3.0.3",
"class-variance-authority": "^0.7.1",
"clsx": "^2.1.1",
"drizzle-orm": "^0.45.2",
"framer-motion": "^12.42.0",
"lucide-react": "^1.21.0",
"next": "16.2.9",
"next-auth": "^5.0.0-beta.31",
"next-themes": "^0.4.6",
"otpauth": "^9.5.1",
"papaparse": "^5.5.4",
"postgres": "^3.4.9",
"react": "19.2.4",
"react-dom": "19.2.4",
"recharts": "^3.9.0",
"shadcn": "^4.12.0",
"sonner": "^2.0.7",
"tailwind-merge": "^3.6.0",
"tw-animate-css": "^1.4.0",
"zod": "^4.4.3"
```

---

## 4. `page.tsx` (project root)

| Field | Value |
|--------|--------|
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/page.tsx` |
| **Lines** | 88 |
| **Kind** | Async Server Component page module |
| **Route (if under App Router)** | Would be `/` only under `app/page.tsx` or `src/app/page.tsx`. At **project root**, this is **not** a standard App Router entry. Production dashboard is the richer `src/app/page.tsx` (KPI strips, pipeline, `getDashboardData`, etc.). |

### Role

Minimal **authenticated home dashboard**: greet user, show soft-deleted-filtered counts of parties and deals, display information-barrier wall membership, link to `/parties` and `/deals`.

### Exports

```ts
export const dynamic = "force-dynamic";

export default async function HomePage(): Promise<JSX.Element>
```

- **`dynamic`**: disables static prerender; required because page queries DB and needs `DATABASE_URL` at request time (comment documents build-time failure without this).
- **`HomePage`**: default async server page; no props.

### Imports

| Import | From | Resolved / purpose |
|--------|------|-------------------|
| `Link` | `next/link` | Client navigation wrappers on cards |
| `requireUser` | `@/lib/rbac` → `src/lib/rbac.ts` | AuthN gate; returns `CrmUser` or `redirect("/login")` |
| `db` | `@/db` → `src/db/index.ts` | Drizzle postgres-js client |
| `deal`, `party` | `@/db/schema` → schema index | Tables for counts |
| `count`, `isNull` | `drizzle-orm` | Aggregate + soft-delete filter |
| `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle` | `@/components/ui/card` | Metric cards |

### Types / signatures (coupled)

From `src/lib/rbac.ts` (consumed, not defined here):

```ts
export interface CrmUser {
  id: string;
  email: string;
  name?: string | null;
  appUserId: string | null;
  roles: string[];
  wall: string[];
  permissions: Set<string>;
  desk: string | null;
  brandScope: BrandScope;
}

export async function requireUser(): Promise<CrmUser>
```

Tables (soft-delete columns used):

- `party.deletedAt` → column `deleted_at` (`src/db/schema/party.ts`)
- `deal.deletedAt` → column `deleted_at` (`src/db/schema/deals.ts`)

`deal` table (excerpt of business columns, for context of what is being counted):

```ts
export const deal = pgTable("deal", {
  dealId: uuid("deal_id").defaultRandom().primaryKey(),
  dealCode: text("deal_code"),
  dealType: dealTypeEnum("deal_type").notNull(),
  // ...
  brand: brandEnum("brand").notNull(),
  // ...
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
});
```

### Business purpose

Post-login **home KPI snapshot** for bankers/RMs:

1. Confirm identity and role set (coverage, admin, etc.).
2. Show firm-wide (query-level) active **party** count — issuers, investors, intermediaries (copy on card).
3. Show active **deal** count — “Mandates across IB + DCM”.
4. Surface **information barrier wall** compartment labels from session (`user.wall`), or “No barrier compartments assigned”.

This is a simplified dashboard vs the production `src/app/page.tsx` feature set.

### Key logic

```ts
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();

  const [[partyCount], [dealCount]] = await Promise.all([
    db.select({ n: count() }).from(party).where(isNull(party.deletedAt)),
    db.select({ n: count() }).from(deal).where(isNull(deal.deletedAt)),
  ]);

  // Render welcome + 3 cards (Parties link, Deals link, Wall display)
}
```

| Step | Behavior |
|------|----------|
| 1 | `requireUser()` — if no session/`appUserId`/inactive user → `redirect("/login")` |
| 2 | Parallel `COUNT(*)` on `party` and `deal` where `deleted_at IS NULL` |
| 3 | UI: `user.name ?? user.email`; roles joined or `"none assigned"` |
| 4 | Parties/Deals cards wrap `Link` with `className="contents"` for whole-card hit targets |
| 5 | Wall card non-linking; shows `user.wall.length` or `"—"` |

No brand filter, no desk filter, no `can("party:read")` / `can("deal:read")`, no RLS session GUC setup visible in this file (depends on whether `db` client or a wrapper sets `app.user_id` / wall — root page uses raw `db` from `@/db`, not a contextual RLS helper).

### Side effects

| Effect | Where |
|--------|-------|
| HTTP redirect to `/login` | `requireUser` → `redirect` |
| 2 SQL aggregate queries | Postgres via drizzle |
| Session/JWT read | Inside `getCurrentUser` / `auth()` (via `requireUser`) |
| Permission matrix query | `getCurrentUser` joins `user_role` / `role_permission` / `permission` (side path of requireUser) |

No writes, no cookies set here.

### Security / RBAC

| Control | Present? | Detail |
|---------|----------|--------|
| Authentication | **Yes** | `requireUser()` authoritative server check; comment notes proxy also enforces |
| Authorization (permission codes) | **No** | Does not call `can()`; any authenticated user sees page |
| Data scoping by brand/desk | **No** | Global counts of non-deleted parties/deals |
| Information barriers | **Display only** | Shows `user.wall` labels; counts are **not** wall-filtered |
| Soft delete | **Yes** | `isNull(*.deletedAt)` |
| RLS | **Unclear at this layer** | Uses shared `db`; if RLS requires `SET LOCAL app.user_id` etc., this page may either see all rows (if RLS not applied on connection) or empty/wrong counts (if RLS on without GUC). Architecture comments in `src/proxy.ts` state RLS is authoritative at data layer — **risk if this page bypasses context helpers used elsewhere**. |
| IDOR / sensitive fields | Low for counts only; still firm-wide metrics may be sensitive commercially |

**Proxy coupling** (`src/proxy.ts`): unauthenticated users hitting `/` redirect to `/login?callbackUrl=...`; authenticated users on `/login` bounce to `/parties` (not necessarily this home page).

### Coupling

| Dependency | Nature |
|------------|--------|
| `@/lib/rbac` | Auth + `CrmUser` shape (`roles`, `wall`, `email`, `name`) |
| `@/db` + `@/db/schema` (`party`, `deal`) | Schema stability of `deletedAt` |
| `drizzle-orm` `count` / `isNull` | Query API |
| UI card primitives | Presentation |
| Routes `/parties`, `/deals` | Must exist (they do under `src/app/`) |
| Parallel `src/app/page.tsx` | **Divergent product surface** — root file is simpler stub; confusion / dead code risk |

### Risks / TODOs

1. **Orphan / non-routed page** relative to `src/app` layout — high maintenance hazard.
2. **Unscoped aggregates** leak firm-wide party/deal volume to any logged-in role (including low-privilege).
3. **No wall / brand filtering** on counts — conflicts with information-barrier product story if this were live.
4. **Possible RLS mismatch** when using raw `db` without request context.
5. Wall card is not a link; no navigation to barrier admin/docs.
6. `user.roles` / `user.wall` come from session claims (`s.roles`, `s.wall`) in `getCurrentUser` — staleness if JWT not refreshed after role changes.
7. Comment acknowledges dual enforcement (proxy + requireUser) — good; still no fine-grained RBAC on metrics.
8. Production dashboard evolution lives under `src/app/page.tsx` + `src/features/dashboard/queries` — this file may be obsolete.

### Render structure quote

```tsx
<div className="flex flex-col gap-6 p-6">
  <h1>Dashboard</h1>
  <p>Welcome back, {user.name ?? user.email}. Roles: {user.roles.join(", ") || "none assigned"}.</p>
  {/* Link → /parties: partyCount.n */}
  {/* Link → /deals: dealCount.n */}
  {/* Card: user.wall length / labels */}
</div>
```

---

## Cross-file observations (batch 005)

| Theme | Finding |
|-------|---------|
| **Stack pin** | Next **16.2.9** + React **19.2.4** + Auth.js **v5 beta** + Drizzle + Postgres + Tailwind 4 |
| **Auth story** | Login shell (root) + form/actions (sibling) + `requireUser` + `src/proxy.ts` coarse gate |
| **Config hygiene** | `poweredByHeader: false`, Strict Mode, Phosphor optimize imports |
| **Duplication** | Root `login/page.tsx` / `page.tsx` vs polished `src/app/*` equivalents — treat root files as **legacy stubs** unless proven otherwise by Next root dir config |
| **Security debt** | Dev password stub adjacent to login; unscoped dashboard counts; Auth beta; destructive `db:drop` script |
| **Docs** | Ignored per instructions (`docs/`, README) |

---

## Inventory checklist

| Path | Lines | Analyzed |
|------|------:|----------|
| `login/page.tsx` | 27 | Yes |
| `next.config.ts` | 29 | Yes |
| `package.json` | 57 | Yes |
| `page.tsx` | 88 | Yes |

**End of agent-005 report.**
