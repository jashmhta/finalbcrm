// Verify the previously-broken screens render real data by logging in and
// dumping key text content from each page. More reliable than screenshots for
// confirming no NaN/undefined and real rows.
import puppeteer from 'puppeteer-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = 'http://localhost:3000';
const EXE = '/usr/bin/chromium-browser';
const PROFILE = mkdtempSync(join(tmpdir(), 'pcrm-verify-'));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EXE,
  headless: true,
  userDataDir: PROFILE,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars'],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
});

const page = await browser.newPage();
page.setDefaultTimeout(45000);

const go = async (path, settleMs = 2200) => {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await wait(settleMs);
};

// Login
await go('/login', 2500);
// Wait for the form to be interactive, then fill + submit.
await page.waitForSelector('input[name="password"]', { timeout: 30000 });
await page.type('input[name="email"]', 'shray@binarycapital.in');
await page.type('input[name="password"]', 'devpass123');
await Promise.all([
  page.waitForFunction(() => !location.pathname.includes('/login'), { timeout: 30000 }).catch(() => {}),
  page.click('button[type="submit"]'),
]);
await wait(4000);
console.log('authed at:', page.url());

const check = async (path, label) => {
  await go(path, 2500);
  const url = page.url();
  const body = await page.evaluate(() => document.body.innerText);
  const len = body.length;
  const hasNaN = /NaN/.test(body);
  const hasUndefined = /undefined/.test(body);
  const hasNoParty = /No party/.test(body);
  const hasNoData = /No data/.test(body);
  console.log(`\n=== ${label} (${url}) ===`);
  console.log(`body length: ${len}`);
  console.log(`NaN: ${hasNaN} | undefined: ${hasUndefined} | "No party": ${hasNoParty} | "No data": ${hasNoData}`);
  // Print a trimmed snippet for key screens
  if (label === 'credit-detail') {
    console.log('snippet:', body.replace(/\s+/g, ' ').slice(0, 1200));
  }
  if (label === 'audit') {
    // count table-ish rows by looking for repeated date patterns
    const dateMatches = body.match(/\d{2} [A-Z][a-z]{2} \d{4}/g) || [];
    console.log('date-like tokens (row proxy):', dateMatches.length);
    console.log('snippet:', body.replace(/\s+/g, ' ').slice(0, 800));
    // sticky day anchors: distinct day-label strips + sticky positioning
    const dayInfo = await page.evaluate(() => {
      const strips = Array.from(document.querySelectorAll('[class*="sticky"][class*="top-"]'));
      const labels = strips.map((s) => s.textContent.replace(/\s+/g, ' ').trim().slice(0, 60)).filter(Boolean);
      return { stickyCount: strips.length, distinctLabels: new Set(labels).size, sample: Array.from(new Set(labels)).slice(0, 8) };
    });
    console.log('sticky day anchors:', JSON.stringify(dayInfo));
  }
  if (label === 'dashboard') {
    console.log('snippet:', body.replace(/\s+/g, ' ').slice(0, 1000));
  }
  if (label === 'deals') {
    console.log('snippet:', body.replace(/\s+/g, ' ').slice(0, 800));
  }
  if (label === 'parties') {
    // full distinct legal names + strength-band variety
    const names = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href^="/parties/"]')).map((a) => a.textContent.trim()).filter(Boolean)
    );
    const uniq = new Set(names);
    const strength = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-strength],[class*="strength"]')).map((e) => e.textContent.trim()).filter(Boolean)
    );
    console.log('party link count:', names.length, '| distinct names:', uniq.size);
    console.log('sample names:', names.slice(0, 8).join(' | '));
    console.log('strength tokens:', strength.length, '| distinct:', new Set(strength).size, '| set:', Array.from(new Set(strength)).slice(0, 8).join(','));
    // relative-time variety (the old "14h ago" tell)
    const reltimes = await page.evaluate(() =>
      Array.from(document.querySelectorAll('time,[datetime]')).map((t) => t.textContent.trim()).filter(Boolean)
    );
    console.log('relative-time tokens:', reltimes.length, '| distinct:', new Set(reltimes).size, '| sample:', Array.from(new Set(reltimes)).slice(0, 10).join(', '));
  }
  if (label === 'credit-workspace') {
    // source-data must be COLLAPSED by default: "Show source data" button,
    // aria-expanded=false, "Source data collapsed" message, and NO table rows.
    const info = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-controls="source-data-table"]');
      const table = document.getElementById('source-data-table');
      const collapsedMsg = /Source data collapsed/.test(document.body.innerText);
      return {
        togglePresent: !!btn,
        toggleLabel: btn ? btn.textContent.trim() : null,
        ariaExpanded: btn ? btn.getAttribute('aria-expanded') : null,
        tableInDOM: !!table,
        tableVisible: table ? table.offsetHeight > 0 : false,
        collapsedMsg,
      };
    });
    console.log('source-data panel:', JSON.stringify(info));
    const collapsed = info.togglePresent && info.ariaExpanded === 'false' && /Show source data/.test(info.toggleLabel || '') && info.collapsedMsg && !info.tableVisible;
    console.log('SOURCE_DATA_COLLAPSED_BY_DEFAULT:', collapsed);
  }
  return { label, url, len, hasNaN, hasUndefined, hasNoParty, hasNoData };
};

const results = [];
results.push(await check('/parties', 'parties'));
results.push(await check('/credit/b28d3d04-1f20-4c57-90de-2f9d78777837', 'credit-detail'));
results.push(await check('/compliance/audit', 'audit'));
results.push(await check('/deals', 'deals'));
results.push(await check('/', 'dashboard'));
results.push(await check('/credit/b28d3d04-1f20-4c57-90de-2f9d78777837/workspace', 'credit-workspace'));

console.log('\n=== SUMMARY ===');
for (const r of results) {
  console.log(`${r.label}: len=${r.len} NaN=${r.hasNaN} undef=${r.hasUndefined} noParty=${r.hasNoParty} noData=${r.hasNoData}`);
}

await browser.close();
console.log('VERIFY_DONE');
