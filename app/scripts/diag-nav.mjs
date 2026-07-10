// Focused diagnostic: on one overflowing page (/deals) and one clean page
// (/parties), report the desktop nav container's computed display, a sample
// desktop nav link's computed display + rect, and the single widest element
// (max right edge) with its ancestor chain. Tells us WHY scrollWidth=638 on
// deals but 390 on parties despite the same SiteNav component.
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PROFILE = mkdtempSync(join(tmpdir(), 'pcrm-diag-'));
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const browser = await puppeteer.launch({
  executablePath: EXE, headless: 'new', userDataDir: PROFILE,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars', '--headless=new'],
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  protocolTimeout: 60000,
});
const page = await browser.newPage();
page.setDefaultTimeout(25000);
await page.setUserAgent(MOBILE_UA);

// login
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 25000 });
await page.waitForSelector('input[type="password"]', { timeout: 15000 });
await page.type('input[name="email"], input[type="email"], input[autocomplete="email"]', 'shray@binarycapital.in');
await page.type('input[type="password"]', 'BinaryCapital@2026');
await page.click('button[type="submit"]');
for (let i = 0; i < 40; i++) { if (!page.url().includes('/login')) break; await wait(500); }
await wait(2000);

async function diag(path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await wait(1500);
  const info = await page.evaluate(() => {
    const out = {};
    out.scrollW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    // desktop nav container: the div with "hidden ... md:flex" that wraps nav links
    const navLinksWrap = document.querySelector('nav[aria-label="Primary"] > div.hidden');
    out.navLinksWrap = navLinksWrap ? {
      cls: navLinksWrap.className.slice(0, 80),
      display: getComputedStyle(navLinksWrap).display,
      childCount: navLinksWrap.children.length,
      firstChildDisplay: navLinksWrap.firstElementChild ? getComputedStyle(navLinksWrap.firstElementChild).display : null,
      firstChildRect: navLinksWrap.firstElementChild ? (() => { const r = navLinksWrap.firstElementChild.getBoundingClientRect(); return { w: Math.round(r.width), right: Math.round(r.right) }; })() : null,
    } : null;
    // the nav element itself
    const nav = document.querySelector('nav[aria-label="Primary"]');
    out.nav = nav ? { cls: nav.className.slice(0, 80), display: getComputedStyle(nav).display, width: Math.round(nav.getBoundingClientRect().width), overflowX: getComputedStyle(nav).overflowX, maxWidth: getComputedStyle(nav).maxWidth } : null;
    // find the single element with the max right edge
    let maxRight = 0, maxEl = null;
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.right > maxRight) { maxRight = r.right; maxEl = el; }
    }
    if (maxEl) {
      out.widest = { tag: maxEl.tagName.toLowerCase(), cls: (maxEl.className && typeof maxEl.className === 'string') ? maxEl.className.slice(0, 90) : '', right: Math.round(maxRight), width: Math.round(maxEl.getBoundingClientRect().width) };
      // ancestor chain
      const chain = [];
      let cur = maxEl;
      while (cur && chain.length < 8) {
        const r = cur.getBoundingClientRect();
        chain.push({ tag: cur.tagName.toLowerCase(), cls: (cur.className && typeof cur.className === 'string') ? cur.className.slice(0, 50) : '', w: Math.round(r.width), right: Math.round(r.right), overflowX: getComputedStyle(cur).overflowX, display: getComputedStyle(cur).display });
        cur = cur.parentElement;
      }
      out.chain = chain;
    }
    return out;
  });
  console.log(`\n=== ${path} ===`);
  console.log('scrollW:', info.scrollW);
  console.log('nav:', JSON.stringify(info.nav));
  console.log('navLinksWrap:', JSON.stringify(info.navLinksWrap));
  console.log('widest:', JSON.stringify(info.widest));
  console.log('chain:');
  for (const c of info.chain || []) console.log(`  <${c.tag}> w=${c.w} right=${c.right} overflowX=${c.overflowX} display=${c.display} .${c.cls}`);
}

await diag('/deals');
await diag('/parties');
await diag('/compliance/audit');
await diag('/');

await browser.close();
console.log('DIAG_DONE');
