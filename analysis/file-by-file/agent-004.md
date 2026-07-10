# Agent 004 — File-by-file analysis

**Batch:** `batch-004.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope note:** Paths are relative to app root. Docs ignored per instructions. Related modules consulted only for coupling/context (not listed in batch).

---

## 1. `drizzle/0011_party_duplicate_candidates.sql`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/drizzle/0011_party_duplicate_candidates.sql` |
| **Lines** | 34 |
| **Role** | Forward SQL migration — creates the human-reviewed party duplicate queue table and supporting indexes |
| **Exports** | N/A (SQL DDL; no JS/TS module exports) |
| **Imports / dependencies** | Existing DB objects only: table `party(party_id)`, table `app_user(user_id)`, enum type `dedup_status` (defined in baseline `0000_minor_kitty_pryde.sql` as `'open' \| 'confirmed_merge' \| 'rejected_merge' \| 'deferred'`) |

### Business purpose

Implements the **party master duplicate-candidate queue** (schema comment §1.4): when import or manual create detects a likely duplicate party, a row is inserted here for human review (merge / reject / defer) rather than auto-merging. This is a data-integrity and compliance control for CRM party master quality.

### Schema / types (quoted)

**Table:** `party_duplicate_candidate`

| Column | Type / constraints |
|--------|---------------------|
| `duplicate_candidate_id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` |
| `source_party_id` | `uuid NOT NULL REFERENCES party(party_id) ON DELETE CASCADE` |
| `candidate_party_id` | `uuid NOT NULL REFERENCES party(party_id) ON DELETE CASCADE` |
| `match_rule` | `text NOT NULL` — rule name/id that fired (e.g. PAN, email, name+city) |
| `match_score` | `numeric(5,4) NOT NULL` — similarity score (0.0000–9.9999 scale; typically 0–1) |
| `status` | `dedup_status NOT NULL DEFAULT 'open'` |
| `evidence` | `jsonb` nullable — structured match evidence for UI/review |
| `created_by_user_id` | `uuid REFERENCES app_user(user_id) ON DELETE SET NULL` |
| `resolved_by_user_id` | `uuid REFERENCES app_user(user_id) ON DELETE SET NULL` |
| `resolved_at` | `timestamptz` nullable |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` |
| `updated_at` | `timestamptz DEFAULT now()` |

**CHECK constraint:**

```sql
CONSTRAINT party_duplicate_candidate_no_self
  CHECK (source_party_id <> candidate_party_id)
```

**Indexes:**

1. **Partial unique** `party_duplicate_candidate_pair_uidx`  
   `ON (source_party_id, candidate_party_id, match_rule) WHERE status = 'open'`  
   — prevents duplicate open tickets for the same ordered pair + rule; allows re-open history after resolution.

2. **Status queue** `party_duplicate_candidate_status_idx`  
   `ON (status, created_at)` — open-queue listing / aging.

3. **Source FK lookup** `party_duplicate_candidate_source_idx`  
   `ON (source_party_id)`

4. **Candidate FK lookup** `party_duplicate_candidate_candidate_idx`  
   `ON (candidate_party_id)`

### Key logic

- `CREATE TABLE IF NOT EXISTS` — idempotent create (safe re-run at table level; indexes also `IF NOT EXISTS`).
- Self-match forbidden via CHECK.
- Cascade delete on both party FKs: deleting either party removes related candidates.
- User FKs SET NULL on user delete so historical rows survive user removal without blocking deletes.
- Partial unique index only for `status = 'open'` so closed/resolved pairs can reappear if a new open candidate is needed under same rule (or historical rows retained without uniqueness collision).

### Side effects

- **DDL only** — creates physical table + indexes in PostgreSQL.
- Does **not** seed data, enable RLS, or attach triggers/policies in this file.
- Downstream app code expects this table (Drizzle schema + feature layer).

### Security / RBAC

- **No RLS policies** in this migration.
- Related migrations in the repo (`0003_rls.sql`, `0004_rls_fix.sql`, `0009_rls_guc_safe.sql`) predate or sit adjacent; if `party_duplicate_candidate` is not covered by a later RLS migration, access control relies on application-layer RBAC/session scoping only — **gap risk** if RLS is globally enforced elsewhere and this table is left open or blocked unexpectedly.
- Contains PII-adjacent linkage (party IDs + evidence JSON); evidence may hold match snippets (names, identifiers) depending on writers.

### Coupling

| Direction | Target |
|-----------|--------|
| **Depends on** | `party`, `app_user`, enum `dedup_status` |
| **Mirrored by** | `src/db/schema/party.ts` → `partyDuplicateCandidate` (`pgTable("party_duplicate_candidate", …)`) with matching columns/indexes |
| **Enum source** | `src/db/schema/enums.ts` → `dedupStatusEnum = pgEnum("dedup_status", ["open","confirmed_merge","rejected_merge","deferred"])` |
| **Consumers** | `src/features/parties/actions.ts` (insert candidates); `src/features/workflow/engine.ts` / `types.ts` (open duplicate = workflow blocker “Duplicate party”); relations/types in `party.ts` (`PartyDuplicateCandidate`, `PartyDuplicateCandidateInsert`) |

### Risks / TODOs

1. **Journal lag:** `drizzle/meta/_journal.json` currently lists only migrations `0000` and `0001`. File `0011_…` exists on disk but is **not** in the journal snapshot set visible at analysis time — risk of manual/out-of-band apply vs Drizzle-managed migrate drift.
2. **No reverse pair uniqueness:** unique key is ordered `(source, candidate, match_rule)`. Pair `(A,B)` and `(B,A)` can both be open unless application normalizes order.
3. **No RLS / grants** in this file — confirm policies for multi-tenant/org isolation.
4. **`updated_at`** has default `now()` but no `ON UPDATE` trigger here — may stay stale unless app sets it.
5. **`match_score numeric(5,4)`** allows values > 1.0 (up to 9.9999) — no CHECK that score ∈ [0,1].
6. **`evidence jsonb`** unconstrained schema — writers/readers must agree on shape.
7. Workflow engine comments treat open candidates as first-class process gates — table absence breaks workflow queries.

---

## 2. `eslint.config.mjs`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/eslint.config.mjs` |
| **Lines** | 37 |
| **Role** | ESLint flat config for the Next.js app (lint policy / CI quality gate) |
| **Exports** | `export default eslintConfig` — default export of the flat config array |
| **Imports** | `defineConfig`, `globalIgnores` from `"eslint/config"`; `nextVitals` from `"eslint-config-next/core-web-vitals"`; `nextTs` from `"eslint-config-next/typescript"` |

### Business purpose

Standardizes static analysis for the CRM codebase: Core Web Vitals + TypeScript Next presets, with intentional overrides so (1) React Compiler-oriented hooks purity rules do not fail CI, and (2) seed/import scripts may use `any` while app code remains strict.

### Key logic / signatures

```js
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["src/db/seed*.ts", "src/scripts/import-parties.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
```

**Rule rationale (from comments):**

- React Compiler advisory hooks rules (`purity`, `refs`, `set-state-in-effect`) disabled because the app is **not** compiled with React Compiler; URL sync, dialog reset, timestamp render patterns are covered by runtime tests + TypeScript instead.
- `@typescript-eslint/no-explicit-any` off only for:
  - `src/db/seed*.ts`
  - `src/scripts/import-parties.ts`  
  (CSV/fixture normalization before typed inserts.)

### Side effects

- Affects **developer/CI lint runs only** — no runtime behavior.
- Widens allowed patterns in listed files; can hide genuine hooks bugs if purity issues ship without test coverage.

### Security / RBAC

- None directly.
- Disabling `no-explicit-any` in seed/import tools can mask typing issues that later become unsafe data handling — process risk, not runtime auth.

### Coupling

| Direction | Target |
|-----------|--------|
| **Depends on** | `eslint-config-next` packages (core-web-vitals + typescript) |
| **Scopes** | Entire app tree minus `globalIgnores` |
| **Special-cased paths** | `src/db/seed*.ts`, `src/scripts/import-parties.ts` |
| **Tooling peers** | `package.json` lint scripts, Next build integration, CI |

### Risks / TODOs

1. If React Compiler is enabled later, re-enable the three hooks rules and fix violations.
2. Seed/import `any` exemption is path-glob based — new import scripts outside those globs stay strict; scripts renamed outside the glob lose the exemption unexpectedly (or vice versa if paths diverge).
3. No project-specific security/eslint plugins (e.g. no custom no-secrets rules) in this file.
4. Flat-config style assumes modern ESLint; older tooling may not load this file.

---

## 3. `login/actions.ts`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/login/actions.ts` |
| **Lines** | 37 |
| **Role** | Next.js **server action** — credentials login entrypoint for the root-level `login/` route module |
| **Exports** | `export type LoginState = { error?: string } \| undefined`; `export async function login(...)` |
| **Imports** | `AuthError` from `"next-auth"`; `redirect` from `"next/navigation"`; `signIn` from `"@/lib/auth"` |

### Business purpose

Authenticate CRM users via Auth.js credentials provider and land them on the parties list (`/parties`) on success; return a safe, generic form error on failure. Marks the file as a Server Actions module (`"use server"`).

### Types / signatures (quoted)

```ts
export type LoginState = { error?: string } | undefined;

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState>
```

- Designed for React `useActionState` (prev state + FormData).
- `_prev` is unused (state machine only needs latest action result).

### Key logic

1. Call `await signIn("credentials", formData, { redirectTo: "/parties" })`.
2. On success, Auth.js/`signIn` throws `NEXT_REDIRECT` → caught and **rethrown** so Next.js issues 303.
3. On `AuthError`:
   - `error.type === "CredentialsSignin"` → `"Invalid email or password."`
   - else → `"Sign-in failed. Please try again."`
4. Unreachable-happy-path fallback: `redirect("/parties")` if `signIn` returns without redirecting.

**FormData contract (implicit):** fields expected by Auth.js credentials provider (typically `email`, `password`; provider in `src/lib/auth.ts` also accepts optional `totp`). This action **passes raw `formData`** through — no zod validation, no field extraction.

### Side effects

- Creates session (JWT strategy per `src/lib/auth.ts`) via Auth.js on success.
- May update failed-login counters / lockout inside `authorize` (implemented in `@/lib/auth`, not this file).
- HTTP redirect to `/parties`.
- No direct DB access in this file.

### Security / RBAC

| Aspect | Notes |
|--------|--------|
| **Auth surface** | Public unauthenticated endpoint (server action). |
| **Error disclosure** | Generic messages; does not distinguish missing user vs bad password at this layer (good). Broader `AuthError` types get a second generic string. |
| **No input validation** | Unlike `src/app/login/actions.ts` (zod email/password/callbackUrl), this root copy does **not** validate shape before `signIn`. Malformed FormData relies on Auth.js/authorize. |
| **No callbackUrl open-redirect guard** | Hardcodes `redirectTo: "/parties"` — **safer** than open redirect; no user-controlled redirect. |
| **No MFA field** | Form (companion file) has no TOTP input; MFA-enabled users would fail authorize in real auth (`mfaEnabled` path) unless TOTP is optional/absent handling allows login. |
| **Password handling** | Never logs password; FormData forwarded to Auth.js only. |
| **RBAC** | Post-login authorization not handled here; only authentication. |

### Coupling

| Direction | Target |
|-----------|--------|
| **Imports** | `@/lib/auth` → `signIn` (`src/lib/auth.ts`); NextAuth `AuthError`; Next `redirect` |
| **Consumed by** | `login/login-form.tsx` → `import { login, type LoginState } from "./actions"` |
| **Sibling route** | `login/page.tsx` wraps form (not in this batch but couples to form) |
| **Parallel implementation** | **`src/app/login/actions.ts`** is a richer, zod-validated twin (callbackUrl, fixed error string). App Router under `src/app` is the likely production login; root `login/` may be legacy/scaffold/duplicate. |

### Risks / TODOs

1. **Duplicate login modules:** root `login/*` vs `src/app/login/*` — risk of maintaining the wrong one; behavior diverges (validation, callbackUrl, error taxonomy).
2. **UI message mismatch:** companion form claims “any non-empty password works for a known app_user email,” but `src/lib/auth.ts` performs **real bcrypt** + lockout + optional TOTP — the form disclaimer is **stale/wrong** relative to current authorize implementation.
3. No rate limiting at action layer (depends on Auth.js + DB lockout in authorize).
4. Dead fallback `redirect("/parties")` rarely hit if redirect-on-success is always thrown.
5. Passing full `FormData` can include unexpected fields; generally fine for credentials provider but less explicit than destructuring.

---

## 4. `login/login-form.tsx`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/login/login-form.tsx` |
| **Lines** | 55 |
| **Role** | Client-side login form UI bound to the `login` server action |
| **Exports** | `export function LoginForm()` |
| **Imports** | `* as React` from `"react"`; `useActionState` from `"react"`; `Button` `@/components/ui/button`; `Input` `@/components/ui/input`; `Label` `@/components/ui/label`; `{ login, type LoginState }` from `"./actions"` |

### Business purpose

Present email/password sign-in UI for Binary CRM operators, show action errors, disable submit while pending, and submit credentials via progressive enhancement (`form action={action}`).

### Types / signatures (quoted)

```tsx
export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    undefined,
  );
  // ...
}
```

- No props (unlike `src/app/login/login-form.tsx` which takes `{ callbackUrl: string }`).
- `LoginState` shared with actions: `{ error?: string } | undefined`.

### Key logic

1. **Controlled only via action state** — inputs are uncontrolled native form fields with `name="email"` / `name="password"`.
2. **Email field:** `type="email"`, `autoComplete="email"`, `required`, `autoFocus`, placeholder `you@binarycapital.in`.
3. **Password field:** `type="password"`, `autoComplete="current-password"`, `required`, placeholder bullets.
4. **Error display:** if `state?.error`, render `<p className="text-sm text-destructive">`.
5. **Submit button:** `disabled={pending}`; label toggles `"Signing in…"` / `"Sign in"`; `size="lg"`.
6. **Dev disclaimer** (hardcoded copy):  
   > “Dev-only credentials stub: any non-empty password works for a known app_user email. Replace with a real IdP + MFA before production.”

### Side effects

- Client-side only until submit; submit invokes server action `login`.
- No localStorage/cookies written in this component (session cookies set by Auth.js response path).
- No analytics hooks.

### Security / RBAC

| Aspect | Notes |
|--------|--------|
| **Client component** | `"use client"` — runs in browser; must not embed secrets (none present). |
| **Credentials in DOM** | Standard password input; not logged by this file. |
| **No client-side password policy** | Only HTML `required`. |
| **Misleading security copy** | Disclaimer describes a **stub** auth model; if production still shows this form, it understates real bcrypt/MFA and confuses operators; if auth is still stubbed in some env, it documents a **critical production gap**. |
| **No CSRF custom code** | Relies on Next server-action / Auth.js CSRF mechanisms. |
| **No captcha / lockout UI** | Locked accounts fail with generic invalid credentials (by design upstream). |
| **Autocomplete** | Sensible for password managers (`email` / `current-password`). |

### Coupling

| Direction | Target |
|-----------|--------|
| **Server action** | `./actions` → `login`, `LoginState` |
| **UI kit** | shadcn-style `@/components/ui/{button,input,label}` |
| **Parent page** | `login/page.tsx` imports `LoginForm` into Card layout |
| **Parallel** | `src/app/login/login-form.tsx` (callbackUrl hidden field, MFA-capable UI in the fuller app tree — verify if production) |

### Risks / TODOs

1. **Duplicate UI** with `src/app/login/login-form.tsx` — drift risk.
2. **Stale stub disclaimer** conflicts with `src/lib/auth.ts` bcrypt + MFA authorize path — fix copy or restore stub intentionally with env guard.
3. No accessibility beyond Label/`htmlFor`; error not wired with `aria-live` / `role="alert"`.
4. No “forgot password” / SSO / IdP buttons — password-only path.
5. Domain-specific placeholder (`binarycapital.in`) is branding only; no email domain enforcement in UI.
6. If root `login/` is not the App Router page actually served, this file may be **dead code** relative to `src/app/login/*` — confirm Next `appDir` / project structure (`src/app` is primary).

---

## Cross-file observations (batch-004)

| Theme | Detail |
|-------|--------|
| **Cohesion** | `login/actions.ts` + `login/login-form.tsx` form a tight pair (`LoginState` + `useActionState`). |
| **Orphan risk** | Root `login/` sits outside `src/app/`; production App Router login lives under `src/app/login/`. Treat root files as legacy/scaffold until routing config proves otherwise. |
| **Migration ↔ app** | `0011_party_duplicate_candidates.sql` aligns with Drizzle `partyDuplicateCandidate` and party/workflow features; journal may not track it yet. |
| **Tooling isolation** | `eslint.config.mjs` is orthogonal to auth/migration runtime paths. |
| **Auth production readiness** | Form copy still advertises dev stub; real authorize uses bcrypt/MFA/lockout — documentation and UI must converge before production (aligns with form’s own “Replace with real IdP + MFA” TODO). |

---

## Inventory checklist

| # | Path | Lines | Analyzed |
|---|------|------:|:--------:|
| 1 | `drizzle/0011_party_duplicate_candidates.sql` | 34 | yes |
| 2 | `eslint.config.mjs` | 37 | yes |
| 3 | `login/actions.ts` | 37 | yes |
| 4 | `login/login-form.tsx` | 55 | yes |

**Total lines analyzed:** 163  
**Docs skipped:** none in batch  
