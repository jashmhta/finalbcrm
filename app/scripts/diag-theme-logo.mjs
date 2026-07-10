// Directly verify the theme toggle flips html.dark and the nav logo <img>
// renders on an authed page — with a post-click wait (next-themes updates the
// class via an effect, so the verifier's instant check can false-negative).
import puppeteer from 'puppeteer-core';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let AUTH_URL = process.env.AUTH_URL;
if (!AUTH_URL) {
  try { const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8'); for (const line of env.split('\n')) { const m = /^AUTH_URL=(.+)$/.exec(line.trim()); if (m) { AUTH_URL = m[1].trim(); break; } } } catch {}
}
const BASE = (AUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
const EXE = '/usr/bin/chromium-browser';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PROFILE = mkdtempSync(join(tmpdir(), 'pcrm-theme-'));

const browser = await puppeteer.launch({
  executablePath: EXE, headless: 'new', userDataDir: PROFILE,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars', '--headless=new'],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 }, protocolTimeout: 60000,
});
const page = await browser.newPage();
page.setDefaultTimeout(25000);

// login
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 25000 });
await page.waitForSelector('input[type="password"]', { timeout: 15000 });
await page.type('input[name="email"], input[type="email"], input[autocomplete="email"]', 'shray@binarycapital.in');
await page.type('input[type="password"]', 'BinaryCapital@2026');
await page.click('button[type="submit"]');
for (let i = 0; i < 40; i++) { if (!page.url().includes('/login')) break; await wait(500); }
await wait(2000);

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 25000 });
await wait(1500);

// nav logo check: any <img> inside nav/header whose src references the logo
const logoInfo = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('nav a img, header img, nav img'));
  return imgs.slice(0, 4).map((i) => ({ src: (i.src || '').slice(0, 120), alt: i.alt, w: i.getBoundingClientRect().width }));
});
console.log('nav/header imgs:', JSON.stringify(logoInfo, null, 2));

// theme toggle check with post-click wait
const toggleResult = await page.evaluate(async () => {
  const html = document.documentElement;
  const before = html.classList.contains('dark');
  const btns = Array.from(document.querySelectorAll('button'));
  const toggle = btns.find((b) => /toggle color theme/i.test(b.getAttribute('aria-label') || ''));
  if (!toggle) return { found: false, before, after: null, flipped: false };
  toggle.click();
  await new Promise((r) => setTimeout(r, 600));
  const after = html.classList.contains('dark');
  return { found: true, before, after, flipped: before !== after };
});
console.log('theme toggle:', JSON.stringify(toggleResult));

await browser.close();
console.log('THEME_LOGO_DONE');
