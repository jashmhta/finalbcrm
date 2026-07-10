// Step 5 verification: log in, extract the session cookie, then fetch every
// user-facing route (authed) and confirm 200 + real content (not redirected to
// /login, not a thin/empty/404). Also confirms the real BC logo renders in nav
// + login + favicon, and the theme toggle is present. Uses the AUTH_URL host
// so the session cookie domain matches (see scripts/screenshot.mjs for why).
import puppeteer from 'puppeteer-core';
import { mkdtempSync, readFileSync } from 'node:fs';
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
  } catch {}
}
const BASE = (AUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
const EXE = '/usr/bin/chromium-browser';
const PROFILE = mkdtempSync(join(tmpdir(), 'pcrm-vrfy-'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const LOGIN_EMAIL = 'shray@binarycapital.in';
const LOGIN_PASSWORD = 'BinaryCapital@2026';

// Valid UUIDs from the current seed.
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

const browser = await puppeteer.launch({
  executablePath: EXE, headless: 'new', userDataDir: PROFILE,
  args: ['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--hide-scrollbars','--headless=new'],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  protocolTimeout: 60000,
});
const page = await browser.newPage();
page.setDefaultTimeout(30000);

// 1) Login (on AUTH_URL host so the cookie domain matches redirects).
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('input[type="password"]', { timeout: 15000 });
await page.type('input[name="email"], input[type="email"], input[autocomplete="email"]', LOGIN_EMAIL);
await page.type('input[type="password"]', LOGIN_PASSWORD);
await page.click('button[type="submit"]');
for (let i = 0; i < 40; i++) { if (!page.url().includes('/login')) break; await wait(500); }
await wait(2000);
const authedUrl = page.url();
console.log(`AUTHED: ${authedUrl}`);
const authed = !authedUrl.includes('/login');

// 2) Extract cookies for fetch-based route checks.
const cookies = await page.cookies();
const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
const hasSession = cookies.some((c) => /session/i.test(c.name));
console.log(`session cookie present: ${hasSession} (${cookies.length} cookies)`);

// 3) Logo checks via fetch (authed for /logo.png; unauthed for favicon + login HTML).
async function fetchHead(path, withCookie = true) {
  const res = await fetch(`${BASE}${path}`, {
    headers: withCookie ? { Cookie: cookieHeader } : {},
    redirect: 'follow',
  });
  return { status: res.status, url: res.url, ctype: res.headers.get('content-type') || '' };
}
console.log('\n=== LOGO / FAVICON ===');
const favUnauthed = await fetchHead('/favicon.ico', false);
console.log(`/favicon.ico (unauthed): ${favUnauthed.status} ${favUnauthed.ctype}`);
const logoAuthed = await fetchHead('/logo.png', true);
console.log(`/logo.png (authed): ${logoAuthed.status} ${logoAuthed.ctype}`);
// favicon is excluded from the proxy matcher, so it should serve unauthed:
const favBytes = await (await fetch(`${BASE}/favicon.ico`, { headers: {} })).arrayBuffer();
console.log(`favicon bytes: ${favBytes.byteLength}`);
const logoBytes = await (await fetch(`${BASE}/logo.png`, { headers: { Cookie: cookieHeader } })).arrayBuffer();
console.log(`logo bytes (authed): ${logoBytes.byteLength}`);

// 4) Check the LOGIN page HTML (unauthed) contains the brand logo <img> and the
//    nav theme toggle. The logo is a static import → rendered as /_next/static/media/*.png.
const loginRes = await fetch(`${BASE}/login`, { headers: {}, redirect: 'follow' });
const loginHtml = await loginRes.text();
const loginHasLogoImg = /<img[^>]+src="[^"]*\/_next\/static\/media\/[^"]+\.png"/.test(loginHtml);
console.log(`login HTML has brand logo <img>: ${loginHasLogoImg}`);

// 5) Check the nav (on an authed page) for the logo + theme toggle button.
let navInfo = { logoImg: false, themeToggle: false };
if (authed) {
  await page.goto(`${BASE}/parties`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await wait(1500);
  navInfo = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    const logoImg = imgs.some((i) => /\/_next\/static\/media\/[^]+\.png/.test(i.src || '') && i.closest('nav,header,[class*="nav"]'));
    // theme toggle: a button that mentions sun/moon or has an aria-label with theme
    const buttons = Array.from(document.querySelectorAll('button'));
    const themeToggle = buttons.some((b) => {
      const t = (b.getAttribute('aria-label') || '') + ' ' + b.textContent + ' ' + (b.title || '');
      return /theme|sun|moon|light|dark/i.test(t);
    });
    return { logoImg, themeToggle };
  });
}
console.log(`nav has brand logo <img>: ${navInfo.logoImg} | theme toggle present: ${navInfo.themeToggle}`);

// 6) Verify the theme toggle actually flips the html.dark class (dark↔light).
let toggleWorks = false;
if (authed && navInfo.themeToggle) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await wait(1200);
  toggleWorks = await page.evaluate(() => {
    const html = document.documentElement;
    const before = html.classList.contains('dark');
    const btns = Array.from(document.querySelectorAll('button'));
    const toggle = btns.find((b) => {
      const t = (b.getAttribute('aria-label') || '') + ' ' + b.textContent + ' ' + (b.title || '');
      return /theme|sun|moon|light|dark/i.test(t);
    });
    if (!toggle) return false;
    toggle.click();
    const after = html.classList.contains('dark');
    // click back to restore
    toggle.click();
    return before !== after;
  });
}
console.log(`theme toggle flips dark class: ${toggleWorks}`);

// 7) Fetch every route (authed) and check 200 + real content.
console.log('\n=== ROUTES (authed) ===');
const rows = [];
for (const [path, label] of ROUTES) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Cookie: cookieHeader }, redirect: 'follow',
    });
    const finalUrl = res.url;
    const status = res.status;
    const text = await res.text();
    const len = text.length;
    const redirectedToLogin = /\/login(\?|$)/.test(finalUrl) && path !== '/login';
    const hasNaN = /NaN/.test(text);
    const hasUndefined = /\bundefined\b/.test(text);
    const thin = len < 1500;
    const ok = status === 200 && !redirectedToLogin && !thin;
    rows.push({ label, path, status, len, redirectedToLogin, hasNaN, hasUndefined, thin, ok });
    console.log(`${ok ? 'OK ' : 'BAD'} ${label.padEnd(20)} ${String(status).padEnd(4)} len=${String(len).padEnd(7)} redirLogin=${redirectedToLogin} nan=${hasNaN} undef=${hasUndefined} thin=${thin}`);
  } catch (e) {
    rows.push({ label, path, status: 'ERR', len: 0, redirectedToLogin: false, hasNaN: false, hasUndefined: false, thin: true, ok: false });
    console.log(`ERR ${label.padEnd(20)} ${e.message}`);
  }
}

const okCount = rows.filter((r) => r.ok).length;
console.log(`\n=== SUMMARY: ${okCount}/${rows.length} routes OK ===`);
const bad = rows.filter((r) => !r.ok);
if (bad.length) { console.log('BAD ROUTES:'); for (const r of bad) console.log(`  ${r.label}: status=${r.status} len=${r.len} redirLogin=${r.redirectedToLogin} nan=${r.hasNaN} undef=${r.hasUndefined} thin=${r.thin}`); }

console.log(`\nVERDICT: authed=${authed} session=${hasSession} favicon=${favUnauthed.status} logoAuthed=${logoAuthed.status} loginLogoImg=${loginHasLogoImg} navLogoImg=${navInfo.logoImg} themeToggle=${navInfo.themeToggle} toggleWorks=${toggleWorks} routesOk=${okCount}/${rows.length}`);

await browser.close();
console.log('VERIFY_DONE');
