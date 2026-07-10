# Agent 008 — File-by-File Analysis

**Batch:** `batch-008.list`  
**Scope:** Dev/ops Puppeteer verification & screenshot scripts under `scripts/`  
**Files:** 4 (all top-level ESM Node scripts; not Next.js app routes)

---

## 1. `scripts/screenshot.mjs`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/scripts/screenshot.mjs` |
| **Lines** | 210 |
| **Module type** | ESM (`.mjs`), top-level `await` |
| **Role** | Manual/dev visual regression capture harness — headless Chromium walkthrough that authenticates and dumps full-page PNGs of key CRM screens (dark + light + mobile) |

### Exports

None. Side-effect script; no `export` declarations. Entry: run with Node (e.g. `node scripts/screenshot.mjs`). Not wired in `package.json` scripts.

### Imports

```js
import puppeteer from 'puppeteer-core';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
```

- **`puppeteer-core`** — browser automation (devDependency `^24.43.1`); expects system Chromium at `EXE`.
- **Node builtins** — temp profile dir, screenshot output dir creation, `.env.local` read for `AUTH_URL`.

### Constants / configuration (quoted)

| Symbol | Value / type | Purpose |
|--------|----------------|---------|
| `AUTH_URL` | `process.env.AUTH_URL` or parsed from `.env.local` `AUTH_URL=...` | Origin for navigation; must match next-auth cookie domain |
| `BASE` | `(AUTH_URL \|\| 'http://localhost:3000').replace(/\/$/, '')` | Trailing-slash-stripped base URL |
| `OUT` | `'/home/Jashmhta/crm/screenshots'` | Absolute screenshot output directory (outside app tree) |
| `EXE` | `'/usr/bin/chromium-browser'` | Chromium binary path |
| `PROFILE` | `mkdtempSync(join(tmpdir(), 'pcrm-shot-'))` | Ephemeral Chromium user-data dir |
| `PARTY_ID` | `'988e469c-61ba-496e-9437-fca15480c422'` | Seed party UUID (comment: "Satpuda Power 214") |
| `CREDIT_ID` | `'014f6ae9-52b2-4836-b0d6-a3477feb7e5b'` | Seed credit_analysis UUID for workspace/detail |
| `LOGIN_EMAIL` | `'shray@binarycapital.in'` | Seed admin email |
| `LOGIN_PASSWORD` | `'BinaryCapital@2026'` | Seed password (comment: set by `src/db/seed-admin.ts`) |
| Viewport | `{ width: 1440, height: 900, deviceScaleFactor: 2 }` | Desktop capture |
| Mobile viewport | `{ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true }` | Phone captures |
| `protocolTimeout` | `60000` | Puppeteer protocol timeout ms |
| Default page timeout | `20000` | `page.setDefaultTimeout(20000)` |

### Helper function signatures

```js
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function triggerReveals(p)
// p: Puppeteer Page
// scrolls full document in 700px steps @ 60ms; then forces opacity:0 / transform / filter
// on elements matching [style*="opacity: 0"] so framer-motion whileInView content is visible;
// waits 600ms. Swallows errors.

async function setTheme(p, theme)
// p: Page; theme: 'dark' | 'light' (string)
// localStorage.setItem('theme', t); toggles html.dark; sets html.style.colorScheme

async function cap(p, path, name, fullPage = true)
// navigates BASE+path, wait 1500ms, triggerReveals, screenshot to OUT/{name}.png
// fullPage + captureBeyondViewport when fullPage true
```

### Business purpose

Visual documentation / design QA for Binary CRM UI:

1. Unauthenticated **login** dark screenshot (`00-login.png`).
2. Form login as seed admin.
3. **13 authed dark desktop** full-page shots (dashboard, parties, party detail, deals, credit workspace/detail, bond calculator, KYC, audit, integrations, tasks, documents, interactions).
4. **Dark mobile** dashboard (`14-dashboard-mobile.png`).
5. **4 light-mode** key screens (dashboard, parties, credit workspace, bond calculator).
6. **Light login** after cookie clear (`00-login-light.png`).
7. **5 mobile** re-auth + screenshots (parties, deals, credit workspace, KYC, integrations).

Ensures screenshots reflect real next-themes dark/light and framer-motion reveal content, not blank opacity-0 sections.

### Key logic

1. **AUTH_URL / cookie domain alignment** (lines 6–21): next-auth session cookies are host-scoped; driving `localhost` while `AUTH_URL` is a public IP causes auth bounce to `/login`. Script prefers env / `.env.local` so origin matches.

2. **Chromium flags** (lines 40–48): `--no-sandbox`, `--disable-gpu`, `--disable-dev-shm-usage`, `--hide-scrollbars`, `--force-color-profile=srgb`, `--headless=new`. Comment notes `--run-all-compositor-stages-before-draw` was removed because it deadlocks `Page.captureScreenshot` on GPU-heavy pages under headless=new.

3. **Login flow** (lines 112–121): multi-selector email (`input[name="email"], input[type="email"], input[autocomplete="email"]`), password, submit; poll up to 40×500ms until URL leaves `/login`.

4. **Theme persistence**: `localStorage.theme` + `html.dark` + `colorScheme`; re-applied after navigation for light captures.

5. **Hardcoded seed IDs**: Comments warn UUIDs come from current `seed.ts` (`gen_random_uuid()`) and break after reseed.

### Side effects

| Effect | Detail |
|--------|--------|
| Filesystem write | Creates `OUT` via `mkdirSync(OUT, { recursive: true })`; writes many `.png` under `/home/Jashmhta/crm/screenshots/` |
| Temp dir | Creates Chromium profile under `os.tmpdir()` (`pcrm-shot-*`); not explicitly `rm`-cleaned |
| Network | HTTP(S) to `BASE` (local or AUTH_URL host) |
| Auth | Establishes real session via credentials form; later clears cookies via CDP `Network.clearBrowserCookies` for light login |
| Browser process | Launches system Chromium; closes at end |
| Console | Logs `shot`, `goto err`, `shot err`, `post-login url`, `DONE` |

### Security / RBAC

- **Hardcoded production-looking credentials** (`shray@binarycapital.in` / `BinaryCapital@2026`) in source — seed/dev password only if seed-admin is used, but still credential leakage risk if repo is shared or committed publicly.
- No RBAC enforcement of its own; assumes seed admin can access all listed routes.
- Reads `.env.local` for `AUTH_URL` only (not secrets beyond what’s already env).
- `--no-sandbox` is typical for CI/containers but weakens Chromium isolation.
- Writes screenshots outside app root to absolute path tied to developer machine (`/home/Jashmhta/crm/screenshots`).

### Coupling

| Coupled to | How |
|------------|-----|
| next-auth / `AUTH_URL` | Cookie domain + redirects |
| next-themes | `localStorage.theme`, `html.dark` |
| framer-motion | Opacity/transform reveal forcing |
| Login UI | Selectors for email/password/submit |
| Seed DB | `PARTY_ID`, `CREDIT_ID`, login user from `seed-admin.ts` |
| App routes | Hardcoded path list (`/parties`, `/credit/:id/workspace`, etc.) |
| System Chromium | `/usr/bin/chromium-browser` |
| `puppeteer-core` | Must match installed Chromium capability |

### Risks / TODOs

- **Stale UUIDs** after reseed → empty or 404 detail pages in screenshots.
- **Stale password** if `seed-admin` changes; comment documents source but not auto-sync.
- **Hardcoded absolute `OUT` path** not portable across machines/CI.
- No exit code non-zero on failures; errors only logged — false “DONE” possible.
- Mobile re-login after cookie clear may fail silently (`mobile-login err`).
- No cleanup of `PROFILE` temp directory.
- Password in plaintext in VCS.
- Not registered in `package.json` scripts — discoverability via comments / other scripts only.

---

## 2. `scripts/verify-logo-theme.mjs`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/scripts/verify-logo-theme.mjs` |
| **Lines** | 102 |
| **Module type** | ESM, top-level `await` |
| **Role** | Focused smoke check: BC logo present in nav + login HTML; theme toggle flips `html.dark` and restores |

### Exports

None. Console-only verification script.

### Imports

```js
import puppeteer from 'puppeteer-core';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
```

Same stack pattern as `screenshot.mjs` (puppeteer-core + AUTH_URL from env/`.env.local` + temp profile). No `mkdirSync` (no screenshot output).

### Constants / configuration

| Symbol | Value |
|--------|--------|
| `BASE` | `(AUTH_URL \|\| 'http://localhost:3000').replace(/\/$/, '')` |
| `EXE` | `'/usr/bin/chromium-browser'` |
| `PROFILE` | `mkdtempSync(join(tmpdir(), 'pcrm-lt-'))` |
| Credentials (inline) | `'shray@binarycapital.in'` / `'BinaryCapital@2026'` |
| Viewport | `{ width: 1440, height: 900, deviceScaleFactor: 1 }` |
| Timeouts | launch `protocolTimeout: 60000`; `page.setDefaultTimeout(30000)` |

### Function signatures

```js
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const logoInHtml = (html) => /static\/media\/logo\b|static%2Fmedia%2Flogo\b/i.test(html);
// Detects Next.js static import logo path, including /_next/image?url= encoded form
```

Inline `page.evaluate` callbacks (not named exports):

1. **Nav logo imgs** — filter `img` by `src`/`srcset` matching logo media path; map `{ src, inNav }` where `inNav` = closest `nav,header,[class*=nav],[class*=Nav],[data-nav]`.

2. **Theme toggle** — requires `button[aria-label="Toggle color theme"]`; records `before`/`after`/`restored` `html.classList.contains('dark')`, `localStorage.getItem('theme')`, `flipped: before !== after`.

### Business purpose

Regression guard for brand assets and theming after UI changes:

- (a) Real BC logo renders in **authenticated nav** (`/parties`) and **login**, detecting bundled static media filename regardless of Next `<Image>` optimizer wrapper.
- (b) Theme toggle **actually** flips `html.dark` after React re-render tick (600ms), then restores.

Complements broader route verification; more precise logo/theme checks than `verify-routes.mjs` (which uses looser media PNG heuristics and synchronous theme click without wait).

### Key logic

1. Login on AUTH_URL host (same cookie-domain rationale as screenshot).
2. Authed `/parties` → page HTML + DOM logo `img` inventory.
3. Authed `/` → click theme toggle, wait 600ms, assert class flip, click again restore, read `localStorage.theme`.
4. **Fresh browser context** (`browser.createBrowserContext()`) for unauthed login logo — avoids session bleed.
5. Ends with `console.log('LOGO_THEME_DONE')`.

### Side effects

| Effect | Detail |
|--------|--------|
| Temp profile | `pcrm-lt-*` under tmpdir |
| Network | Requests to `BASE` |
| Auth session | Logs in as seed admin; second context is logged out |
| DOM mutation | Temporarily toggles theme twice on dashboard |
| Console only | No file screenshots |
| Browser close | Yes |

### Security / RBAC

- Same hardcoded credentials as screenshot/verify-routes.
- Does not assert role-gated content — only logo/theme presence.
- `--no-sandbox` Chromium.

### Coupling

| Coupled to | How |
|------------|-----|
| next-themes | `theme` localStorage + `dark` class |
| Theme toggle component | Exact `aria-label="Toggle color theme"` |
| Logo asset pipeline | Static import → `/_next/static/media/logo.<hash>.png` (or image optimizer encoding) |
| Login form selectors | Same multi-selector pattern as screenshot |
| AUTH_URL / next-auth | Cookie host match |
| Layout nav structure | `nav`/`header`/class*nav ancestors for logo placement |

### Risks / TODOs

- **Strict aria-label** — if toggle label renames, `found: false` without process exit code 1.
- Logo regex assumes filename contains `logo` under `static/media` — rename asset breaks detection.
- Hardcoded credentials.
- No structured pass/fail exit code; operator must read console JSON.
- `inNav` heuristic may false-negative if logo sits outside nav/header class naming.
- Temp profile not cleaned up.

---

## 3. `scripts/verify-routes.mjs`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/scripts/verify-routes.mjs` |
| **Lines** | 195 |
| **Module type** | ESM, top-level `await` |
| **Role** | “Step 5” full route health check: login → session cookie → HTTP fetch every user-facing route for 200 + non-thin content; plus favicon/logo/theme presence |

### Exports

None. Console reporting + summary/verdict.

### Imports

```js
import puppeteer from 'puppeteer-core';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
```

Also uses global **`fetch`** (Node 18+) for HTTP checks with Cookie header — not imported.

### Constants / types (quoted)

```js
const LOGIN_EMAIL = 'shray@binarycapital.in';
const LOGIN_PASSWORD = 'BinaryCapital@2026';

const IDS = {
  party: '988e469c-61ba-496e-9437-fca15480c422',
  credit: '014f6ae9-52b2-4836-b0d6-a3477feb7e5b',
  model: 'd97c224e-0fad-4391-a613-aa5c05fc145c',
  kyc: '49c22bb5-c4e5-4eda-ac64-5840122dd585',
  document: 'd319bc1d-9b38-48aa-a6f7-c0315146946c',
  interaction: 'c2798bd3-cfde-4390-8876-ec320673673f',
  task: '5491fe4a-5d32-4d27-a94f-2f98089c49f8',
};
```

```js
const ROUTES = [
  ['/', 'dashboard'],
  ['/parties', 'parties'],
  [`/parties/${IDS.party}`, 'party-detail'],
  ['/deals', 'deals'],
  ['/credit', 'credit-list'],
  [`/credit/${IDS.credit}`, 'credit-detail'],
  [`/credit/${IDS.credit}/workspace`, 'credit-workspace'],
  ['/credit/new', 'credit-new'],
  ['/modeling', 'modeling'],
  [`/modeling/${IDS.model}`, 'modeling-detail'],
  ['/modeling/bond-calculator', 'bond-calculator'],
  ['/compliance/audit', 'audit'],
  ['/compliance/consent', 'consent'],
  ['/compliance/kyc', 'kyc'],
  [`/compliance/kyc/${IDS.kyc}`, 'kyc-detail'],
  ['/documents', 'documents'],
  [`/documents/${IDS.document}`, 'document-detail'],
  ['/interactions', 'interactions'],
  [`/interactions/${IDS.interaction}`, 'interaction-detail'],
  ['/tasks', 'tasks'],
  [`/tasks/${IDS.task}`, 'task-detail'],
  ['/integrations', 'integrations'],
  ['/login', 'login'],
]; // 23 routes
```

`BASE`, `EXE`, `PROFILE` (`pcrm-vrfy-*`) same pattern as other scripts.

### Function signatures

```js
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchHead(path, withCookie = true)
// returns { status, url, ctype } from fetch(BASE+path, { headers?, redirect: 'follow' })
// uses cookieHeader when withCookie
```

Per-route result shape (inline object, not exported type):

```js
{
  label, path, status, len,
  redirectedToLogin, // /login in final URL when path !== '/login'
  hasNaN,            // /NaN/ in response text
  hasUndefined,      // /\bundefined\b/ in text
  thin,              // len < 1500
  ok,                // status === 200 && !redirectedToLogin && !thin
}
```

### Business purpose

End-to-end **route inventory verification** after deploy or seed:

1. Confirm authentication works against AUTH_URL host.
2. Confirm **session cookie** exists (name matches `/session/i`).
3. Confirm **favicon** unauthed + **`/logo.png`** authed return bytes; login HTML has brand `<img>` under `/_next/static/media/*.png`.
4. Confirm **nav logo + theme toggle** on `/parties` (DOM).
5. Confirm theme toggle **flips** `html.dark` (no settle wait — weaker than verify-logo-theme).
6. For each of **23 routes**, authed `fetch` with cookie: not redirected to login, HTTP 200, body length ≥ 1500; flag NaN/undefined in HTML/text.

More route coverage than screenshot or verify.mjs; less deep content semantics than verify.mjs.

### Key logic

1. Puppeteer login → extract `page.cookies()` → `cookieHeader` string for Node `fetch`.
2. Asset checks: `/favicon.ico` unauthed, `/logo.png` authed; log `content-type`, byte lengths.
3. Login HTML regex: `/<img[^>]+src="[^"]*\/_next\/static\/media\/[^"]+\.png"/`.
4. Nav: any static media `.png` in nav/header + button text/aria/title matching `/theme|sun|moon|light|dark/i`.
5. Route loop: `ok = status === 200 && !redirectedToLogin && !thin` — **NaN/undefined do not fail `ok`**, only logged.
6. Summary: `okCount/rows.length`; prints BAD ROUTES; final `VERDICT:` line aggregates all flags; `VERIFY_DONE`.

### Side effects

| Effect | Detail |
|--------|--------|
| Temp Chromium profile | `pcrm-vrfy-*` |
| Session creation | Real login |
| Many HTTP GETs | Full HTML bodies for 23 routes + assets (memory for large pages) |
| Theme flip | Two clicks on dashboard if toggle present |
| Console output only | No PNG files |
| No `process.exit(1)` | Always closes browser and logs DONE-style message |

### Security / RBAC

- Hardcoded admin credentials again.
- Uses **session cookie in Cookie header** for fetch — validates that middleware/proxy accepts cookie auth for SSR HTML.
- Does **not** test unauthorized access, role walls, or multi-tenant isolation.
- Logs whether session cookie is present (name only via regex, not value in summary — full cookie header held in memory).
- Favicon noted as “excluded from the proxy matcher” — documents auth middleware exception.

### Coupling

| Coupled to | How |
|------------|-----|
| Seed UUIDs | Seven entity IDs for detail routes |
| App route tree | Full list of marketing-critical pages |
| Auth middleware / proxy | Redirect-to-login detection |
| Static assets | `/favicon.ico`, `/logo.png`, Next media path |
| Theme toggle UX | Loose button text/aria match |
| `screenshot.mjs` | Comment cross-ref for AUTH_URL rationale |
| Global `fetch` | Node runtime |

### Risks / TODOs

- **Stale seed IDs** (7 entities) → thin/404/error pages fail or misreport.
- **Thin threshold 1500** arbitrary — may false-fail sparse legit pages or false-pass error shells.
- **NaN/undefined not in `ok`** — content bugs can still print “OK”.
- Theme toggle check **no async wait** after click — race with next-themes (verify-logo-theme is more reliable).
- Logo check on login accepts **any** `/_next/static/media/*.png`, not necessarily BC logo.
- Hardcoded credentials; no CI package.json script.
- Cookie fetch may miss HttpOnly edge cases if cookie jar incomplete, but Puppeteer `page.cookies()` should include HttpOnly for same origin.
- `/credit/new` and list pages assumed always ≥1500 bytes when authed.

---

## 4. `scripts/verify.mjs`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/scripts/verify.mjs` |
| **Lines** | 135 |
| **Module type** | ESM, top-level `await` |
| **Role** | Content-quality verification for previously broken screens: login, navigate, dump body text metrics (NaN/undefined/empty states) and page-specific DOM probes |

### Exports

None.

### Imports

```js
import puppeteer from 'puppeteer-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
```

**Does not** read `AUTH_URL` or `.env.local`.

### Constants / configuration

| Symbol | Value | Notes |
|--------|--------|------|
| `BASE` | `'http://localhost:3000'` | **Hardcoded** — unlike the other three scripts |
| `EXE` | `'/usr/bin/chromium-browser'` | |
| `PROFILE` | `mkdtempSync(join(tmpdir(), 'pcrm-verify-'))` | |
| Login email | `'shray@binarycapital.in'` | |
| Login password | **`'devpass123'`** | **Different** from other scripts’ `BinaryCapital@2026` |
| Email selector | `input[name="email"]` only | Stricter than multi-selector siblings |
| Password selector | `input[name="password"]` | Wait uses this name |
| headless | `true` (boolean) | Others use `'new'` string |
| Default timeout | `45000` | Longer than siblings |
| Credit UUID | `'b28d3d04-1f20-4c57-90de-2f9d78777837'` | **Different** from screenshot/verify-routes `014f6ae9-...` |

### Function signatures

```js
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const go = async (path, settleMs = 2200) => {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await wait(settleMs);
};

const check = async (path, label) => {
  // navigates, evaluates document.body.innerText
  // returns { label, url, len, hasNaN, hasUndefined, hasNoParty, hasNoData }
};
```

Label-specific probes inside `check`:

| `label` | Extra logic |
|---------|-------------|
| `credit-detail` | Snippet of body (1200 chars collapsed whitespace) |
| `audit` | Date-like tokens `/\d{2} [A-Z][a-z]{2} \d{4}/g` as row proxy; sticky day anchors via `[class*="sticky"][class*="top-"]` → `{ stickyCount, distinctLabels, sample }` |
| `dashboard` | Snippet 1000 chars |
| `deals` | Snippet 800 chars |
| `parties` | Links `a[href^="/parties/"]` name list + uniqueness; `[data-strength],[class*="strength"]`; `time,[datetime]` relative-time variety |
| `credit-workspace` | Source-data panel: `button[aria-controls="source-data-table"]`, `#source-data-table`, collapsed message; asserts `SOURCE_DATA_COLLAPSED_BY_DEFAULT` |

### Routes checked (in order)

```js
await check('/parties', 'parties');
await check('/credit/b28d3d04-1f20-4c57-90de-2f9d78777837', 'credit-detail');
await check('/compliance/audit', 'audit');
await check('/deals', 'deals');
await check('/', 'dashboard');
await check('/credit/b28d3d04-1f20-4c57-90de-2f9d78777837/workspace', 'credit-workspace');
```

### Business purpose

More reliable than screenshots for confirming:

- No rendered **`NaN`** / **`undefined`** in body text.
- Real data rows (parties variety, audit dates, sticky day anchors).
- Credit workspace **source data collapsed by default** (a11y + UX contract: toggle present, `aria-expanded="false"`, label “Show source data”, collapsed message, table not visible).

Comment at top: “Verify the previously-broken screens render real data…”

### Key logic

1. Login with `Promise.all([waitForFunction not /login, click submit])` — parallel wait/submit pattern.
2. Global body scans: `/NaN/`, `/undefined/`, `/No party/`, `/No data/`.
3. Parties: strength-band variety + relative times (guards against seed “all 14h ago” bug).
4. Workspace: boolean composite:

```js
const collapsed =
  info.togglePresent &&
  info.ariaExpanded === 'false' &&
  /Show source data/.test(info.toggleLabel || '') &&
  info.collapsedMsg &&
  !info.tableVisible;
```

5. SUMMARY loop prints per-label flags; ends `VERIFY_DONE`.

### Side effects

| Effect | Detail |
|--------|--------|
| Chromium launch | headless true, temp profile |
| Network | Only `localhost:3000` |
| Auth | Session as seed user with **devpass123** |
| Console | Verbose snippets + summary |
| No screenshots | Text-only |

### Security / RBAC

- Hardcoded credentials (`devpass123`) — may be **out of sync** with current seed-admin password used by other scripts (`BinaryCapital@2026`), causing silent login failure.
- No RBAC matrix testing.
- Longer timeouts increase hang window if server down.

### Coupling

| Coupled to | How |
|------------|-----|
| Local Next dev/prod on :3000 | Fixed BASE |
| Credit workspace UI | `aria-controls="source-data-table"`, copy “Source data collapsed” / “Show source data” |
| Parties list markup | `/parties/` links, strength attrs/classes, `<time>` |
| Audit UI | Sticky day strips class pattern `sticky` + `top-` |
| Seed data | Specific credit UUID + password convention |

### Risks / TODOs

- **Credential drift**: only script using `devpass123` vs `BinaryCapital@2026` elsewhere — high risk of false failures.
- **ID drift**: credit UUID differs from screenshot/verify-routes set — documents “current seed” inconsistency across scripts.
- **No AUTH_URL support**: fails when app only reachable via public IP / non-localhost AUTH_URL (the bug screenshot.mjs explicitly fixed).
- Email/password selectors less resilient than siblings.
- `hasUndefined` matches literal word in body — may false-positive legitimate copy.
- No exit codes; SUMMARY does not compute overall pass/fail.
- headless `true` vs `headless: 'new'` may differ rendering from other scripts.
- Not in package.json scripts.

---

## Cross-file comparison

| Aspect | `screenshot.mjs` | `verify-logo-theme.mjs` | `verify-routes.mjs` | `verify.mjs` |
|--------|------------------|-------------------------|---------------------|--------------|
| Lines | 210 | 102 | 195 | 135 |
| AUTH_URL | Yes | Yes | Yes | **No** (localhost only) |
| Password | `BinaryCapital@2026` | `BinaryCapital@2026` | `BinaryCapital@2026` | **`devpass123`** |
| Credit ID | `014f6ae9-…` | n/a | `014f6ae9-…` | **`b28d3d04-…`** |
| Party ID | `988e469c-…` | n/a | `988e469c-…` | n/a (list only) |
| Extra IDs | — | — | model, kyc, document, interaction, task | — |
| Output | PNGs to absolute path | console | console | console |
| Primary goal | Visual captures D/L/mobile | Logo + theme flip | 23 routes HTTP health | Body content quality |
| Theme check | Forces theme via localStorage | aria-label toggle + wait | Loose toggle, no wait | none |
| package.json | Not wired | Not wired | Not wired | Not wired |

### Shared patterns

- All use `puppeteer-core` + system Chromium `/usr/bin/chromium-browser`.
- All create disposable Chromium profiles under `tmpdir()` with `pcrm-*` prefixes.
- All use `--no-sandbox`, `--disable-gpu`, `--disable-dev-shm-usage` (screenshot/verify-routes/logo also `--headless=new` args).
- Three of four hardcode seed admin `shray@binarycapital.in`.
- None export modules; none register npm scripts; none set non-zero exit on failure.

### Shared risks (batch-level)

1. **Secrets in repo** — plaintext passwords in four files (two distinct passwords).
2. **Seed UUID brittleness** — `gen_random_uuid()` reseeds invalidate detail routes.
3. **Script family inconsistency** — AUTH_URL, password, and credit ID not aligned → unreliable dogfooding.
4. **No CI integration** — manual invocation only; no fail-the-build semantics.
5. **Machine-specific paths** — Chromium path, screenshot OUT under `/home/Jashmhta/crm/screenshots`.
6. **Temp profile leak** — mkdtemp dirs not removed after close.

### Related files (not in this batch)

- `scripts/mobile-pass.mjs` — mobile screenshots; cites screenshot AUTH_URL rationale; same OUT path.
- `scripts/_audit-set2.mjs` — another screenshot set under `screenshots/set2-audit`.
- `src/db/seed-admin.ts` — documented source of admin password for screenshot credentials.
- `package.json` — `puppeteer-core` in devDependencies; no npm scripts for these four files.

---

## Inventory table (batch-008)

| # | Path | Lines | Role |
|---|------|-------|------|
| 1 | `scripts/screenshot.mjs` | 210 | Multi-theme multi-viewport PNG capture of core CRM screens |
| 2 | `scripts/verify-logo-theme.mjs` | 102 | Logo presence + theme toggle functional smoke |
| 3 | `scripts/verify-routes.mjs` | 195 | Authed HTTP + DOM verification of 23 user routes + assets |
| 4 | `scripts/verify.mjs` | 135 | Deep content smoke (NaN, data variety, source-data collapse) |

**Total lines analyzed:** 642  
**Docs ignored:** yes (no doc files in batch)  
**App runtime impact:** none — offline/dev tooling only; requires running app + Chromium + seed data to execute.
