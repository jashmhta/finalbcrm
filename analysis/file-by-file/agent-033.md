# Agent 033 — File-by-file analysis

**Batch:** `batch-033.list`  
**App root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope note:** Paths are relative to app root. Docs ignored per instructions. Related modules (`@/lib/auth`, `@/components/brand/*`, `src/proxy.ts`) consulted only for coupling/context (not listed in batch).

---

## 1. `src/app/loading.tsx`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/loading.tsx` |
| **Lines** | 23 |
| **Role** | Next.js App Router **root route-level loading UI** — default Suspense fallback streamed while any non-overridden segment resolves |
| **Exports** | `export default function Loading()` |
| **Imports** | `SkeletonPage` from `"@/components/brand/skeleton"` |

### Business purpose

Provide **instant visual feedback** during client navigations in Binary CRM. Comments state every CRM route is `force-dynamic` (SSR against Neon us-east-1), so link clicks can lag on DB round-trips. This root `loading.tsx` is the **catch-all skeleton** for routes that do not define their own `loading.tsx` (deals, parties, compliance/kyc, etc. override with layout-mirroring skeletons). Goal: never show a blank screen; paint brand-language shimmer within a frame.

### Types / signatures (quoted)

```ts
export default function Loading() {
  return <SkeletonPage eyebrow="Binary CRM" title="Loading" cards={4} />;
}
```

**Delegated props** (from `SkeletonPage` in `@/components/brand/skeleton`):

```ts
{
  eyebrow?: string;   // passed: "Binary CRM"
  title?: string;     // passed: "Loading"
  cards?: number;     // passed: 4
  children?: React.ReactNode;
  className?: string;
}
```

### Key logic

1. **Default export named `Loading`** — App Router convention: file name + default export is the loading boundary UI for `src/app` segment and descendants without closer `loading.tsx`.
2. Renders a single brand shell via `SkeletonPage`:
   - Eyebrow label `"Binary CRM"` (uppercase tracking style inside component).
   - Visible title `"Loading"` (real text, not shimmer) so screen readers / headless captures announce the transition.
   - `cards={4}` → four `SkeletonCard` tiles in a responsive grid (stat-card row mimic).
3. Comment claims **plain CSS shimmer** (no Framer Motion) so first paint is immediate and `prefers-reduced-motion` is honored (implementation lives in `Skeleton` / CSS tokens, not this file).

### Side effects

- **No data fetching, no cookies, no redirects.**
- Pure presentational RSC (no `"use client"`).
- Affects **UX timing perception** only: streamed as soon as navigation starts while the target RSC tree resolves.
- Does **not** set HTTP status, headers, or cache policy.

### Security / RBAC

- None. Loading UI is unauthenticated-capable shell content; it does not gate routes.
- Actual route protection lives in `src/proxy.ts` / Auth.js session, not here.
- No user input, no secrets.

### Coupling

| Direction | Target |
|-----------|--------|
| **Depends on** | `@/components/brand/skeleton` → `SkeletonPage` (and transitively `Skeleton`, `SkeletonCard`, `cn`) |
| **Framework** | Next.js App Router automatic loading boundary for `src/app/**` |
| **Peers / overrides** | Route-specific loaders e.g. `src/app/deals/loading.tsx`, `src/app/parties/loading.tsx`, `src/app/compliance/kyc/loading.tsx`, `src/app/reports/loading.tsx`, portal loaders — these **shadow** this root fallback for their subtrees |
| **Design system** | Brand skeleton language (gold-tinted shimmer, double-bezel cards) shared app-wide |

### Risks / TODOs

1. **Generic layout only** — does not mirror every page structure; routes without custom `loading.tsx` may flash a 4-card dashboard-like skeleton then morph to a table/board/detail layout (layout shift / visual mismatch).
2. **No explicit `aria-busy` / live region** in this file (title text helps; deeper a11y depends on `SkeletonPage`).
3. If root layout wraps authenticated chrome (nav), this skeleton may appear **inside** that chrome for in-app navigations vs full-page for cold loads — behavior is framework/layout dependent, not controlled here.
4. No tests specific to this file; smoke coverage is indirect via route navigations.

---

## 2. `src/app/login/actions.ts`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/login/actions.ts` |
| **Lines** | 59 |
| **Role** | Next.js **server action** — credentials login entrypoint for the `/login` page form |
| **Exports** | `export type LoginState`; `export async function login(...)` |
| **Imports** | `AuthError` from `"next-auth"`; `z` from `"zod/v4"`; `signIn` from `"@/lib/auth"` |

### Business purpose

Authenticate Binary Capital / Binary Bonds staff against the Auth.js **credentials** provider, then redirect to the intended deep link (`callbackUrl`) or default CRM home `/parties`. On failure, return a **generic** form error so the client can show inline feedback **without** leaking whether an email exists or whether the account is locked/MFA-required (those distinctions are enforced inside `@/lib/auth` `authorize` and collapsed to AuthError / null).

File is marked `"use server"` so all exports are server-only action endpoints.

### Types / signatures (quoted)

```ts
const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
  callbackUrl: z.string().optional(),
});

export type LoginState = { error?: string } | undefined;

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState>
```

**`useActionState` contract:** first arg is previous state (`_prev`, unused), second is `FormData` from the form; return value becomes next state for the client.

### Key logic

1. **Zod v4 parse** of `FormData` fields:
   - `email` ← `formData.get("email")` — must be valid email (`z.email(...)`).
   - `password` ← `formData.get("password")` — non-empty string.
   - `callbackUrl` ← `formData.get("callbackUrl") || undefined` — optional string.
2. On validation failure: return first issue message:
   ```ts
   error: parsed.error.issues[0]?.message ?? "Please check your details."
   ```
3. On success path call:
   ```ts
   await signIn("credentials", {
     email,
     password,
     redirectTo:
       callbackUrl && callbackUrl.startsWith("/")
         ? callbackUrl
         : "/parties",
   });
   ```
4. **Success model:** Auth.js `signIn` throws a `NEXT_REDIRECT` on success; the return `undefined` after `await signIn` is documented as unreachable on happy path (type completeness).
5. **Error handling:**
   - `err instanceof AuthError` → `{ error: "Invalid email or password." }` (fixed copy; no provider detail).
   - Any other error (including `NEXT_REDIRECT`) is **rethrown** so Next.js can complete the redirect.

### Side effects

- **Creates Auth.js session** (JWT strategy per `@/lib/auth` header comments) on successful credential verify.
- **HTTP redirect** via Next redirect throw to `redirectTo`.
- May trigger **DB reads/writes** inside `authorize` (user lookup, bcrypt, failed_login_count / lockout, MFA check) — not in this file but caused by `signIn("credentials", …)`.
- Does **not** set cookies itself; Auth.js middleware/session machinery does.
- No audit log write in this action (any login auditing would be in auth layer or elsewhere).

### Security / RBAC

| Control | Behavior |
|---------|----------|
| **Server-only** | `"use server"` — credentials never processed in client JS beyond form POST to action |
| **Input validation** | Zod email + non-empty password before hitting Auth |
| **User enumeration** | Generic error string; comment explicitly: never leak whether email exists |
| **AuthError collapse** | All Auth.js credential failures → same message |
| **Open-redirect hardening (partial)** | `callbackUrl` only accepted if `callbackUrl.startsWith("/")`; else `/parties` |
| **No RBAC roles checked here** | Login only; role/desk/wall loaded in `@/lib/auth` JWT callbacks after successful authorize |
| **MFA / TOTP** | **Not accepted by this action** — schema has no `totp` field; `signIn` only passes `email`/`password`/`redirectTo`. Auth provider *does* define optional `totp` credentials. MFA-enabled users cannot complete 2FA through this action as written |
| **Rate limiting** | Not in this file; lockout lives in `@/lib/auth` (`LOCKOUT_THRESHOLD = 5`, `LOCKOUT_WINDOW_MINUTES = 15`) |
| **CSRF** | Relies on Next.js Server Actions origin/CSRF protections (framework default) |

**Open-redirect gap (important):** check is only `startsWith("/")`. Protocol-relative URLs like `//evil.example` **also** start with `/`, so a crafted `callbackUrl` FormData value can bypass the intended “same-origin path only” rule **unless** Auth.js/Next further validates `redirectTo`. The login **page** uses a stricter check (`startsWith("/") && !startsWith("//")`) for the initial hidden field, but a client can still POST a tampered `callbackUrl` to this action. **Defense-in-depth mismatch** between page and action.

### Coupling

| Direction | Target |
|-----------|--------|
| **Depends on** | `@/lib/auth` → `signIn` (NextAuth instance: credentials provider, Drizzle adapter, JWT session, `pages.signIn: "/login"`) |
| **Depends on** | `next-auth` → `AuthError` |
| **Depends on** | `zod/v4` → `z.object` / `z.email` / `safeParse` |
| **Consumed by** | `src/app/login/login-form.tsx` → `useActionState(login, undefined)` |
| **Related public surface** | `src/app/login/page.tsx` (sanitizes `callbackUrl` query into form); `src/proxy.ts` (`PUBLIC_PATHS = ["/login"]`, sets `callbackUrl` on unauth redirects); `src/app/actions/auth.ts` (signOut → `/login`); `src/app/api/auth/[...nextauth]/route.ts` (Auth.js HTTP handlers) |
| **Downstream session shape** | JWT/session fields `appUserId`, `wall`, `roles`, `desk`, `brandScope` from auth callbacks — not set in this file |

### Risks / TODOs

1. **Open redirect:** tighten to same pattern as page: path-only, reject `//`, optionally allow only known path prefixes; consider `new URL(callbackUrl, origin)` + host check if absolute URLs ever needed.
2. **No TOTP field** despite production-oriented MFA in `@/lib/auth` — MFA users may be stuck at “Invalid email or password.”
3. **No explicit logging** of failed attempts at the action layer (may be intentional to avoid dual-write with lockout counters).
4. **Zod v4 API** (`z.email(...)`) — ensure package version always matches; v3 used `z.string().email()`.
5. **`_prev` unused** — correct for pure form posts; if progressive enhancement multi-step login (e.g. password then TOTP) is added, state machine would use it.
6. Password min length is **1** only — policy strength is entirely in password storage / org process, not login schema.
7. Comment says failure never leaks email existence — good; ensure Auth.js does not surface different error types that escape `instanceof AuthError` as 500s (those rethrow).

---

## 3. `src/app/login/login-form.tsx`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/login/login-form.tsx` |
| **Lines** | 127 |
| **Role** | **Client component** — login form UI bound to the `login` server action via React 19 `useActionState` |
| **Exports** | `export function LoginForm({ callbackUrl }: { callbackUrl: string })` |
| **Imports** | `* as React` from `"react"`; `useActionState` from `"react"`; `useFormStatus` from `"react-dom"`; `ArrowRight`, `CircleNotch` from `"@phosphor-icons/react"`; `login`, `type LoginState` from `"./actions"`; `Button` from `"@/components/brand/button"`; `cn` from `"@/lib/utils"` |

### Business purpose

Present the **Sign in** form for authorized Binary Capital / Binary Bonds staff: email + password, submit to server action, show pending state and inline errors **without full page reload**. Visual language matches brand primitives (eyebrow labels, hairline rings, emerald focus, emerald pill button with trailing arrow).

### Types / signatures (quoted)

**Internal `Field` props:**

```ts
{
  id: string;
  label: string;
  type: string;
  name: string;
  autoComplete?: string;
  placeholder?: string;
  autoFocus?: boolean;
}
```

**Internal `SubmitButton`:** no props; reads `useFormStatus().pending`.

**Exported form:**

```ts
export function LoginForm({ callbackUrl }: { callbackUrl: string })
```

**Action state hook:**

```ts
const [state, formAction] = useActionState<LoginState, FormData>(
  login,
  undefined,
);
```

### Key logic

1. **`"use client"`** — required for hooks / interactive form state.
2. **`Field` (local):** labeled input with brand classes:
   - Label: `text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground`
   - Input: `h-11`, `rounded-xl`, `ring-1 ring-hairline`, focus `ring-emerald/60`
   - Always `required`
3. **`SubmitButton` (local):** uses `useFormStatus()` (must render under form):
   - `disabled={pending}`
   - Label `"Signing in"` vs `"Sign in"`
   - Trailing icon: spinning `CircleNotch` vs `ArrowRight`
   - Brand `Button` `variant="primary-emerald"` `size="lg"` full width
4. **`LoginForm`:**
   - Hidden input: `<input type="hidden" name="callbackUrl" value={callbackUrl} />`
   - Email field: `name="email"`, `type="email"`, `autoComplete="email"`, placeholder `you@binarycapital.in`, `autoFocus`
   - Password field: `name="password"`, `type="password"`, `autoComplete="current-password"`
   - Error banner when `state?.error`:
     ```tsx
     <p role="alert" className="… bg-down/10 … text-down …">
       {state.error}
     </p>
     ```
   - `action={formAction}` on `<form>`

### Side effects

- Submits FormData to **server action** `login` (network round-trip + possible redirect).
- No localStorage/sessionStorage.
- No client-side auth token handling.
- Pending UI only during in-flight action; after success, navigation is server-driven redirect (full document navigation).

### Security / RBAC

| Control | Behavior |
|---------|----------|
| **Password field** | `type="password"`; not reflected into React state (uncontrolled inputs via `name`) |
| **Error display** | Renders server-provided string only; no client-side credential validation beyond HTML5 `required` / `type="email"` |
| **callbackUrl** | Prop from parent; user-visible only as hidden field — **tamperable** in DevTools before submit (server must re-validate; see actions gap on `//`) |
| **No MFA UI** | No TOTP/OTP input despite auth backend support |
| **No “remember me”** | Session duration entirely Auth.js config |
| **a11y** | Labels via `htmlFor`/`id`; errors use `role="alert"` |

### Coupling

| Direction | Target |
|-----------|--------|
| **Depends on** | `./actions` → `login`, `LoginState` |
| **Depends on** | `@/components/brand/button` → `Button` (`variant="primary-emerald"`, `trailingIcon`) |
| **Depends on** | `@/lib/utils` → `cn` |
| **Depends on** | React 19 action APIs: `useActionState`, `useFormStatus` |
| **Depends on** | Phosphor icons |
| **Consumed by** | `src/app/login/page.tsx` → `<LoginForm callbackUrl={callbackUrl} />` |

### Risks / TODOs

1. **No TOTP / MFA step** — product gap vs `@/lib/auth` credentials `totp` field.
2. **Uncontrolled fields** — fine for password safety; harder to clear password on error without remount (minor UX).
3. **Client can rewrite `callbackUrl`** hidden field — relies on server action hardening.
4. **No client-side rate limit / CAPTCHA** — brute force resistance depends on server lockout + infra.
5. **`React` namespace import** largely unused (only hooks from `"react"` / `"react-dom"`) — style nit, not functional.
6. HTML5 validation messages may differ from Zod messages (double validation layers).
7. No password visibility toggle, forgot-password link, or email verification UI (auth.ts TODOs mention password-reset / IdP as production direction).

---

## 4. `src/app/login/page.tsx`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/src/app/login/page.tsx` |
| **Lines** | 107 |
| **Role** | **Public login page** (RSC) — branded split layout + form card; App Router route `/login` |
| **Exports** | `export const metadata`; `export const dynamic`; `export default async function LoginPage(...)` |
| **Imports** | `type { Metadata }` from `"next"`; `Link` from `"next/link"`; `Image` from `"next/image"`; `logoSrc` from `"@/components/logo.png"`; `LoginForm` from `"./login-form"`; `Card`, `CardBody` from `"@/components/brand/card"` |

### Business purpose

**Restricted-access entry surface** for Binary CRM (Binary Capital / Binary Bonds). Stripe-style split: dark brand panel (desktop) + clean form card. Communicates product positioning (“Relationship intelligence for Indian capital markets”) and access policy (“Restricted access. Authorized staff only.”). Deep-link return via `?callbackUrl=` after proxy redirects unauthenticated users here.

### Types / signatures (quoted)

```ts
export const metadata: Metadata = {
  title: "Sign in",
  description: "Binary Capital / Binary Bonds CRM - restricted access.",
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
})
```

**Callback sanitization:**

```ts
const sp = await searchParams;
const raw = sp.callbackUrl;
const callbackUrl =
  raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/parties";
```

### Key logic

1. **`searchParams` is a `Promise`** (Next.js async searchParams convention) — awaited before use.
2. **Open-redirect mitigation for the UI-provided default:**
   - Accept only same-site path strings starting with `/`
   - Reject protocol-relative `//…`
   - Fallback default: `"/parties"`
3. **Layout:**
   - Outer: `min-h-[100dvh]` two-column grid from `md:` breakpoint (`md:grid-cols-[1fr_1fr]`)
   - **Left brand panel** (`hidden md:flex`, bg `#0a2540`): logo + “Binary CRM”, marketing headline, restricted-access footer line
   - **Right form section:** mobile logo row (`md:hidden`), “Sign in” heading, account hint copy, `Card`/`CardBody` wrapping `LoginForm`, support contacts, link to `/` labeled `binarycapital.in`
4. **Images:** `next/image` for `logoSrc` with `priority` (LCP-friendly on login).
5. **`force-dynamic`:** disables static prerender of login (always server-render; aligns with app-wide dynamic CRM posture).

### Side effects

- Sets **document metadata** (title/description) for SEO/tab chrome (page is restricted; metadata still public).
- Renders public HTML; no session write on GET.
- Does **not** check if user is already logged in — that bounce is in `src/proxy.ts` (`isLoggedIn && pathname === "/login"` → app home).
- Passes sanitized `callbackUrl` into client form (hidden field).

### Security / RBAC

| Control | Behavior |
|---------|----------|
| **Public route** | Listed in `src/proxy.ts` `PUBLIC_PATHS = ["/login"]` — unauthenticated access allowed |
| **No auth required to view** | Intentional |
| **callbackUrl sanitize** | Stronger than action: rejects `//` open redirects for the value seeded into the form |
| **Does not re-auth on GET** | Proxy handles “already logged in” bounce |
| **PII** | None on GET; POST handled by action |
| **Hardcoded admin names in UI** | “Contact your super admin (Shray / Shahrukh / Rati / Niraj).” — operational contact disclosure (low sensitivity, intentional) |
| **No CAPTCHA / bot gate** | None |

### Coupling

| Direction | Target |
|-----------|--------|
| **Child UI** | `./login-form` → `LoginForm` |
| **Brand** | `@/components/brand/card` → `Card`, `CardBody`; logo asset `@/components/logo.png` |
| **Auth config** | `@/lib/auth` → `pages: { signIn: "/login" }` so Auth.js redirects here |
| **Edge/proxy** | `src/proxy.ts` — public path + `callbackUrl` query on force-login; bounce authed users off `/login` |
| **Sign-out target** | `src/app/actions/auth.ts` → `signOut({ redirectTo: "/login" })` |
| **Tests** | `src/__tests__/routeSmoke.test.ts` — `GET /login returns 200 (public surface)` |
| **Default post-login** | `/parties` (also default in `login` action when callback invalid) |

### Risks / TODOs

1. **Sanitize mismatch with action:** page rejects `//`, action does not — defense in depth incomplete (see §2).
2. **Hardcoded super-admin names** may drift as org changes; no i18n.
3. **`force-dynamic` on login** — fine for security/freshness; tiny perf cost (no static edge cache of pure marketing shell).
4. **Link `href="/"`** labeled “binarycapital.in” may be internal app root, not external marketing site — label/destination mismatch risk depending on what `src/app/page.tsx` is.
5. **No explicit `robots: noindex`** in metadata — login may be indexed if exposed publicly (usually undesirable for internal CRM).
6. **Accessibility:** brand panel decorative logo uses `alt=""` (ok if redundant with adjacent text); ensure contrast on `#0a2540` + white/70 copy meets WCAG (visual QA).
7. **Mobile** loses brand marketing panel (by design); only compact logo remains.

---

## Cross-file architecture (batch 033)

```
Unauthenticated request to protected path
        │
        ▼
 src/proxy.ts  ──►  /login?callbackUrl=<path>
        │
        ▼
 src/app/login/page.tsx  (RSC, public, force-dynamic)
   sanitizes callbackUrl (/, not //)
   renders LoginForm
        │
        ▼
 src/app/login/login-form.tsx  (client)
   useActionState(login)
   hidden callbackUrl + email + password
        │
        ▼
 src/app/login/actions.ts  ("use server")
   zod validate → signIn("credentials", { redirectTo })
        │
        ▼
 @/lib/auth  authorize (bcrypt, lockout, optional TOTP)
        │
        ├── AuthError → { error: "Invalid email or password." }
        └── success NEXT_REDIRECT → callbackUrl | /parties

Parallel UX:
 src/app/loading.tsx  → root Suspense skeleton (not specific to login;
                        login typically not using this for first paint
                        of /login itself unless nested transitions)
```

### Shared concerns

| Topic | Status across batch |
|-------|---------------------|
| **Open redirect** | Page: good; Action: weaker (`//` allowed by `startsWith("/")`) |
| **MFA/TOTP** | Backend capable; form + action **omit** field |
| **User enumeration** | Mitigated at action + auth authorize |
| **RBAC** | Post-login only (JWT claims); login path is authN only |
| **Brand system** | Skeleton (loading) + Button/Card (login) shared |

### Batch risk summary (priority)

1. **P1 — Align `callbackUrl` validation** in `actions.ts` with page (reject `//`, optionally validate path charset / no backslash tricks).
2. **P1/P2 — MFA UX gap** if any production users have `mfa_enabled`; add TOTP field + schema + pass-through to `signIn`.
3. **P3 — Login metadata robots / external marketing link clarity.**
4. **P3 — Root loading layout mismatch** for non-dashboard routes without local `loading.tsx`.

---

*End of agent-033 analysis.*
