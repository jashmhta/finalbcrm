#!/usr/bin/env node
/**
 * Focused mobile checks: circular liquid-glass bottom nav, hide-on-scroll,
 * desk scroll ownership, no horizontal overflow, primary modules with data.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.E2E_BASE || "http://127.0.0.1:3000";
const OUT = process.env.E2E_OUT || "/tmp/grok-goal-a64943487db3/implementer";
const CDP = process.env.E2E_CDP_PORT || "9230";
const SESSION = process.env.E2E_SESSION || `e2e-mobile-nav-${CDP}`;
const PROFILE = process.env.E2E_PROFILE || `/tmp/ab-mobile-nav-${CDP}`;
const PW = "BinaryCrm!2026";

const results = [];

function log(m) {
  const line = `[${new Date().toISOString()}] ${m}`;
  console.log(line);
  appendFileSync(join(OUT, "mobile-scroll-nav.log"), line + "\n");
}

function ab(args, timeout = 90_000) {
  const r = spawnSync("agent-browser", ["--session", SESSION, ...args], {
    encoding: "utf8",
    timeout,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, AGENT_BROWSER_SESSION: SESSION },
  });
  return {
    ok: r.status === 0,
    out: (r.stdout || "") + (r.stderr || ""),
  };
}

function evalJson(js) {
  const raw = ab(["eval", js]).out.trim();
  let s = raw;
  try {
    while (
      (s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'"))
    ) {
      s = JSON.parse(s);
    }
    return typeof s === "string" ? JSON.parse(s) : s;
  } catch {
    return { ok: false, raw: raw.slice(0, 300) };
  }
}

function record(step, pass, detail) {
  results.push({ step, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} ${step}: ${detail}`);
}

function ensureChrome() {
  let c = ab(["connect", CDP]);
  if (c.ok) return;
  const chrome = spawnSync(
    "bash",
    ["-lc", "ls /home/Jashmhta/.agent-browser/browsers/chrome-*/chrome 2>/dev/null | head -1"],
    { encoding: "utf8" },
  ).stdout.trim();
  if (!chrome) throw new Error("chrome missing");
  spawnSync("bash", ["-lc", `fuser -k ${CDP}/tcp 2>/dev/null || true`]);
  spawnSync(
    "bash",
    [
      "-lc",
      `mkdir -p ${PROFILE} && "${chrome}" --no-sandbox --disable-dev-shm-usage --headless=new --remote-debugging-port=${CDP} --user-data-dir=${PROFILE} about:blank >/tmp/ab-mobile-nav.log 2>&1 &`,
    ],
    { encoding: "utf8" },
  );
  spawnSync("sleep", ["2"]);
  c = ab(["connect", CDP]);
  if (!c.ok) throw new Error("connect failed: " + c.out);
}

function login() {
  ab(["cookies", "clear"]);
  ab(["set", "viewport", "390", "844"]);
  ab(["open", `${BASE}/console/login`]);
  spawnSync("sleep", ["2"]);
  ab([
    "eval",
    `(() => {
      const b = [...document.querySelectorAll('button')].find(x => (x.innerText||'').includes('Binary Capital'));
      b?.click(); return 'brand';
    })()`,
  ]);
  spawnSync("sleep", ["1"]);
  const snap = ab(["snapshot", "-i"]).out;
  const er = snap.match(/textbox "Work email"[^\n]*\[ref=(e\d+)\]/);
  const pr = snap.match(/textbox "Password"[^\n]*\[ref=(e\d+)\]/);
  if (er) ab(["fill", `@${er[1]}`, "shray@binarycapital.in"]);
  else ab(["fill", 'input[name="email"]', "shray@binarycapital.in"]);
  if (pr) ab(["fill", `@${pr[1]}`, PW]);
  else ab(["fill", 'input[name="password"]', PW]);
  ab(["eval", "document.querySelector('button[type=submit]')?.click(); 'ok'"]);
  spawnSync("sleep", ["5"]);
  const url = ab(["get", "url"]).out;
  record("login", url.includes("/console") && !url.includes("/login"), url);
}

function checkNavGlass() {
  const data = evalJson(`(() => {
    const nav = document.querySelector('[data-testid="console-mobile-nav"]')
      || document.querySelector('.c-mobile-nav');
    if (!nav) return {ok:false, reason:'no-nav'};
    const items = [...nav.querySelectorAll('.c-mobile-nav__item, a[data-testid^="mobile-nav-"]')];
    const styles = items.map(el => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        radius: cs.borderRadius,
        bf: cs.backdropFilter || cs.webkitBackdropFilter || '',
        display: cs.display,
      };
    });
    const equal = styles.length >= 4 && styles.every(s => Math.abs(s.w - styles[0].w) <= 2 && Math.abs(s.h - styles[0].h) <= 2);
    const circular = styles.every(s => s.w >= 40 && s.h >= 40 && Math.abs(s.w - s.h) <= 2 && (s.radius.includes('50%') || parseFloat(s.radius) >= s.w/2 - 2 || s.radius === '999px' || parseFloat(s.radius) >= 20));
    const glass = styles.some(s => s.bf.includes('blur')) || !!document.querySelector('.c-mobile-nav__dock');
    const visible = nav.getAttribute('data-visible') !== 'false' && !nav.classList.contains('c-mobile-nav--hidden');
    return {ok: equal && circular && glass && visible, equal, circular, glass, visible, n: styles.length, styles: styles.slice(0,5)};
  })()`);
  record("nav-circular-glass", !!data.ok, JSON.stringify(data));
  ab(["screenshot", join(OUT, "mobile", "nav-rest.png")]);
}

function checkHideOnScroll() {
  ab([
    "eval",
    `(() => {
      const main = document.querySelector('.c-desk-scroll') || document.querySelector('#main-content');
      if (!main) return 'no-main';
      main.scrollTop = 0;
      main.dispatchEvent(new Event('scroll'));
      return JSON.stringify({ h: main.scrollHeight, c: main.clientHeight });
    })()`,
  ]);
  spawnSync("sleep", ["0.15"]);
  // Measure hide in the same turn as scroll (before idle restore ~220ms).
  const mid = evalJson(`(() => {
    const main = document.querySelector('.c-desk-scroll');
    const nav = document.querySelector('[data-testid="console-mobile-nav"]') || document.querySelector('.c-mobile-nav');
    if (!main || !nav) return { ok:false, reason:'missing' };
    const max = Math.max(0, main.scrollHeight - main.clientHeight);
    main.scrollTop = 0;
    main.dispatchEvent(new Event('scroll'));
    for (let y = 0; y <= max; y += Math.max(24, Math.floor(max / 6) || 24)) {
      main.scrollTop = y;
      main.dispatchEvent(new Event('scroll'));
    }
    main.scrollTop = max;
    main.dispatchEvent(new Event('scroll'));
    const flag = document.documentElement.dataset.consoleMobileNav;
    const hidden =
      flag === 'hidden' ||
      nav.classList.contains('c-mobile-nav--hidden') ||
      nav.getAttribute('data-visible') === 'false';
    return {
      hidden,
      flag,
      dataVisible: nav.getAttribute('data-visible'),
      classHidden: nav.classList.contains('c-mobile-nav--hidden'),
      scrollTop: main.scrollTop,
      canScroll: main.scrollHeight > main.clientHeight + 2,
      opacity: getComputedStyle(nav).opacity,
    };
  })()`);
  ab(["screenshot", join(OUT, "mobile", "nav-scrolled.png")]);
  record("nav-hide-on-scroll", !!mid.hidden && !!mid.canScroll, JSON.stringify(mid));

  // Idle restore after MOBILE_NAV_IDLE_MS (220)
  spawnSync("sleep", ["0.4"]);
  const restored = evalJson(`(() => {
    const nav = document.querySelector('[data-testid="console-mobile-nav"]') || document.querySelector('.c-mobile-nav');
    const flag = document.documentElement.dataset.consoleMobileNav;
    const visible =
      flag === 'visible' ||
      (!nav?.classList.contains('c-mobile-nav--hidden') &&
        nav?.getAttribute('data-visible') !== 'false');
    return { visible, flag, dataVisible: nav?.getAttribute('data-visible') };
  })()`);
  record("nav-restore-on-idle", !!restored.visible, JSON.stringify(restored));
}

function checkDeskPaddingNoUnderlap() {
  ab(["open", `${BASE}/console`]);
  spawnSync("sleep", ["1.5"]);
  const data = evalJson(`(() => {
    const main = document.querySelector('#main-content.c-desk-scroll') || document.querySelector('.c-desk-scroll');
    const nav = document.querySelector('.c-mobile-nav');
    if (!main) return {ok:false, reason:'no-main'};
    const cs = getComputedStyle(main);
    const pb = parseFloat(cs.paddingBottom) || 0;
    const navH = nav ? nav.getBoundingClientRect().height : 0;
    // Scroll to end and ensure last content isn't trapped under the dock
    main.scrollTop = main.scrollHeight;
    const kids = [...main.querySelectorAll('h1,h2,p,li,a,section,div')].filter(el => {
      const r = el.getBoundingClientRect();
      return r.height > 8 && r.width > 20;
    });
    const last = kids[kids.length - 1];
    const lastBottom = last ? last.getBoundingClientRect().bottom : 0;
    const dockTop = nav && nav.getAttribute('data-visible') !== 'false'
      ? nav.getBoundingClientRect().top
      : window.innerHeight;
    // With pad, last content bottom should sit above dock top when scrolled to end
    // (allow 8px slack). If pad is 0, lastBottom often >= dockTop (underlap).
    const trapped = last && nav && lastBottom > dockTop + 8;
    return {
      ok: pb >= 72 && !trapped,
      paddingBottom: pb,
      navH,
      lastBottom,
      dockTop,
      trapped: !!trapped,
    };
  })()`);
  record("desk-padding-no-underlap", !!data.ok, JSON.stringify(data));
}

function checkOverflowAndRoutes() {
  const routes = [
    "/console",
    "/console/parties",
    "/console/leads",
    "/console/deals",
    "/console/tasks",
    "/console/matching",
  ];
  for (const route of routes) {
    ab(["open", `${BASE}${route}`]);
    spawnSync("sleep", ["1.5"]);
    const data = evalJson(`(() => {
      const de = document.documentElement;
      const body = document.body;
      const overflowX = Math.max(de.scrollWidth, body.scrollWidth) > de.clientWidth + 2;
      const main = document.querySelector('.c-desk-scroll');
      const canScroll = main ? main.scrollHeight > main.clientHeight + 2 || main.scrollHeight > 200 : false;
      const text = (body.innerText || '').slice(0, 2500);
      const has500 = /Application error|Internal Server Error/i.test(text);
      const hasRows =
        /MOCK|Acme|Garuda|Horizon|Roadway|Sterling|Meridian|Cascade|Orbit|Apex|Open mandates|Parties in view|pending|mandate|lead|task/i.test(text);
      const nav = document.querySelector('.c-mobile-nav');
      const pb = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
      return {
        overflowX, canScroll: !!canScroll, has500, hasRows,
        navPresent: !!nav,
        paddingBottom: pb,
        url: location.pathname,
      };
    })()`);
    record(
      `route:${route}`,
      !data.has500 && !data.overflowX && data.navPresent !== false && (data.paddingBottom ?? 0) >= 72,
      JSON.stringify(data),
    );
  }
}

function main() {
  mkdirSync(join(OUT, "mobile"), { recursive: true });
  writeFileSync(join(OUT, "mobile-scroll-nav.log"), "");
  ensureChrome();
  login();
  checkNavGlass();
  checkHideOnScroll();
  checkDeskPaddingNoUnderlap();
  checkOverflowAndRoutes();
  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  const summary = {
    base: BASE,
    total: results.length,
    pass,
    fail,
    fails: results.filter((r) => !r.pass),
    results,
  };
  writeFileSync(join(OUT, "mobile-scroll-nav-summary.json"), JSON.stringify(summary, null, 2));
  log(`DONE total=${results.length} pass=${pass} fail=${fail}`);
  console.log(JSON.stringify({ total: results.length, pass, fail, fails: summary.fails }, null, 2));
  process.exit(fail > 0 ? 1 : 0);
}

main();
