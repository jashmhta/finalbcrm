// Print the exact stylesheet <link> hrefs on /deals (authed, mobile) and their
// load status + the HTTP status when fetched directly. Then compare the same
// on /parties. Determines whether the "second CSS never loads" is a real
// broken/404 chunk or a puppeteer load race.
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
const PROFILE = mkdtempSync(join(tmpdir(), 'pcrm-csslnk-'));
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const browser = await puppeteer.launch({
  executablePath: EXE, headless: 'new', userDataDir: PROFILE,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars', '--headless=new'],
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  protocolTimeout: 60000,
});
const page = await browser.newPage();
page.setDefaultTimeout(30000);
await page.setUserAgent(MOBILE_UA);

// login
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 25000 });
await page.waitForSelector('input[type="password"]', { timeout: 15000 });
await page.type('input[name="email"], input[type="email"], input[autocomplete="email"]', 'shray@binarycapital.in');
await page.type('input[type="password"]', 'BinaryCapital@2026');
await page.click('button[type="submit"]');
for (let i = 0; i < 40; i++) { if (!page.url().includes('/login')) break; await wait(500); }
await wait(2000);
const cookieHdr = (await page.cookies()).map((c) => `${c.name}=${c.value}`).join('; ');

async function cssInfo(path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await wait(2500);
  const links = await page.evaluate(() => Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((l) => ({ href: l.href, loaded: l.sheet !== null, disabled: l.disabled, precedence: l.getAttribute('data-precedence') })));
  console.log(`\n=== ${path} ===`);
  for (const l of links) {
    // fetch the CSS directly (with cookie) to get HTTP status + bytes
    const directHref = l.href.replace(/^https?:\/\/[^/]+/, '').replace(/^https?:\/\/[^/]+/, '');
    let status = 'ERR', bytes = 0;
    try {
      const res = await fetch(`${BASE}${new URL(l.href).pathname}`, { headers: { Cookie: cookieHdr } });
      status = res.status;
      bytes = (await res.text()).length;
    } catch (e) { status = 'fetch-err:' + e.message; }
    console.log(`  href=${new URL(l.href).pathname} loaded=${l.loaded} disabled=${l.disabled} precedence=${l.precedence} http=${status} bytes=${bytes}`);
  }
  const scrollW = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
  console.log(`  scrollW=${scrollW}`);
}

await cssInfo('/deals');
await cssInfo('/parties');
await cssInfo('/');

await browser.close();
console.log('CSSLINK_DONE');
