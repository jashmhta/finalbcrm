import puppeteer from 'puppeteer-core';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// next-auth (AUTH_URL) redirects + sets its session cookie for the AUTH_URL
// host. If puppeteer drives localhost while AUTH_URL is the box's public IP,
// the cookie set on localhost is not sent to the public-IP redirect target and
// the proxy bounces every authed route back to /login. So drive the SAME origin
// AUTH_URL points at. Read it from .env.local (fallback localhost).
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
mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PROFILE = mkdtempSync(join(tmpdir(), 'pcrm-shot-'));

// Valid UUIDs from the CURRENT seed (seed.ts uses gen_random_uuid(), so these
// change every reseed — re-derive from the DB if you reseed again).
//   party 988e469c… = "Satpuda Power 214" — 2 deals, 4 relationships, credit
//                     analysis 014f6ae9 (P1, 3 financial statements, 7 scores).
//   credit 014f6ae9… = that party's credit_analysis — 3 fs w/ 6–7 ratios each,
//                     1 scorecard, 7 credit scores. Used for workspace + detail
//                     so the party→credit→workspace flow is coherent.
const PARTY_ID = '988e469c-61ba-496e-9437-fca15480c422';
const CREDIT_ID = '014f6ae9-52b2-4836-b0d6-a3477feb7e5b';
const LOGIN_EMAIL = 'shray@binarycapital.in';
const LOGIN_PASSWORD = 'BinaryCapital@2026'; // set by src/db/seed-admin.ts

const browser = await puppeteer.launch({
  executablePath: EXE, headless: 'new',
  userDataDir: PROFILE,
  // --run-all-compositor-stages-before-draw was removed — in headless=new it
  // deadlocks Page.captureScreenshot on GPU-heavy pages. Other flags preserve
  // sRGB color and stable rendering. Screenshots capture full fidelity at DPR 2.
  args: ['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--hide-scrollbars','--force-color-profile=srgb','--headless=new'],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  protocolTimeout: 60000,
});
const page = await browser.newPage();
page.setDefaultTimeout(20000);

async function triggerReveals(p) {
  try {
    await p.evaluate(async () => {
      await new Promise((resolve) => {
        let y = 0; const step = () => {
          window.scrollBy(0, 700); y += 700;
          if (y < document.body.scrollHeight + 700) { setTimeout(step, 60); }
          else { window.scrollTo(0, 0); resolve(); }
        };
        step();
      });
    });
    // Force any framer-motion whileInView elements still at opacity:0 visible.
    await p.evaluate(() => {
      document.querySelectorAll('[style*="opacity: 0"], [style*="opacity:0"]').forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'none';
        el.style.filter = 'none';
      });
    });
  } catch {}
  await wait(600);
}

// Force a theme via next-themes' localStorage key ('theme') + the `dark` class
// on <html>. Setting localStorage before (re)navigation makes next-themes'
// pre-hydration inline script apply the theme before first paint. The class
// toggle is a belt-and-suspenders fallback for same-document captures.
async function setTheme(p, theme) {
  await p.evaluate((t) => {
    try { localStorage.setItem('theme', t); } catch {}
    const html = document.documentElement;
    if (t === 'dark') html.classList.add('dark');
    else html.classList.remove('dark');
    html.style.colorScheme = t;
  }, theme);
}

async function cap(p, path, name, fullPage = true) {
  try { await p.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 }); }
  catch (e) { console.log('goto err', name, e.message); }
  await wait(1500);
  await triggerReveals(p);
  try { await p.screenshot({ path: `${OUT}/${name}.png`, fullPage, captureBeyondViewport: fullPage }); console.log('shot', name); }
  catch (e) { console.log('shot err', name, e.message); }
}

// 1) UNAUTHED login — DARK. Establish localStorage.theme='dark' on /login,
//    reload so next-themes applies dark before paint, then capture.
try {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await setTheme(page, 'dark');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
  await wait(1500);
  await triggerReveals(page);
  await page.screenshot({ path: `${OUT}/00-login.png`, fullPage: false, captureBeyondViewport: false });
  console.log('shot 00-login');
} catch (e) { console.log('login-shot err', e.message); }

// 2) AUTHENTICATE via form (localStorage.theme='dark' already set → app is dark).
try {
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.type('input[name="email"], input[type="email"], input[autocomplete="email"]', LOGIN_EMAIL);
  await page.type('input[type="password"]', LOGIN_PASSWORD);
  await page.click('button[type="submit"]');
  for (let i = 0; i < 40; i++) { if (!page.url().includes('/login')) break; await wait(500); }
  await wait(2800);
  console.log('post-login url:', page.url());
} catch (e) { console.log('login-flow err', e.message); }

// Keep dark theme explicit (persist) for all dark authed captures.
await setTheme(page, 'dark');

// 3) AUTHED DARK full-page desktop screens (13) — 00-login already captured.
for (const [name, path] of [
  ['01-dashboard','/'], ['02-parties','/parties'],
  ['03-party-detail',`/parties/${PARTY_ID}`],
  ['04-deals','/deals'],
  ['05-credit-workspace',`/credit/${CREDIT_ID}/workspace`],
  ['06-credit-detail',`/credit/${CREDIT_ID}`],
  ['07-bond-calculator','/modeling/bond-calculator'],
  ['08-compliance-kyc','/compliance/kyc'],
  ['09-compliance-audit','/compliance/audit'],
  ['10-integrations','/integrations'],
  ['11-tasks','/tasks'], ['12-documents','/documents'],
  ['13-interactions','/interactions'],
]) { await cap(page, path, name, true); }

// 4) DARK mobile dashboard (390px) — authed via shared cookies.
try {
  const m = await browser.newPage();
  await m.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true });
  await setTheme(m, 'dark');
  await m.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await wait(1600); await triggerReveals(m);
  await m.screenshot({ path: `${OUT}/14-dashboard-mobile.png`, fullPage: true, captureBeyondViewport: true });
  console.log('shot 14-dashboard-mobile');
  await m.close();
} catch (e) { console.log('mobile-dark err', e.message); }

// 5) LIGHT MODE — 4 authed key screens. Switch the authed page to light once
//    (localStorage persists per origin), then capture each.
await setTheme(page, 'light');
for (const [name, path] of [
  ['01-dashboard-light','/'],
  ['02-parties-light','/parties'],
  ['05-credit-workspace-light',`/credit/${CREDIT_ID}/workspace`],
  ['07-bond-calculator-light','/modeling/bond-calculator'],
]) {
  try { await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 }); }
  catch (e) { console.log('goto err', name, e.message); }
  await wait(1300);
  await setTheme(page, 'light'); // belt-and-suspenders if next-themes lagged
  await wait(900);
  await triggerReveals(page);
  try { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true, captureBeyondViewport: true }); console.log('shot', name); }
  catch (e) { console.log('shot err', name, e.message); }
}

// 6) LIGHT login — clear cookies (become unauthed), keep localStorage.theme='light'.
try {
  const client = await page.target().createCDPSession();
  await client.send('Network.clearBrowserCookies');
} catch (e) { console.log('clear-cookie err', e.message); }
await setTheme(page, 'light');
try { await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 }); }
catch (e) { console.log('goto err 00-login-light', e.message); }
await wait(1500); await setTheme(page, 'light'); await wait(900); await triggerReveals(page);
try { await page.screenshot({ path: `${OUT}/00-login-light.png`, fullPage: false, captureBeyondViewport: false }); console.log('shot 00-login-light'); }
catch (e) { console.log('shot err 00-login-light', e.message); }

// 7) MOBILE (390px) — 5 required screens. Cookies were cleared above, so
//    re-authenticate on a fresh mobile page first.
const mobile = await browser.newPage();
await mobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true });
await setTheme(mobile, 'dark');
try {
  await mobile.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await mobile.waitForSelector('input[type="password"]', { timeout: 10000 });
  await mobile.type('input[name="email"], input[type="email"], input[autocomplete="email"]', LOGIN_EMAIL);
  await mobile.type('input[type="password"]', LOGIN_PASSWORD);
  await mobile.click('button[type="submit"]');
  for (let i = 0; i < 40; i++) { if (!mobile.url().includes('/login')) break; await wait(500); }
  await wait(2200);
  console.log('mobile post-login url:', mobile.url());
} catch (e) { console.log('mobile-login err', e.message); }

for (const [name, path] of [
  ['02-parties-mobile','/parties'],
  ['04-deals-mobile','/deals'],
  ['05-credit-workspace-mobile',`/credit/${CREDIT_ID}/workspace`],
  ['08-compliance-kyc-mobile','/compliance/kyc'],
  ['10-integrations-mobile','/integrations'],
]) { await cap(mobile, path, name, true); }

await browser.close();
console.log('DONE');
