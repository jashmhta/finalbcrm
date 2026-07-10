// All-routes mobile overflow audit: every user-facing route at 390px, confirm
// 200 + no document-level horizontal overflow (scrollWidth <= viewport), and
// for any element whose right edge exceeds the viewport, report whether it is
// INSIDE an overflow-clipped (overflow-x:auto/hidden/scroll) ancestor — i.e. a
// contained scrollable region (fine) vs a true page overflow (bug).
import puppeteer from 'puppeteer-core';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let AUTH_URL = process.env.AUTH_URL;
if (!AUTH_URL) {
  try {
    const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of env.split('\n')) { const m = /^AUTH_URL=(.+)$/.exec(line.trim()); if (m) { AUTH_URL = m[1].trim(); break; } }
  } catch {}
}
const BASE = (AUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
const EXE = '/usr/bin/chromium-browser';
const VW = 390;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PROFILE = mkdtempSync(join(tmpdir(), 'pcrm-allov-'));
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

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
  ['/', 'dashboard'], ['/parties', 'parties'], [`/parties/${IDS.party}`, 'party-detail'],
  ['/deals', 'deals'], ['/credit', 'credit-list'], [`/credit/${IDS.credit}`, 'credit-detail'],
  [`/credit/${IDS.credit}/workspace`, 'credit-workspace'], ['/credit/new', 'credit-new'],
  ['/modeling', 'modeling'], [`/modeling/${IDS.model}`, 'modeling-detail'],
  ['/modeling/bond-calculator', 'bond-calculator'], ['/compliance/audit', 'audit'],
  ['/compliance/consent', 'consent'], ['/compliance/kyc', 'kyc'], [`/compliance/kyc/${IDS.kyc}`, 'kyc-detail'],
  ['/documents', 'documents'], [`/documents/${IDS.document}`, 'document-detail'],
  ['/interactions', 'interactions'], [`/interactions/${IDS.interaction}`, 'interaction-detail'],
  ['/tasks', 'tasks'], [`/tasks/${IDS.task}`, 'task-detail'], ['/integrations', 'integrations'],
  ['/login', 'login'],
];

const browser = await puppeteer.launch({
  executablePath: EXE, headless: 'new', userDataDir: PROFILE,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars', '--headless=new'],
  defaultViewport: { width: VW, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  protocolTimeout: 60000,
});
const page = await browser.newPage();
page.setDefaultTimeout(25000);
await page.setUserAgent(MOBILE_UA);

async function waitForCSS(p) {
  try { await p.waitForFunction(() => { const l = Array.from(document.querySelectorAll('link[rel="stylesheet"]')); return l.length > 0 && l.every((x) => x.sheet !== null); }, { timeout: 12000 }); } catch {}
  await wait(200);
}
async function triggerReveals(p) {
  try {
    await p.evaluate(async () => { await new Promise((resolve) => { let y = 0; const s = () => { window.scrollBy(0, 600); y += 600; if (y < document.body.scrollHeight + 600) setTimeout(s, 50); else { window.scrollTo(0, 0); resolve(); } }; s(); }); });
    await p.evaluate(() => { document.querySelectorAll('[style*="opacity: 0"], [style*="opacity:0"]').forEach((el) => { el.style.opacity = '1'; el.style.transform = 'none'; el.style.filter = 'none'; }); });
  } catch {}
  await wait(450);
}

// login (skip if login route itself)
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 25000 });
await page.waitForSelector('input[type="password"]', { timeout: 15000 });
await page.type('input[name="email"], input[type="email"], input[autocomplete="email"]', 'shray@binarycapital.in');
await page.type('input[type="password"]', 'BinaryCapital@2026');
await page.click('button[type="submit"]');
for (let i = 0; i < 40; i++) { if (!page.url().includes('/login')) break; await wait(500); }
await wait(2000);
const cookieHdr = (await page.cookies()).map((c) => `${c.name}=${c.value}`).join('; ');

async function measure(p) {
  return p.evaluate((vw) => {
    const scrollW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const bad = []; // elements past viewport that are NOT inside an overflow-clipped ancestor
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.right <= vw + 0.6 || r.width <= 0 || r.height <= 0) continue;
      // walk ancestors: is any of them overflow-x clipped (auto/hidden/scroll) AND wide enough to contain?
      let contained = false;
      let cur = el.parentElement;
      while (cur) {
        const ox = getComputedStyle(cur).overflowX;
        if (ox === 'auto' || ox === 'hidden' || ox === 'scroll' || ox === 'clip') { contained = true; break; }
        cur = cur.parentElement;
      }
      if (!contained) {
        bad.push({ tag: el.tagName.toLowerCase(), cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 60) : '', right: Math.round(r.right), width: Math.round(r.width) });
      }
    }
    bad.sort((a, b) => b.right - a.right);
    return { scrollW, overflow: scrollW > vw + 1, uncontained: bad.slice(0, 6) };
  }, VW);
}

const rows = [];
for (const [path, label] of ROUTES) {
  const authed = path !== '/login';
  // fetch 200 check with mobile UA
  let status = 'ERR', redirLogin = false;
  try {
    const res = await fetch(`${BASE}${path}`, { headers: Object.assign({ 'User-Agent': MOBILE_UA }, authed ? { Cookie: cookieHdr } : {}), redirect: 'follow' });
    status = res.status; redirLogin = /\/login(\?|$)/.test(res.url) && path !== '/login';
  } catch (e) { status = 'ERR'; }
  // puppeteer overflow measure
  let ov = { scrollW: 0, overflow: true, uncontained: [] };
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await waitForCSS(page); await wait(300); await triggerReveals(page);
    ov = await measure(page);
  } catch (e) { ov = { scrollW: 0, overflow: true, uncontained: [{ tag: 'ERR', cls: e.message, right: 0, width: 0 }] }; }
  const ok = status === 200 && !redirLogin && !ov.overflow;
  rows.push({ label, path, status, redirLogin, scrollW: ov.scrollW, overflow: ov.overflow, uncontained: ov.uncontained, ok });
  console.log(`${ok ? 'OK ' : 'BAD'} ${label.padEnd(18)} ${String(status).padEnd(4)} scrollW=${String(ov.scrollW).padEnd(4)} overflow=${ov.overflow} redirLogin=${redirLogin} uncontained=${ov.uncontained.length}`);
  if (ov.uncontained.length) for (const u of ov.uncontained.slice(0, 3)) console.log(`      uncontained: <${u.tag}> right=${u.right} width=${u.width} .${u.cls}`);
}

const okCount = rows.filter((r) => r.ok).length;
const overflowCount = rows.filter((r) => r.overflow).length;
console.log(`\nSUMMARY: ${okCount}/${rows.length} routes OK | ${overflowCount} overflowing | fetch-fail=${rows.filter((r)=>r.status!=='200'&&!r.ok).length}`);
const bad = rows.filter((r) => !r.ok);
if (bad.length) { console.log('BAD:'); for (const r of bad) console.log(`  ${r.label}: status=${r.status} scrollW=${r.scrollW} overflow=${r.overflow} redirLogin=${r.redirLogin}`); }
await browser.close();
console.log('ALL_OVERFLOW_DONE');
