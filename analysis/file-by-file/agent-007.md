# Agent 007 — File-by-File Analysis

**Batch:** `batch-007.list`  
**Workspace root:** `/home/Jashmhta/crm/bc-crm/app`  
**Scope:** 4 Puppeteer diagnostic / mobile-QA scripts under `scripts/`  
**Ignored:** documentation files (none in this batch)

---

## 1. `scripts/diag-nav.mjs`

| Field | Value |
|-------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/scripts/diag-nav.mjs` |
| **Lines** | 97 |
| **Module type** | ES module top-level await (`.mjs`) |
| **Role** | One-off **browser diagnostic** for mobile horizontal overflow root-cause analysis on nav |

### Exports

None. No `export` statements. Script is executed as a CLI entrypoint (`node scripts/diag-nav.mjs`).

### Imports

| Symbol | From | Purpose |
|--------|------|---------|
| `puppeteer` (default) | `puppeteer-core` | Headless Chromium control |
| `mkdtempSync`, `readFileSync` | `node:fs` | Temp browser profile dir; read `.env.local` for `AUTH_URL` |
| `tmpdir` | `node:os` | OS temp directory base |
| `join`, `resolve` | `node:path` | Path construction for profile + `.env.local` |

### Constants / signatures

```js
let AUTH_URL = process.env.AUTH_URL;  // optional override
const BASE = (AUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
const EXE = '/usr/bin/chromium-browser';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PROFILE = mkdtempSync(join(tmpdir(), 'pcrm-diag-'));
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ...';

async function diag(path) { /* ... */ }
```

**Browser launch config:**
- `executablePath: EXE` (`/usr/bin/chromium-browser`)
- `headless: 'new'`
- `userDataDir: PROFILE` (temp `pcrm-diag-*`)
- Args: `--no-sandbox`, `--disable-gpu`, `--disable-dev-shm-usage`, `--hide-scrollbars`, `--headless=new`
- `defaultViewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }`
- `protocolTimeout: 60000`
- `page.setDefaultTimeout(25000)`

### Business purpose

Engineering diagnostic (not product runtime). Explains **why** document `scrollWidth` differs across pages that share the same `SiteNav` component:

- Overflowing example: `/deals` (comment claims `scrollWidth=638`)
- Clean example: `/parties` (comment claims `scrollWidth=390`)
- Also probes `/compliance/audit` and `/`

It reports:
1. Desktop nav container computed `display` (the `div.hidden` / `md:flex` wrap under `nav[aria-label="Primary"]`)
2. Sample desktop nav link computed display + rect
3. Single widest element by max `getBoundingClientRect().right` and an 8-level ancestor chain (`overflowX`, `display`, width)

### Key logic

1. **Resolve BASE URL:** `AUTH_URL` from env, else parse `.env.local` line matching `/^AUTH_URL=(.+)$/`, else `http://localhost:3000`.
2. **Launch Chromium** with iPhone-class mobile viewport + mobile UA.
3. **Login flow (hardcoded credentials):**
   - `goto ${BASE}/login`
   - Wait for `input[type="password"]`
   - Type email: `shray@binarycapital.in`
   - Type password: `BinaryCapital@2026`
   - Click `button[type="submit"]`
   - Poll up to 40×500ms until URL leaves `/login`, then `wait(2000)`
4. **`diag(path)`:**
   - Navigate to `${BASE}${path}`, wait 1.5s for hydration
   - In-page `evaluate`:
     - `scrollW = max(documentElement.scrollWidth, body.scrollWidth)`
     - Query `nav[aria-label="Primary"] > div.hidden` → className, `display`, child metrics
     - Query `nav[aria-label="Primary"]` → class, display, width, overflowX, maxWidth
     - Scan **all** `*` elements for max `right` edge; build ancestor chain (max 8)
   - Log structured console output
5. Call `diag` for: `/deals`, `/parties`, `/compliance/audit`, `/`
6. Close browser; log `DIAG_DONE`

### Side effects

| Effect | Detail |
|--------|--------|
| Network | Hits live/local CRM at `BASE` (login + 4 authenticated page loads) |
| Filesystem | Creates temp Chromium profile under `os.tmpdir()` (`pcrm-diag-*`); not cleaned up in-script |
| Console | stdout diagnostic dumps |
| Browser | Launches system Chromium with `--no-sandbox` |
| Auth session | Creates real session via form login against the app |

**Does not:** write screenshots, mutate app DB intentionally, or export artifacts.

### Security / RBAC

| Issue | Severity | Notes |
|-------|----------|-------|
| **Hardcoded plaintext credentials** | **Critical** | Email `shray@binarycapital.in`, password `BinaryCapital@2026` committed in source |
| **No RBAC in script** | N/A | Assumes that user has access to all probed routes |
| **Chromium `--no-sandbox`** | Medium (local) | Weakens browser isolation; common for CI/containers but unsafe if browsing untrusted content |
| **Reads `.env.local`** | Low | Only extracts `AUTH_URL`; no secrets written |
| **Session cookies** | Medium | Live auth against real BASE if `AUTH_URL` points at non-local |

This script has **no application RBAC checks** of its own; it relies on the app’s NextAuth/session after form login.

### Coupling

- **DOM contract with `SiteNav`:** expects `nav[aria-label="Primary"]` and child `div.hidden` (Tailwind desktop-nav hide pattern).
- **Login form contract:** email/password inputs + submit button selectors.
- **Runtime deps:** `puppeteer-core`, system Chromium at fixed path, running app at `BASE`.
- **Routes:** hard-coupled to `/login`, `/deals`, `/parties`, `/compliance/audit`, `/`.
- Sibling pattern shared with other scripts in this batch (AUTH_URL bootstrap, login, mobile UA, puppeteer launch args).

### Risks / TODOs

- **Credential leak** in git history; rotate password; use env vars (`LOGIN_EMAIL` / `LOGIN_PASSWORD`).
- Temp profile dirs accumulate (no `rm` / `fs.rmSync` after run).
- Fixed Chromium path breaks on non-Debian hosts / different package names.
- Full `querySelectorAll('*')` scan can be slow on large DOMs.
- Comment-asserted scrollWidth numbers may drift as CSS changes; script does not fail CI on thresholds.
- Fragile if `SiteNav` markup or `aria-label` changes.
- No error handling around login failure beyond silent wait loop.
- Top-level await; uncaught rejection exits process.

---

## 2. `scripts/diag-theme-logo.mjs`

| Field | Value |
|-------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/scripts/diag-theme-logo.mjs` |
| **Lines** | 61 |
| **Module type** | ES module top-level await (`.mjs`) |
| **Role** | Focused **theme toggle + nav logo** verification diagnostic |

### Exports

None. CLI entrypoint only.

### Imports

| Symbol | From | Purpose |
|--------|------|---------|
| `puppeteer` (default) | `puppeteer-core` | Browser automation |
| `mkdtempSync`, `readFileSync` | `node:fs` | Temp profile; `.env.local` |
| `tmpdir` | `node:os` | Temp base |
| `join`, `resolve` | `node:path` | Paths |

### Constants / signatures

```js
let AUTH_URL = process.env.AUTH_URL;
const BASE = (AUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
const EXE = '/usr/bin/chromium-browser';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PROFILE = mkdtempSync(join(tmpdir(), 'pcrm-theme-'));
```

**Viewport:** desktop-style `{ width: 1440, height: 900, deviceScaleFactor: 1 }` (not mobile).

### Business purpose

Verify two UI contracts on an authenticated page:

1. **Nav logo:** any `<img>` inside `nav`/`header` (sample up to 4: `src`, `alt`, width).
2. **Theme toggle:** button with `aria-label` matching `/toggle color theme/i` flips `html.dark` class after a 600ms wait (accounts for `next-themes` effect-driven updates; instant check false-negatives).

Comment intent: “verifier’s instant check can false-negative” without post-click wait.

### Key logic

1. Resolve `BASE` (same AUTH_URL / `.env.local` pattern as other scripts).
2. Launch Chromium headless desktop viewport; temp profile `pcrm-theme-*`.
3. **Login** with same hardcoded credentials as `diag-nav.mjs`.
4. Navigate to `${BASE}/`, wait 1.5s.
5. **Logo probe** (`page.evaluate`):
   ```js
   document.querySelectorAll('nav a img, header img, nav img')
   // map: { src: first 120 chars, alt, w: getBoundingClientRect().width }
   ```
6. **Theme toggle probe** (async evaluate):
   - Read `before = document.documentElement.classList.contains('dark')`
   - Find button where `aria-label` matches `/toggle color theme/i`
   - Click; `await` 600ms; read `after`
   - Return `{ found, before, after, flipped: before !== after }`
7. Log JSON results; close browser; `THEME_LOGO_DONE`.

### Side effects

| Effect | Detail |
|--------|--------|
| Network | Login + dashboard load against `BASE` |
| DOM mutation | Clicks theme toggle → may persist theme via `next-themes`/localStorage for that profile |
| Filesystem | Temp Chromium profile `pcrm-theme-*` (not deleted) |
| Console | `nav/header imgs`, `theme toggle` JSON |

### Security / RBAC

| Issue | Severity | Notes |
|-------|----------|-------|
| **Hardcoded credentials** | **Critical** | Same `shray@binarycapital.in` / `BinaryCapital@2026` |
| **Theme mutation** | Low | Only affects temp browser profile’s stored theme preference |
| **`--no-sandbox`** | Medium (local) | Same as sibling scripts |
| **No app RBAC** | N/A | Uses privileged real user account |

### Coupling

- **Theme control a11y contract:** `aria-label` must include “toggle color theme” (case-insensitive).
- **Theme implementation:** expects `html` element class `dark` (Tailwind + next-themes convention).
- **Layout:** logo under `nav`/`header` as `<img>`.
- **Auth:** same login form selectors as other diag scripts.
- **Desktop-only** viewport; not suitable as mobile logo check.

### Risks / TODOs

- Hardcoded secrets (rotate; env-ify).
- If theme toggle uses different `aria-label` (i18n/copy change), `found: false` with no hard exit code.
- Does not restore theme after flip.
- No assertion exit code (`process.exit(1)` on failure) — log-only diagnostic.
- Profile leak in tmpdir.
- Assumes `/` is reachable post-login and renders nav immediately after 1.5s.

---

## 3. `scripts/mobile-overflow-all.mjs`

| Field | Value |
|-------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/scripts/mobile-overflow-all.mjs` |
| **Lines** | 132 |
| **Module type** | ES module top-level await (`.mjs`) |
| **Role** | **Full-route mobile overflow audit** (HTTP 200 + document overflow + uncontained overflowers) |

### Exports

None. CLI entrypoint only.

### Imports

| Symbol | From | Purpose |
|--------|------|---------|
| `puppeteer` (default) | `puppeteer-core` | Browser automation |
| `mkdtempSync`, `readFileSync` | `node:fs` | Temp profile; env |
| `tmpdir` | `node:os` | Temp base |
| `join`, `resolve` | `node:path` | Paths |

### Constants / tables / signatures

```js
const VW = 390;
const PROFILE = mkdtempSync(join(tmpdir(), 'pcrm-allov-'));
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ...';

const IDS = {
  party: '988e469c-61ba-496e-9437-fca15480c422',
  credit: '014f6ae9-52b2-4836-b0d6-a3477feb7e5b',
  model: 'd97c224e-0fad-4391-a613-aa5c05fc145c',
  kyc: '49c22bb5-c4e5-4eda-ac64-5840122dd585',
  document: 'd319bc1d-9b38-48aa-a6f7-c0315146946c',
  interaction: 'c2798bd3-cfde-4390-8876-ec320673673f',
  task: '5491fe4a-5d32-4d27-a94f-2f98089c49f8',
};

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
];
// → 23 routes total
```

**Functions:**

```js
async function waitForCSS(p)
// waitForFunction: all link[rel=stylesheet] have sheet !== null; timeout 12000; then wait(200)

async function triggerReveals(p)
// vertical scroll-step 600px to trigger lazy/reveal animations; force opacity/transform/filter on opacity:0 inline styles

async function measure(p)
// page.evaluate(vw): returns { scrollW, overflow, uncontained: bad.slice(0, 6) }
```

**`measure` overflow classification:**

- Document overflow: `scrollW > vw + 1`
- For each element with `right > vw + 0.6` and positive box:
  - Walk ancestors; if any has `overflowX ∈ {auto, hidden, scroll, clip}` → **contained** (OK)
  - Else push to `bad` (**uncontained** page overflow bug)
- Sort `bad` by descending `right`; keep top 6

**Per-route OK condition:**

```js
const ok = status === 200 && !redirLogin && !ov.overflow;
```

### Business purpose

Mobile excellence / QA gate: at **390px** viewport, for every major user-facing CRM surface:

1. Confirm HTTP **200** with mobile UA (cookie for authed routes).
2. Confirm **no document-level horizontal overflow** (`scrollWidth <= viewport`).
3. Distinguish **true page overflow** vs content inside intentional horizontal scroll regions (`overflow-x: auto|hidden|scroll|clip`).

Covers list + detail routes for parties, credit, modeling, compliance (audit/consent/kyc), documents, interactions, tasks, integrations, dashboard, login.

### Key logic

1. Resolve `BASE`; launch mobile Chromium (`VW=390`, height 844, dpr 3, touch).
2. Login with hardcoded credentials; extract `cookieHdr` from `page.cookies()` for fetch checks.
3. For each `[path, label]` in `ROUTES`:
   - **Fetch status:** `fetch(BASE+path, { User-Agent: MOBILE_UA, Cookie? })` with `redirect: 'follow'`; detect login redirect via `/\/login(\?|$)/` on final URL (except path `/login`).
   - **Puppeteer measure:** `goto` → `waitForCSS` → short settle → `triggerReveals` → `measure`.
   - Classify `ok` / `BAD`; log uncontained top-3 samples.
4. Summary: `OK count / total`, overflow count, fetch-fail count; list BAD rows.
5. Close browser; `ALL_OVERFLOW_DONE`.

### Side effects

| Effect | Detail |
|--------|--------|
| Network | Heavy: login + 23× fetch + 23× full page navigations |
| Filesystem | Temp profile `pcrm-allov-*` |
| DOM | Scrolls each page; forces reveal styles on opacity-0 nodes (in-memory only, not persisted to server) |
| Console | Per-route OK/BAD lines + SUMMARY |
| Auth | Real session; cookies reused for Node `fetch` |

**Does not:** write screenshots (unlike `mobile-pass.mjs`).

### Security / RBAC

| Issue | Severity | Notes |
|-------|----------|-------|
| **Hardcoded credentials** | **Critical** | Same plaintext login |
| **Hardcoded entity UUIDs** | Medium | Real (or seed) IDs for party/credit/model/kyc/document/interaction/task — environment-specific; may 404 or expose IDs in repo |
| **Session cookie reuse in fetch** | Low–Medium | Cookie header logged only indirectly; still moves session tokens into Node process memory |
| **No RBAC matrix** | Medium | Single user probes all modules; does not verify per-role denial |
| **`--no-sandbox`** | Medium (local) | Standard for these scripts |

### Coupling

- **Product route map** embedded as `ROUTES` — must stay in sync with app router.
- **Seed/dev data IDs** in `IDS` — break when DB reset / different environments.
- Shared helpers pattern with `mobile-pass.mjs` (`waitForCSS`, `triggerReveals`, overflow thresholds `+0.6` / `+1`).
- Depends on app CSS load via `<link rel="stylesheet">` sheets (Next may use other loading strategies).
- Node global `fetch` (Node 18+).

### Risks / TODOs

- Credentials + stable UUIDs in source control.
- `status === 200` compared after `String`/number mix in summary filter:  
  `rows.filter((r)=>r.status!=='200'&&!r.ok)` uses **string** `'200'` while `status` is often **number** `200` → fetch-fail count can be wrong.
- `ok` ignores `uncontained` if `scrollW` is fine but uncontained elements exist (or vice versa: only `ov.overflow` from scrollWidth). Uncontained list is informational only when `overflow` true-ish; actually uncontained can exist while `scrollW <= vw` is rare but possible with fixed/sticky quirks — classification is scrollWidth-primary.
- Full DOM scans on 23 pages are slow.
- IDs may 404 → still measures error UI overflow; status may not be 200.
- No `process.exit` non-zero on BAD (CI may not fail).
- Temp profiles not cleaned.
- `triggerReveals` mutates inline styles; screenshots not taken here, but measurements can diverge from production animation timing.
- Login route is still measured after global login (session exists); fine for overflow, but not an unauthenticated login-page test.

---

## 4. `scripts/mobile-pass.mjs`

| Field | Value |
|-------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/scripts/mobile-pass.mjs` |
| **Lines** | 224 |
| **Module type** | ES module top-level await (`.mjs`) |
| **Role** | **Mobile excellence pass**: screenshots + overflow culprits + mobile-UA 200 checks for a fixed STEP 3/4 route set |

### Exports

None. CLI entrypoint only.

### Imports

| Symbol | From | Purpose |
|--------|------|---------|
| `puppeteer` (default) | `puppeteer-core` | Automation + screenshots |
| `mkdirSync`, `mkdtempSync`, `readFileSync` | `node:fs` | Ensure screenshot dir; temp profile; env |
| `tmpdir` | `node:os` | Temp base |
| `join`, `resolve` | `node:path` | Paths |

### Constants / tables / signatures

```js
const BASE = (AUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
const OUT = '/home/Jashmhta/crm/screenshots';  // absolute, outside app/
const EXE = '/usr/bin/chromium-browser';
const VW = 390;
const CREDIT_ID = '014f6ae9-52b2-4836-b0d6-a3477feb7e5b';
const LOGIN_EMAIL = 'shray@binarycapital.in';
const LOGIN_PASSWORD = 'BinaryCapital@2026';

// ROUTES: [name, path, authed]
const ROUTES = [
  ['00-login-mobile', '/login', false],
  ['01-dashboard-mobile', '/', true],
  ['02-parties-mobile', '/parties', true],
  ['04-deals-mobile', '/deals', true],
  ['05-credit-workspace-mobile', `/credit/${CREDIT_ID}/workspace`, true],
  ['07-bond-calculator-mobile', '/modeling/bond-calculator', true],
  ['08-compliance-kyc-mobile', '/compliance/kyc', true],
  ['09-compliance-audit-mobile', '/compliance/audit', true],
  ['10-integrations-mobile', '/integrations', true],
];
// Note: naming skips 03, 06 — intentional gap for a larger screenshot numbering scheme
```

**Functions:**

```js
async function setTheme(p, theme)
// localStorage.theme = t; toggle html.dark; html.style.colorScheme = t

async function waitForCSS(p)
// same stylesheet sheet-ready wait as mobile-overflow-all (timeout 12000)

async function triggerReveals(p)
// scroll-step reveal + force opacity:0 nodes visible; wait(550)

async function measureOverflow(p)
// returns { scrollW, docW, bodyW, viewportW, overflow, culprits: uniq top 12 by width }
// culprit: element with right > vw + 0.6; no ancestor-containment filter (unlike mobile-overflow-all)
```

### Business purpose

Execute a defined **mobile QA pass** (comments reference STEP 3 screenshots, STEP 4 curl-equivalent fetch):

1. Capture **390×844** PNGs for a curated route set (login + 8 authed surfaces).
2. Measure horizontal overflow and log **culprit** elements (wider/past-right of viewport).
3. After shots, run **mobile-UA `fetch` 200 checks** with session cookie for authed routes.
4. Drive `AUTH_URL` host so next-auth cookie domain matches proxy redirects (cross-ref `scripts/screenshot.mjs`).

### Key logic

1. Ensure `OUT` dir exists (`mkdirSync` recursive).
2. Launch mobile Chromium; temp profile `pcrm-mob-*`; extra arg `--force-color-profile=srgb` for color-stable shots.
3. **Login screenshot (unauthed):**
   - `setTheme(page, 'dark')`
   - `goto /login`, `reload` (theme localStorage apply), CSS wait, reveals
   - `measureOverflow` → screenshot `00-login-mobile.png` (`fullPage: false`)
4. **Authenticate** via form using `LOGIN_EMAIL` / `LOGIN_PASSWORD`; wait for leave-login; log post-login URL.
5. `setTheme(page, 'dark')` again; extract `cookieHeader`.
6. **For each authed route** (`ROUTES.slice(1)`):
   - `goto`; capture HTTP status from Puppeteer response
   - CSS + reveals + overflow measure
   - Screenshot `${OUT}/${name}.png` with `fullPage: true`, `captureBeyondViewport: true`
   - Push result row
7. **Fetch 200 checks** over all `ROUTES` (login unauthed; others with Cookie + MOBILE_UA).
8. Summary: OVERFLOW vs ok per shot; `fetchOk` count; `MOBILE_PASS_DONE`.

### Side effects

| Effect | Detail |
|--------|--------|
| **Filesystem writes** | PNGs under `/home/Jashmhta/crm/screenshots/*.png` (absolute machine-specific path) |
| Network | Login + N navigations + N fetches |
| localStorage | Sets `theme` to `dark` in browser profile |
| DOM | Scroll + force-reveal styles |
| Console | shot lines, fetch OK/BAD, overflow summary |
| Temp profile | `pcrm-mob-*` under tmpdir |

### Security / RBAC

| Issue | Severity | Notes |
|-------|----------|-------|
| **Hardcoded credentials as named constants** | **Critical** | `LOGIN_EMAIL`, `LOGIN_PASSWORD` clearly committed |
| **Hardcoded `CREDIT_ID`** | Medium | Environment-bound UUID for credit workspace |
| **Screenshot dir outside repo** | Low | Absolute path `/home/Jashmhta/crm/screenshots` — machine-specific; may fail elsewhere |
| **Cookie header in memory** | Low–Medium | Used for fetch; not written to disk |
| **No RBAC coverage** | Medium | Single privileged user |
| **`--no-sandbox`** | Medium (local) | Same pattern |

### Coupling

- **`scripts/screenshot.mjs`** (referenced for AUTH_URL/proxy cookie rationale) — conceptual sibling.
- **Route/task numbering** (`00`…`10` with gaps) couples to an external checklist/STEP doc.
- **next-themes / dark class** via `setTheme`.
- **Credit workspace** path shape: `/credit/${CREDIT_ID}/workspace`.
- Shared overflow thresholds and CSS-ready wait with `mobile-overflow-all.mjs`.
- Hard dependency on system Chromium path and writable absolute `OUT`.

### Risks / TODOs

- **Secrets in repo** — highest priority; use env vars / secrets manager; rotate password.
- Absolute `OUT` path not portable (CI/other developers will fail or write wrong place); prefer `path.resolve` relative to monorepo.
- `measureOverflow` does **not** filter overflow-clipped ancestors — more false positives than `mobile-overflow-all.mjs` (wide tables inside `overflow-x: auto` still listed as culprits).
- No non-zero exit on overflow or fetch failure.
- Login shot uses `fullPage: false`; authed use `fullPage: true` — inconsistent crop policy.
- Missing routes vs `mobile-overflow-all` (no parties detail, tasks, documents, consent, etc.) — intentional reduced set.
- Route number gaps (03, 06) may confuse if not documented.
- `CREDIT_ID` 404 → still may screenshot error page as “pass” artifact.
- Profile/tmp cleanup absent.
- Parallel run risk: concurrent writes to same screenshot filenames.

---

## Cross-file synthesis (batch-007)

### Shared architecture

All four scripts form a **Puppeteer-core diagnostic/QA toolkit** for Binary CRM UI:

| Script | Viewport | Auth | Primary output | Routes |
|--------|----------|------|----------------|--------|
| `diag-nav.mjs` | Mobile 390 | Form login | Console nav/widest chain | 4 fixed |
| `diag-theme-logo.mjs` | Desktop 1440 | Form login | Console logo + theme flip | `/` |
| `mobile-overflow-all.mjs` | Mobile 390 | Form login | Console OK/BAD matrix | 23 routes |
| `mobile-pass.mjs` | Mobile 390 | Form login | PNGs + console + fetch checks | 9 named |

### Repeated patterns (copy-paste coupling)

1. `AUTH_URL` / `.env.local` bootstrap → `BASE`
2. `EXE = '/usr/bin/chromium-browser'`
3. Launch args: `--no-sandbox --disable-gpu --disable-dev-shm-usage --hide-scrollbars --headless=new`
4. Temp `userDataDir` via `mkdtempSync(join(tmpdir(), 'pcrm-*'))`
5. Identical login sequence + **same hardcoded credentials**
6. Mobile UA iPhone Safari 17 string
7. `wait` helper; settle delays 300–2400ms

**Refactor opportunity:** extract shared `scripts/lib/puppeteer-qa.mjs` (launch, login, waitForCSS, measureOverflow variants, credentials from env).

### Security findings (batch-level)

1. **Critical:** Password `BinaryCapital@2026` and email appear in all 4 files (plaintext). Immediate rotation + remove from history recommended.
2. **Medium:** Production/staging UUIDs and absolute home paths encode environment details.
3. **Medium:** Sandbox-disabled Chromium is acceptable only for trusted local QA.
4. None of these scripts implement or test **RBAC**; they only verify that one superuser-like account can render mobile layouts.

### Dependency graph (external)

```
scripts/* (this batch)
  → puppeteer-core
  → /usr/bin/chromium-browser
  → running Next.js app at BASE (AUTH_URL)
  → .env.local (optional AUTH_URL)
  → (mobile-pass only) /home/Jashmhta/crm/screenshots
  → app DOM contracts: login form, SiteNav aria-label, theme toggle aria-label, dark class
```

### Not production runtime

These are **developer/CI QA tools**, not imported by the Next.js app bundle. They do not define API routes, DB tables, or business domain models. Business domain contact is **indirect** (route inventory of parties, deals, credit, modeling, compliance, documents, interactions, tasks, integrations).

### Suggested follow-ups (non-binding)

- [ ] Extract shared login/launch helpers; env-based credentials
- [ ] `process.exitCode = 1` on overflow/BAD for CI gates
- [ ] Cleanup temp profiles in `finally`
- [ ] Align overflow algorithms (contained vs uncontained) between `mobile-pass` and `mobile-overflow-all`
- [ ] Portable screenshot output path
- [ ] Fix `status !== '200'` type bug in `mobile-overflow-all` summary

---

## Inventory checklist

| # | Path | Lines | Analyzed |
|---|------|-------|----------|
| 1 | `scripts/diag-nav.mjs` | 97 | Yes |
| 2 | `scripts/diag-theme-logo.mjs` | 61 | Yes |
| 3 | `scripts/mobile-overflow-all.mjs` | 132 | Yes |
| 4 | `scripts/mobile-pass.mjs` | 224 | Yes |

**Total lines in batch:** 514  
**Docs ignored:** none present in list  
**Output written:** `/home/Jashmhta/crm/bc-crm/analysis/file-by-file/agent-007.md`
