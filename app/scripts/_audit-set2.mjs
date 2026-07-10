import puppeteer from 'puppeteer-core';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = 'http://localhost:3000';
const OUT = '/home/Jashmhta/crm/screenshots/set2-audit';
mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PROFILE = mkdtempSync(join(tmpdir(), 'pcrm-set2-'));
const EXE = '/usr/bin/chromium-browser';

const KYC = 'b2d16c4f-892c-405d-bf66-d082d4a8509e';
const INT = 'b799af9c-4329-4e03-994f-0f03cc9916e2';
const TASK = 'a3a80b9d-9411-44f2-81d5-bb4b04510bb4';
const TASK_BLK = '62418798-1b39-43f9-8089-459d637714c0';
const DOC = 'ea46de59-3647-4f70-9ea4-945aa7876dd6';
const DOC_NORM = '5b5a5485-96df-4f05-a20d-a131b4022fd7';

const PAGES = [
  ['01-dashboard', '/'],
  ['02-integrations', '/integrations'],
  ['03-kyc-detail', `/compliance/kyc/${KYC}`],
  ['04-consent', '/compliance/consent'],
  ['05-consent-dsr', '/compliance/consent?tab=dsr'],
  ['06-interaction-detail', `/interactions/${INT}`],
  ['07-task-detail', `/tasks/${TASK}`],
  ['08-task-blocked', `/tasks/${TASK_BLK}`],
  ['09-document-detail', `/documents/${DOC}`],
  ['10-document-normal', `/documents/${DOC_NORM}`],
];

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
    await p.evaluate(() => {
      document.querySelectorAll('[style*="opacity: 0"], [style*="opacity:0"]').forEach((el) => {
        el.style.opacity = '1'; el.style.transform = 'none'; el.style.filter = 'none';
      });
    });
  } catch {}
  await wait(700);
}
async function cap(browser, name, path, w, h, isMobile) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: !!isMobile });
  page.setDefaultTimeout(20000);
  try { await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 }); }
  catch (e) { console.log('goto err', name, e.message); }
  await wait(1800);
  await triggerReveals(page);
  try { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true, captureBeyondViewport: true }); console.log('shot', name); }
  catch (e) { console.log('shot err', name, e.message); }
  // overflow check
  const overflow = await page.evaluate(() => {
    const de = document.documentElement;
    return { scrollW: de.scrollWidth, clientW: de.clientWidth, bodyW: document.body.scrollWidth };
  }).catch(() => null);
  if (overflow && (overflow.scrollW > overflow.clientW + 2 || overflow.bodyW > overflow.clientW + 2)) {
    console.log('OVERFLOW', name, JSON.stringify(overflow));
  }
  await page.close();
}

const browser = await puppeteer.launch({
  executablePath: EXE, headless: 'new',
  userDataDir: PROFILE,
  args: ['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--hide-scrollbars','--force-color-profile=srgb','--headless=new'],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  protocolTimeout: 60000,
});

// authenticate
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
try {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.type('input[name="email"], input[type="email"], input[autocomplete="email"]', 'shray@binarycapital.in');
  await page.type('input[type="password"]', 'devpass123');
  await page.click('button[type="submit"]');
  for (let i = 0; i < 40; i++) { if (!page.url().includes('/login')) break; await wait(500); }
  await wait(2800);
  console.log('post-login url:', page.url());
} catch (e) { console.log('login-flow err', e.message); }
await page.close();

// desktop 1440
for (const [name, path] of PAGES) { await cap(browser, `d-${name}`, path, 1440, 900, false); }
// mobile 390
for (const [name, path] of PAGES) { await cap(browser, `m-${name}`, path, 390, 844, true); }

await browser.close();
console.log('DONE');
