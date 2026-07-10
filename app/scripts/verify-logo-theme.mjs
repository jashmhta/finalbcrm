// Focused check: (a) the real BC logo renders in the nav AND login (detect via
// the bundled static-media logo filename in the page HTML, regardless of the
// /_next/image wrapper), (b) the theme toggle actually flips html.dark after
// allowing React's re-render tick. Login uses the AUTH_URL host.
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
const PROFILE = mkdtempSync(join(tmpdir(), 'pcrm-lt-'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EXE, headless: 'new', userDataDir: PROFILE,
  args: ['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--hide-scrollbars','--headless=new'],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  protocolTimeout: 60000,
});
const page = await browser.newPage();
page.setDefaultTimeout(30000);

// The logo is a static import → bundled as /_next/static/media/logo.<hash>.png.
// Next.js <Image> rewrites the <img src> to /_next/image?url=<encoded media path>,
// so detect by the encoded media path OR a direct media src. Either way the
// substring "static/media/logo" appears (encoded as %2F or literal).
const logoInHtml = (html) => /static\/media\/logo\b|static%2Fmedia%2Flogo\b/i.test(html);

// ---- Login (authed) so the nav is present ----
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('input[type="password"]', { timeout: 15000 });
await page.type('input[name="email"], input[type="email"], input[autocomplete="email"]', 'shray@binarycapital.in');
await page.type('input[type="password"]', 'BinaryCapital@2026');
await page.click('button[type="submit"]');
for (let i = 0; i < 40; i++) { if (!page.url().includes('/login')) break; await wait(500); }
await wait(2000);
console.log('authed at:', page.url());

// ---- Nav logo: check the authed /parties HTML for the bundled logo media ----
await page.goto(`${BASE}/parties`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await wait(1500);
const navHtml = await page.content();
const navLogoImgs = await page.evaluate(() =>
  Array.from(document.querySelectorAll('img'))
    .filter((i) => /static\/media\/logo|static%2Fmedia%2Flogo/i.test(i.src || '') || /static\/media\/logo|static%2Fmedia%2Flogo/i.test(i.getAttribute('srcset') || ''))
    .map((i) => ({ src: i.src, inNav: !!(i.closest('nav,header,[class*=nav],[class*=Nav],[data-nav]')) }))
);
console.log('nav logo <img> count:', navLogoImgs.length);
console.log('nav logo in nav-ish ancestor:', navLogoImgs.some((x) => x.inNav));
console.log('nav HTML contains logo media ref:', logoInHtml(navHtml));

// ---- Theme toggle: click + AWAIT the React re-render, then read the class ----
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await wait(1200);
const toggleResult = await page.evaluate(async () => {
  const html = document.documentElement;
  const btn = document.querySelector('button[aria-label="Toggle color theme"]');
  if (!btn) return { found: false };
  const before = html.classList.contains('dark');
  btn.click();
  // allow next-themes' React state update + class apply to flush
  await new Promise((r) => setTimeout(r, 600));
  const after = html.classList.contains('dark');
  // restore
  btn.click();
  await new Promise((r) => setTimeout(r, 600));
  const restored = html.classList.contains('dark');
  // also report the localStorage theme value next-themes wrote
  const stored = localStorage.getItem('theme');
  return { found: true, before, after, restored, stored, flipped: before !== after };
});
console.log('theme toggle:', JSON.stringify(toggleResult));

// ---- Login logo (unauthed): fresh context so we're logged out ----
const ctx = await browser.createBrowserContext();
const p2 = await ctx.newPage();
await p2.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await wait(1500);
const loginHtml = await p2.content();
const loginLogoImgs = await p2.evaluate(() =>
  Array.from(document.querySelectorAll('img'))
    .filter((i) => /static\/media\/logo|static%2Fmedia%2Flogo/i.test(i.src || '') || /static\/media\/logo|static%2Fmedia%2Flogo/i.test(i.getAttribute('srcset') || ''))
    .length
);
console.log('login logo <img> count:', loginLogoImgs);
console.log('login HTML contains logo media ref:', logoInHtml(loginHtml));
await ctx.close();

await browser.close();
console.log('LOGO_THEME_DONE');
