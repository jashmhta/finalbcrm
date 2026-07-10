# Agent 006 — File-by-File Analysis

**Batch:** `batch-006.list`  
**Workspace root:** `/home/Jashmhta/crm/bc-crm/app`  
**Files analyzed:** 4  
**Scope note:** Docs ignored per instructions. These are build config + one-off Puppeteer diagnostic/audit scripts (not production app runtime).

---

## 1. `postcss.config.mjs`

| Field | Value |
|--------|--------|
| **Path** | `postcss.config.mjs` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/postcss.config.mjs` |
| **Lines** | 7 |
| **Role** | PostCSS configuration module for the Next.js/app CSS pipeline. Wires Tailwind CSS v4 PostCSS plugin into the build. |
| **Module system** | ESM (`.mjs`); default export consumed by PostCSS / Next tooling. |

### Exports

```js
export default config;
// config: { plugins: { "@tailwindcss/postcss": {} } }
```

- **Default export:** plain object `config` with shape:
  - `plugins: Record<string, object>`
  - Key `"@tailwindcss/postcss"` → empty options object `{}` (plugin defaults).

### Imports

- None. No `import` statements.

### Business purpose

- Enables Tailwind CSS processing during CSS build/transform for the CRM UI.
- Not a domain/business feature; pure build-time styling infrastructure.
- Empty plugin options mean all Tailwind behavior comes from project CSS entry (e.g. `@import "tailwindcss"` / `@theme`) elsewhere, not from this file.

### Key logic

```1:7:postcss.config.mjs
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- Single plugin registration; no Autoprefixer, cssnano, or custom PostCSS plugins declared here.
- Relies on package `@tailwindcss/postcss` being installed and resolvable at build time.

### Side effects

- **Build-time only:** when Next/PostCSS loads this config, CSS files go through Tailwind generation/purging/utilities.
- No runtime I/O, network, DB, or filesystem writes from this module itself.
- Changing this file invalidates CSS transform caches and can change produced CSS for the entire app.

### Security / RBAC

- None. No auth, secrets, or user-facing surface.
- Misconfiguration risk is availability/UX (broken styles), not privilege escalation.

### Coupling

| Coupled to | How |
|------------|-----|
| `@tailwindcss/postcss` (npm) | Required dependency; must match Tailwind v4 PostCSS entry style. |
| Next.js CSS pipeline | Auto-discovers `postcss.config.mjs` at app root. |
| Global CSS / Tailwind sources | Indirect: theme tokens, content paths, `@source` live in CSS/config elsewhere. |

### Risks / TODOs

- No TODOs/FIXMEs in file.
- If `@tailwindcss/postcss` is missing or version-mismatched with `tailwindcss`, builds fail or styles silently differ.
- Empty options object gives no local documentation of intended Tailwind setup; all policy is elsewhere.
- No `autoprefixer` here (may be intentional under Tailwind v4; verify against project Tailwind version if browser support regresses).

---

## 2. `scripts/_audit-set2.mjs`

| Field | Value |
|--------|--------|
| **Path** | `scripts/_audit-set2.mjs` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/scripts/_audit-set2.mjs` |
| **Lines** | 104 |
| **Role** | Standalone visual QA / screenshot audit script. Logs into local CRM, captures full-page PNGs for a fixed set of routes at desktop and mobile viewports, and logs horizontal overflow. |
| **Module system** | ESM top-level await script (run via `node scripts/_audit-set2.mjs` or similar). Underscore prefix suggests private/ad-hoc audit, not a published CLI. |

### Exports

- **None.** Side-effect script; no `export` declarations.
- Top-level execution starts browser, authenticates, captures, exits.

### Imports

| Import | From | Usage |
|--------|------|--------|
| `puppeteer` (default) | `puppeteer-core` | Launch Chromium, pages, screenshots |
| `mkdirSync`, `mkdtempSync` | `node:fs` | Create screenshot dir; temp Chrome profile |
| `tmpdir` | `node:os` | Base for temp profile dir |
| `join` | `node:path` | Path for temp profile |

### Constants / data (quoted)

```js
const BASE = 'http://localhost:3000';
const OUT = '/home/Jashmhta/crm/screenshots/set2-audit';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PROFILE = mkdtempSync(join(tmpdir(), 'pcrm-set2-'));
const EXE = '/usr/bin/chromium-browser';

// Hardcoded entity UUIDs for detail routes:
const KYC = 'b2d16c4f-892c-405d-bf66-d082d4a8509e';
const INT = 'b799af9c-4329-4e03-994f-0f03cc9916e2';
const TASK = 'a3a80b9d-9411-44f2-81d5-bb4b04510bb4';
const TASK_BLK = '62418798-1b39-43f9-8089-459d637714c0';
const DOC = 'ea46de59-3647-4f70-9ea4-945aa7876dd6';
const DOC_NORM = '5b5a5485-96df-4f05-a20d-a131b4022fd7';

const PAGES = [
  ['01-dashboard', '/'],
  ['02-integrations', '/integrations'],
  ['03-kyc-detail', `/compliance/kyc/${KYC}`],
  ['04-consent', '/compliance/consent'],
  ['05-consent-dsr', '/compliance/consent?tab=dsr'],
  ['06-interaction-detail', `/interactions/${INT}`],
  ['07-task-detail', `/tasks/${TASK}`],
  ['08-task-blocked', `/tasks/${TASK_BLK}`],
  ['09-document-detail', `/documents/${DOC}`],
  ['10-document-normal', `/documents/${DOC_NORM}`],
];
// Each tuple: [string name, string path]
```

### Function signatures

```js
async function triggerReveals(p /* Puppeteer Page */): Promise<void>
async function cap(
  browser,      // Puppeteer Browser
  name,         // string — screenshot basename
  path,         // string — app route path
  w,            // number — viewport width
  h,            // number — viewport height
  isMobile      // boolean
): Promise<void>
```

### Business purpose

- **Not production CRM logic.** Dev/design audit tooling for Binary CRM UI set “set2”.
- Validates that key screens render and can be snapshotted after login:
  - Dashboard, integrations
  - Compliance KYC detail + consent (+ DSR tab)
  - Interaction detail
  - Task detail + blocked task
  - Document detail (two fixtures)
- Desktop `1440×900` and mobile `390×844` coverage for responsive QA.
- Overflow detection flags layout bugs (horizontal scroll > viewport + 2px).

### Key logic

1. **Setup:** `mkdirSync(OUT, { recursive: true })`; temp Chrome user data dir under `os.tmpdir()` with prefix `pcrm-set2-`.
2. **Launch:** `puppeteer.launch({ executablePath: EXE, headless: 'new', userDataDir: PROFILE, args: [...], defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 }, protocolTimeout: 60000 })`.
3. **Auth:** Navigate `BASE/login`, type email + password, submit, poll until URL leaves `/login` (up to ~20s), wait 2800ms.
4. **Capture loop (`cap`):**
   - New page, set viewport (incl. `deviceScaleFactor: 2`, optional `isMobile`).
   - `goto` with `waitUntil: 'domcontentloaded'`, timeout 20s.
   - Wait 1800ms; `triggerReveals` (scroll page in 700px steps to fire scroll animations; force opacity/transform/filter on elements with `opacity: 0` inline styles; wait 700ms).
   - Full-page screenshot to `${OUT}/${name}.png` with `captureBeyondViewport: true`.
   - Evaluate overflow: compare `documentElement.scrollWidth` / `body.scrollWidth` vs `clientWidth`.
5. **Runs:** All `PAGES` as `d-{name}` then again as `m-{name}`; close browser; log `DONE`.

### Side effects

| Side effect | Detail |
|-------------|--------|
| Filesystem write | Creates `/home/Jashmhta/crm/screenshots/set2-audit/` and many PNG files |
| Filesystem write | Temp Chrome profile under system tmp (`pcrm-set2-*`) — not explicitly cleaned |
| Network | HTTP to `http://localhost:3000` (login + 10 routes × 2 viewports) |
| Process | Spawns Chromium via `puppeteer-core` |
| Console | Logs shot success/errors, overflow JSON, post-login URL |
| Auth session | Establishes real app session cookies in browser profile |

### Security / RBAC

- **Hardcoded credentials in source:**
  - Email: `shray@binarycapital.in`
  - Password: `devpass123`
- Credentials are a **secret leakage risk** if committed to shared/public repos or logs.
- Assumes local dev stack and an account that can open compliance/KYC, tasks, documents, integrations (no explicit RBAC checks in script—relies on app session).
- `--no-sandbox` Chromium flag weakens browser isolation (common for CI/containers; risk if untrusted pages loaded—here only localhost).
- Fixed UUIDs may expose existence of real fixture/production-like IDs in the repo.
- No CSRF/token handling beyond form login; no MFA path.

### Coupling

| Coupled to | How |
|------------|-----|
| Local app on `:3000` | Hardcoded `BASE` |
| Login form selectors | `input[type="password"]`, email selectors, `button[type="submit"]` |
| Route map | App routes for dashboard, integrations, compliance, interactions, tasks, documents |
| Seed/fixture data | Six UUIDs must exist and be visible to the login user |
| Host Chromium | `/usr/bin/chromium-browser` |
| Screenshot root outside app | `/home/Jashmhta/crm/screenshots/set2-audit` (machine-specific absolute path) |
| Animation/CSS conventions | Forces reveal of `opacity: 0` inline-styled elements |

### Risks / TODOs

- No formal TODOs; ad-hoc script quality:
  - **Stale credentials:** `devpass123` may differ from other scripts (`BinaryCapital@2026` in diag scripts) → silent login failure.
  - **Brittle fixtures:** UUIDs die if DB reseeded.
  - **Absolute OUT path** not portable across machines/users.
  - Empty `catch {}` in `triggerReveals` swallows errors.
  - No cleanup of `PROFILE` temp dir or browser crash recovery.
  - Overflow threshold `+ 2` is heuristic only.
  - `deviceScaleFactor: 2` + fullPage can produce large PNGs / slow runs.
  - Login does not assert success beyond URL not containing `/login` (could land on error page).
  - Racey fixed sleeps (`wait(1800)`, etc.) instead of network/CSS readiness (related issues investigated by sibling diag scripts).

---

## 3. `scripts/diag-css-links.mjs`

| Field | Value |
|--------|--------|
| **Path** | `scripts/diag-css-links.mjs` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/scripts/diag-css-links.mjs` |
| **Lines** | 69 |
| **Role** | Diagnostic CLI: after authenticated mobile navigation, list every `<link rel="stylesheet">`, whether `link.sheet` is non-null, `disabled`, `data-precedence`, and re-fetch each CSS URL with session cookies for HTTP status + body byte length. Compares `/deals`, `/parties`, `/`. |
| **Module system** | ESM top-level await; console-only output. |

### Exports

- **None.** Diagnostic entry script.

### Imports

| Import | From | Usage |
|--------|------|--------|
| `puppeteer` (default) | `puppeteer-core` | Browser automation |
| `mkdtempSync`, `readFileSync` | `node:fs` | Temp profile; optional `.env.local` read |
| `tmpdir` | `node:os` | Temp dir base |
| `join`, `resolve` | `node:path` | Profile path; resolve `.env.local` |

### Configuration resolution

```js
let AUTH_URL = process.env.AUTH_URL;
if (!AUTH_URL) {
  // parse first AUTH_URL=... line from process.cwd()/.env.local
}
const BASE = (AUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
const EXE = '/usr/bin/chromium-browser';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PROFILE = mkdtempSync(join(tmpdir(), 'pcrm-csslnk-'));
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ... Safari/604.1';
```

- **Env:** `AUTH_URL` (optional) → app base URL.
- **Fallback file:** `.env.local` line matching `/^AUTH_URL=(.+)$/`.
- **Default base:** `http://localhost:3000`.

### Function signatures

```js
async function cssInfo(path /* string route e.g. '/deals' */): Promise<void>
```

### Business purpose

- Investigates a suspected bug: **“second CSS never loads”** on some pages under Puppeteer (comment at top).
- Determines whether failure is a **real 404/broken chunk** vs a **load race** under headless mobile.
- Compares stylesheet inventory across high-traffic CRM surfaces: deals list, parties list, dashboard.

### Key logic

1. Launch Chromium headless mobile viewport `390×844`, `deviceScaleFactor: 3`, `isMobile: true`, `hasTouch: true`, iPhone UA.
2. Login flow (same pattern as other scripts): email + password, poll off `/login`.
3. Build `cookieHdr` string from `page.cookies()` for subsequent `fetch`.
4. **`cssInfo(path)`:**
   - `goto` with `domcontentloaded`; wait 2500ms.
   - In-page: map all `link[rel="stylesheet"]` → `{ href, loaded: l.sheet !== null, disabled, precedence: data-precedence }`.
   - For each link: `fetch(`${BASE}${new URL(l.href).pathname}`, { headers: { Cookie: cookieHdr } })` → status + `text().length`.
   - Log scroll width: `max(documentElement.scrollWidth, body.scrollWidth)`.
5. Invoke for `/deals`, `/parties`, `/`; close browser; log `CSSLINK_DONE`.

Note: lines with double `.replace(/^https?:\/\/[^/]+/, '')` on `directHref` compute an unused path variable; actual fetch uses `new URL(l.href).pathname` only (pathname-only may drop query strings on CSS URLs).

### Side effects

| Side effect | Detail |
|-------------|--------|
| Console output | Primary product (stylesheet matrix + scrollW) |
| Network | Login + 3 page loads + N CSS GETs with cookies |
| Filesystem read | Optional `.env.local` for `AUTH_URL` |
| Filesystem write | Temp Chrome profile `pcrm-csslnk-*` (not cleaned) |
| Process | Chromium via puppeteer-core |

No screenshot writes; no DB mutations (read-only browsing + CSS GET).

### Security / RBAC

- **Hardcoded credentials:**
  - Email: `shray@binarycapital.in`
  - Password: `BinaryCapital@2026`
- Stronger/different password than `_audit-set2.mjs` — credential drift risk.
- Sends session cookies on `fetch` of CSS paths (needed if CSS behind auth; still elevates cookie handling care).
- Reads `.env.local` for URL only (not secrets), but path is cwd-relative.
- `--no-sandbox` again.
- Requires authenticated access to `/deals`, `/parties`, `/` (RBAC is whatever that user has).

### Coupling

| Coupled to | How |
|------------|-----|
| App routes `/login`, `/deals`, `/parties`, `/` | Navigation targets |
| Login form DOM | Same selector set as set2 audit |
| Next.js CSS delivery | `link[rel=stylesheet]`, `data-precedence` (React/Next style loading) |
| `AUTH_URL` / `.env.local` | Base URL configuration |
| Host Chromium | `/usr/bin/chromium-browser` |
| Global `fetch` | Node 18+ native fetch assumed |

### Risks / TODOs

- Comment documents hypothesis; no code TODO markers.
- **Dead/odd code:** `directHref` computed twice with replace and unused.
- **CSS URL fidelity:** pathname-only re-fetch may miss hashed query params if present.
- **Same-origin assumption:** `BASE + pathname` fails if stylesheet `href` points to CDN different host (pathname alone would 404 on app host).
- Fixed 2500ms wait may still race CSS vs truly broken load.
- Credentials in repo; password differs from `_audit-set2.mjs`.
- Temp profile leak on disk.
- Mobile-only diagnosis; desktop CSS link set may differ.

---

## 4. `scripts/diag-css-timing.mjs`

| Field | Value |
|--------|--------|
| **Path** | `scripts/diag-css-links.mjs` companion |
| **Actual path** | `scripts/diag-css-timing.mjs` |
| **Absolute path** | `/home/Jashmhta/crm/bc-crm/app/scripts/diag-css-timing.mjs` |
| **Lines** | 87 |
| **Role** | Timing diagnostic for Tailwind/CSS application on mobile `/deals`. Polls layout metrics (`scrollWidth`, nav `display`/`maxWidth`, nav wrap `display`, stylesheet counts/load flags) at multiple delays and wait strategies to distinguish pre-CSS measurement artifacts from persistent overflow. |
| **Module system** | ESM top-level await diagnostic. |

### Exports

- **None.**

### Imports

| Import | From | Usage |
|--------|------|--------|
| `puppeteer` (default) | `puppeteer-core` | Browser automation |
| `mkdtempSync`, `readFileSync` | `node:fs` | Temp profile; `.env.local` |
| `tmpdir` | `node:os` | Temp base |
| `join`, `resolve` | `node:path` | Paths |

Same env/`AUTH_URL` pattern as `diag-css-links.mjs`.

### Constants

```js
const BASE = (AUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
const EXE = '/usr/bin/chromium-browser';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PROFILE = mkdtempSync(join(tmpdir(), 'pcrm-csstime-'));
const MOBILE_UA = /* same iPhone Safari UA as diag-css-links */;
```

### Function signatures

```js
async function snap(label /* string */): Promise<void>
// side effect: page.evaluate → console.log metrics
```

### In-page metrics shape (from `page.evaluate`)

```js
{
  scrollW: number,           // max(documentElement.scrollWidth, body.scrollWidth)
  navDisplay: string,        // getComputedStyle(nav).display or 'no-nav'
  navMaxWidth: string,       // getComputedStyle(nav).maxWidth or 'no-nav'
  wrapDisplay: string,       // getComputedStyle(nav > div.hidden).display or 'no-wrap'
  stylesheets: number,       // document.styleSheets.length
  cssLinks: Array<{ href: string, loaded: boolean /* l.sheet !== null */ }>
}
```

Selectors used:

- `nav[aria-label="Primary"]` — primary navigation landmark
- `nav[aria-label="Primary"] > div.hidden` — intended mobile-hidden desktop nav wrap (Tailwind `hidden` / display utilities)

### Business purpose

- Confirms whether **horizontal overflow on `/deals` under mobile Puppeteer** is:
  - **Transient:** measured before Tailwind/CSS applies (`display` still not `flex`, large `scrollW`), or
  - **Persistent:** still wrong after long waits / `networkidle2` / explicit stylesheet readiness.
- Comment success criteria: if `display` flips to flex and `scrollWidth` drops to ~390, overflow was a **pre-CSS artifact** (important for interpreting other screenshot/audit scripts that use fixed sleeps).

### Key logic

1. Launch mobile headless Chromium (same profile pattern `pcrm-csstime-`, viewport 390×844, DSF 3, touch).
2. Authenticate with hardcoded user (same as `diag-css-links.mjs`).
3. **Test 1 — `domcontentloaded` + poll:** goto `/deals`, snap at cumulative ~500ms, 1500ms, 3000ms, 5000ms (via sequential `wait` + `snap`).
4. **Test 2 — `networkidle2`:** re-goto `/deals` with `waitUntil: 'networkidle2'`, wait 500ms, snap `idle+500ms`.
5. **Test 3 — wait for stylesheets:** re-goto `domcontentloaded`, then:

```js
await page.waitForFunction(() => {
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
  return links.length > 0 && links.every((l) => l.sheet !== null);
}, { timeout: 15000 });
```

   then wait 500ms, snap `post-css-load`.
6. Close browser; log `CSSTIME_DONE`.

### Side effects

| Side effect | Detail |
|-------------|--------|
| Console | Timed metric logs only |
| Network | Login + three navigations to `/deals` |
| FS read | Optional `.env.local` |
| FS write | Temp profile `pcrm-csstime-*` |
| Process | Chromium |

No screenshots; no mutations beyond establishing login session cookies.

### Security / RBAC

- **Hardcoded credentials** identical to `diag-css-links.mjs`:
  - `shray@binarycapital.in` / `BinaryCapital@2026`
- Session-dependent access to `/deals`.
- `--no-sandbox`.
- No privilege escalation paths in script itself; risks are credential commit + local auth session.

### Coupling

| Coupled to | How |
|------------|-----|
| Layout DOM contract | `nav[aria-label="Primary"]` and child `div.hidden` — **breaks silently if nav markup/a11y label changes** |
| Tailwind mobile utilities | Expects nav wrap to become `display` none/flex via CSS |
| `/deals` page | Focused repro for overflow |
| Login UX | Form selectors |
| Sibling diagnostics | Complements `diag-css-links.mjs` (link HTTP health vs timing/CSS apply) |
| `scripts` mobile-pass | Comment: “mirrors mobile-pass.mjs” wait strategy |

### Risks / TODOs

- No inline TODOs.
- **Selector fragility:** `> div.hidden` depends on Tailwind class remaining `hidden` in source (if class names change or structure nests differently → always `no-wrap`).
- **`networkidle2`** can hang or misbehave with long-polling/websockets (timeout 30s).
- **`waitForFunction` on `l.sheet`:** cross-origin stylesheets may throw/null `sheet` due to CORS even when applied — false “stylesheet wait failed”.
- Shared credential/password inconsistency with `_audit-set2.mjs`.
- Temp profile not removed.
- Single-route focus (`/deals`) may not generalize overflow root cause on other pages.

---

## Cross-file summary (batch 006)

| File | Kind | Runtime? | Secrets in file? |
|------|------|----------|------------------|
| `postcss.config.mjs` | Build config | Build-time only | No |
| `scripts/_audit-set2.mjs` | Visual audit (screenshots + overflow) | Dev script | Yes (`devpass123`) |
| `scripts/diag-css-links.mjs` | CSS link/HTTP diagnostic | Dev script | Yes (`BinaryCapital@2026`) |
| `scripts/diag-css-timing.mjs` | CSS timing/layout diagnostic | Dev script | Yes (`BinaryCapital@2026`) |

### Shared patterns (scripts)

- `puppeteer-core` + system Chromium `/usr/bin/chromium-browser`
- Headless `new`, `--no-sandbox`, temp `userDataDir` under `os.tmpdir()`
- Form-based login against local/AUTH_URL CRM
- Fixed sleeps + selector polling; no shared helper module (duplicated login/wait/env parsing)
- Purpose cluster: **responsive/CSS regression investigation** for Binary CRM UI under mobile Puppeteer

### Coupling graph (batch-local)

```
postcss.config.mjs  →  @tailwindcss/postcss  →  (app CSS build; styles that diag scripts observe)

_audit-set2.mjs     →  localhost:3000 routes + fixture UUIDs + screenshot dir
diag-css-links.mjs  →  AUTH_URL/.env.local + /deals|/parties|/ + stylesheet links
diag-css-timing.mjs →  AUTH_URL/.env.local + /deals + Primary nav DOM + stylesheet readiness
```

### Highest-priority risks in batch

1. **Hardcoded passwords in three scripts**, with **two different passwords** across scripts → auth flakiness + secret exposure.
2. **Machine-specific absolute paths** (`/home/Jashmhta/...`, Chromium path).
3. **Audit screenshots depend on seed UUIDs** that may not exist.
4. **Diagnostics tightly coupled to nav a11y markup and Next CSS link behavior** — useful for current bugs, brittle long-term.
5. **postcss.config** is minimal and healthy; risk is dependency alignment only, not logic bugs.

---

*End of agent-006 analysis.*
