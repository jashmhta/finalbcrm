// Mobile excellence pass: capture 390x844 screenshots for the required route
// set AND measure horizontal overflow (document.scrollWidth vs viewport) + flag
// elements wider than 390px. Logs in first via the form, driving the AUTH_URL
// host so the next-auth session cookie domain matches the proxy redirects
// (see scripts/screenshot.mjs for the rationale).
import puppeteer from 'puppeteer-core';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let AUTH_URL = process.env.AUTH_URL;
if (!AUTH_URL) {
  try {
    const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of env.split('\n')) {
      const m = /^AUTH_URL=(.+)$/.exec(line.trim());
      if (m) { AUTH_URL = m[1].trim(); break; }
    }
  } catch { /* ignore */ }
}
const BASE = (AUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
const OUT = '/home/Jashmhta/crm/screenshots';
const EXE = '/usr/bin/chromium-browser';
const VW = 390;
mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PROFILE = mkdtempSync(join(tmpdir(), 'pcrm-mob-'));

const CREDIT_ID = '014f6ae9-52b2-4836-b0d6-a3477feb7e5b';
const LOGIN_EMAIL = 'shray@binarycapital.in';
const LOGIN_PASSWORD = 'BinaryCapital@2026';

// Required mobile route set (STEP 3). Names end in -mobile.png per the task.
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

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const browser = await puppeteer.launch({
  executablePath: EXE, headless: 'new',
  userDataDir: PROFILE,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars', '--force-color-profile=srgb', '--headless=new'],
  defaultViewport: { width: VW, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  protocolTimeout: 60000,
});
const page = await browser.newPage();
page.setDefaultTimeout(25000);
await page.setUserAgent(MOBILE_UA);

async function setTheme(p, theme) {
  await p.evaluate((t) => {
    try { localStorage.setItem('theme', t); } catch {}
    const html = document.documentElement;
    if (t === 'dark') html.classList.add('dark');
    else html.classList.remove('dark');
    html.style.colorScheme = t;
  }, theme);
}

// Wait for all <link rel=stylesheet> to actually be adopted (sheet !== null),
// so overflow is measured against the fully-styled layout, not a pre-CSS frame.
async function waitForCSS(p) {
  try {
    await p.waitForFunction(
      () => {
        const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
        return links.length > 0 && links.every((l) => l.sheet !== null);
      },
      { timeout: 12000 },
    );
  } catch { /* fall through; measure anyway */ }
  await wait(200);
}

async function triggerReveals(p) {
  try {
    await p.evaluate(async () => {
      await new Promise((resolve) => {
        let y = 0; const step = () => {
          window.scrollBy(0, 600); y += 600;
          if (y < document.body.scrollHeight + 600) { setTimeout(step, 50); }
          else { window.scrollTo(0, 0); resolve(); }
        };
        step();
      });
    });
    await p.evaluate(() => {
      document.querySelectorAll('[style*="opacity: 0"], [style*="opacity:0"]').forEach((el) => {
        el.style.opacity = '1'; el.style.transform = 'none'; el.style.filter = 'none';
      });
    });
  } catch {}
  await wait(550);
}

// Measure horizontal overflow. Returns scrollWidth, viewport width, and the
// top few elements whose right edge extends past the viewport (overflow culprits).
async function measureOverflow(p) {
  return p.evaluate((vw) => {
    const docW = document.documentElement.scrollWidth;
    const bodyW = document.body.scrollWidth;
    const scrollW = Math.max(docW, bodyW);
    const culprits = [];
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      // elements whose right edge is past the viewport (ignoring tiny sub-pixel)
      if (r.right > vw + 0.6) {
        const tag = el.tagName.toLowerCase();
        const cls = (el.className && typeof el.className === 'string') ? el.className.slice(0, 70) : '';
        culprits.push({ tag, cls, left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) });
      }
    }
    // de-dup by signature, take widest 12
    const seen = new Set(); const uniq = [];
    for (const c of culprits.sort((a, b) => b.width - a.width)) {
      const k = c.tag + '|' + c.cls + '|' + c.right;
      if (seen.has(k)) continue; seen.add(k); uniq.push(c);
      if (uniq.length >= 12) break;
    }
    return { scrollW, docW, bodyW, viewportW: vw, overflow: scrollW > vw + 1, culprits: uniq };
  }, VW);
}

const results = [];

// 1) Login capture first (unauthed). Set dark theme on /login before reload.
await setTheme(page, 'dark');
try {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 25000 });
  await waitForCSS(page);
  await wait(300);
  await triggerReveals(page);
  const ov = await measureOverflow(page);
  await page.screenshot({ path: `${OUT}/00-login-mobile.png`, fullPage: false, captureBeyondViewport: false });
  results.push({ name: '00-login-mobile', path: '/login', status: 200, overflow: ov.overflow, scrollW: ov.scrollW, culprits: ov.culprits });
  console.log(`shot 00-login-mobile overflow=${ov.overflow} scrollW=${ov.scrollW}`);
} catch (e) { console.log('login-shot err', e.message); results.push({ name: '00-login-mobile', path: '/login', status: 'ERR', overflow: true, scrollW: 0, culprits: [], err: e.message }); }

// 2) Authenticate via form on the AUTH_URL host (cookie domain matches proxy).
try {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForSelector('input[type="password"]', { timeout: 15000 });
  await page.type('input[name="email"], input[type="email"], input[autocomplete="email"]', LOGIN_EMAIL);
  await page.type('input[type="password"]', LOGIN_PASSWORD);
  await page.click('button[type="submit"]');
  for (let i = 0; i < 40; i++) { if (!page.url().includes('/login')) break; await wait(500); }
  await wait(2400);
  console.log('post-login url:', page.url());
} catch (e) { console.log('login-flow err', e.message); }
await setTheme(page, 'dark');

// Extract cookies for the curl/fetch mobile-UA 200 checks.
const cookies = await page.cookies();
const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

// 3) Capture + measure each authed route.
for (const [name, path, authed] of ROUTES.slice(1)) {
  let status = 'ERR';
  try {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    status = res ? res.status() : 'ERR';
  } catch (e) { console.log('goto err', name, e.message); results.push({ name, path, status: 'ERR', overflow: true, scrollW: 0, culprits: [], err: e.message }); continue; }
  await waitForCSS(page);
  await wait(400);
  await triggerReveals(page);
  const ov = await measureOverflow(page);
  try { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true, captureBeyondViewport: true }); }
  catch (e) { console.log('shot err', name, e.message); }
  results.push({ name, path, status, overflow: ov.overflow, scrollW: ov.scrollW, culprits: ov.culprits });
  console.log(`shot ${name} status=${status} overflow=${ov.overflow} scrollW=${ov.scrollW}${ov.culprits.length ? ' culprits=' + ov.culprits.length : ''}`);
}

await browser.close();

// 4) Mobile-UA fetch 200 checks (STEP 4 curl equivalent) — authed routes get
//    the session cookie; /login is fetched unauthed. Uses the mobile UA string.
console.log('\n=== MOBILE-UA FETCH 200 CHECKS ===');
const fetchRows = [];
for (const [name, path, authed] of ROUTES) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: Object.assign({ 'User-Agent': MOBILE_UA }, authed ? { Cookie: cookieHeader } : {}),
      redirect: 'follow',
    });
    const finalUrl = res.url;
    const status = res.status;
    const redirectedToLogin = /\/login(\?|$)/.test(finalUrl) && path !== '/login';
    const ok = status === 200 && !redirectedToLogin;
    fetchRows.push({ name, path, status, ok, redirectedToLogin });
    console.log(`${ok ? 'OK ' : 'BAD'} ${name.padEnd(28)} ${String(status).padEnd(4)} redirLogin=${redirectedToLogin}`);
  } catch (e) {
    fetchRows.push({ name, path, status: 'ERR', ok: false, redirectedToLogin: false, err: e.message });
    console.log(`ERR ${name.padEnd(28)} ${e.message}`);
  }
}

// 5) Summary report.
console.log('\n=== OVERFLOW + SHOT SUMMARY ===');
let overflowCount = 0;
for (const r of results) {
  const flag = r.overflow ? 'OVERFLOW' : 'ok      ';
  if (r.overflow) overflowCount++;
  console.log(`${flag} ${r.name.padEnd(28)} scrollW=${String(r.scrollW).padEnd(5)} status=${r.status}`);
  if (r.overflow && r.culprits && r.culprits.length) {
    for (const c of r.culprits.slice(0, 5)) console.log(`         culprit: <${c.tag}> right=${c.right} width=${c.width} .${c.cls}`);
  }
}
const fetchOk = fetchRows.filter((r) => r.ok).length;
console.log(`\nSUMMARY: shots=${results.length} overflow=${overflowCount} fetchOk=${fetchOk}/${fetchRows.length}`);
console.log('MOBILE_PASS_DONE');
