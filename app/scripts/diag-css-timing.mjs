// Confirm whether the Tailwind stylesheet applies after enough wait time on
// /deals (the overflowing page). Polls nav.display + navLinksWrap.display +
// scrollWidth at 500/1500/3000/5000ms, and also waits for networkidle2 + the
// first <link rel=stylesheet> to load. If display flips to flex and scrollWidth
// drops to 390, the overflow was a pre-CSS measurement artifact.
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
const PROFILE = mkdtempSync(join(tmpdir(), 'pcrm-csstime-'));
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

async function snap(label) {
  const info = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Primary"]');
    const wrap = document.querySelector('nav[aria-label="Primary"] > div.hidden');
    const stylesheets = Array.from(document.styleSheets).length;
    const cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((l) => ({ href: l.href, loaded: l.sheet !== null }));
    return {
      scrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      navDisplay: nav ? getComputedStyle(nav).display : 'no-nav',
      navMaxWidth: nav ? getComputedStyle(nav).maxWidth : 'no-nav',
      wrapDisplay: wrap ? getComputedStyle(wrap).display : 'no-wrap',
      stylesheets, cssLinks,
    };
  });
  console.log(`[${label}] scrollW=${info.scrollW} navDisplay=${info.navDisplay} navMaxWidth=${info.navMaxWidth} wrapDisplay=${info.wrapDisplay} sheets=${info.stylesheets} cssLinkLoaded=${info.cssLinks.map((c) => c.loaded).join(',')}`);
}

// Test 1: domcontentloaded then poll (mirrors mobile-pass.mjs)
console.log('=== /deals with waitUntil=domcontentloaded ===');
await page.goto(`${BASE}/deals`, { waitUntil: 'domcontentloaded', timeout: 25000 });
await wait(500); await snap('500ms');
await wait(1000); await snap('1500ms');
await wait(1500); await snap('3000ms');
await wait(2000); await snap('5000ms');

// Test 2: networkidle2 (wait for CSS + JS to settle)
console.log('\n=== /deals with waitUntil=networkidle2 ===');
await page.goto(`${BASE}/deals`, { waitUntil: 'networkidle2', timeout: 30000 });
await wait(500); await snap('idle+500ms');

// Test 3: explicitly wait for the stylesheet link to have .sheet
console.log('\n=== /deals wait for stylesheet load ===');
await page.goto(`${BASE}/deals`, { waitUntil: 'domcontentloaded', timeout: 25000 });
try {
  await page.waitForFunction(() => {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    return links.length > 0 && links.every((l) => l.sheet !== null);
  }, { timeout: 15000 });
  console.log('stylesheet loaded');
} catch (e) { console.log('stylesheet wait failed:', e.message); }
await wait(500); await snap('post-css-load');

await browser.close();
console.log('CSSTIME_DONE');
