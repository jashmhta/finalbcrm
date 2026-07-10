#!/usr/bin/env node
/**
 * Full Console E2E harness via agent-browser (desktop + mobile).
 *
 * Coverage:
 *  - Brand gate + legacy login redirect
 *  - Auth edge: bad password stays on login
 *  - All org personas (super admins + employees, Capital + Bonds)
 *  - RBAC nav + admin surface denial
 *  - Every primary console module route
 *  - Detail-list click-through when rows exist
 *  - Admin create-user form presence (super only)
 *  - Scroll ownership on desk main
 *  - Mobile horizontal overflow
 *  - Console shell chrome (no legacy bounce / error walls)
 *  - Screenshots per persona + key routes
 *
 * Usage:
 *   E2E_BASE=http://20.161.68.148:3000 node scripts/e2e-console-agent.mjs
 *   node scripts/e2e-console-agent.mjs --viewport=desktop
 *   node scripts/e2e-console-agent.mjs --viewport=mobile
 *   E2E_CDP_PORT=9224 E2E_OUT=/tmp/crm-e2e-m node scripts/e2e-console-agent.mjs --viewport=mobile
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const BASE =
  process.env.E2E_BASE ||
  process.argv.find((a) => a.startsWith("--base="))?.slice(7) ||
  "http://127.0.0.1:3000";
const VP = process.argv.includes("--viewport=mobile")
  ? "mobile"
  : process.argv.includes("--viewport=desktop")
    ? "desktop"
    : "all";

const OUT = process.env.E2E_OUT || "/tmp/crm-e2e";
const CDP = process.env.E2E_CDP_PORT || "9223";
const PROFILE = process.env.E2E_PROFILE || `/tmp/ab-e2e-profile-${CDP}`;
const SESSION = process.env.E2E_SESSION || `e2e-${CDP}`;
const PW = "BinaryCrm!2026";

/** Super-admin full module map */
const SUPER_ROUTES = [
  "/console",
  "/console/parties",
  "/console/leads",
  "/console/leads/new",
  "/console/deals",
  "/console/tasks",
  "/console/matching",
  "/console/interactions",
  "/console/onboarding",
  "/console/documents",
  "/console/calendar",
  "/console/notifications",
  "/console/credit",
  "/console/modeling",
  "/console/compliance/kyc",
  "/console/portfolio",
  "/console/reports",
  "/console/admin",
  "/console/ai",
  "/console/integrations",
  "/console/portal/client",
  "/console/portal/investor",
];

const EMPLOYEE_ROUTES = [
  "/console",
  "/console/parties",
  "/console/leads",
  "/console/deals",
  "/console/tasks",
  "/console/matching",
  "/console/interactions",
  "/console/onboarding",
  "/console/documents",
  "/console/calendar",
  "/console/notifications",
  "/console/admin", // must NOT show create-user
];

const PERSONAS = [
  {
    id: "super_shray",
    email: "shray@binarycapital.in",
    password: PW,
    brand: "binarycapital",
    level: "super_admin",
    expectNav: ["Admin", "Client book", "Home"],
    expectNoNav: [],
    routes: SUPER_ROUTES,
    deepClick: ["/console/parties", "/console/leads", "/console/deals", "/console/tasks"],
  },
  {
    id: "super_shahrukh",
    email: "shahrukh@binarycapital.in",
    password: PW,
    brand: "binarycapital",
    level: "super_admin",
    expectNav: ["Admin", "Home"],
    expectNoNav: [],
    routes: [
      "/console",
      "/console/parties",
      "/console/leads",
      "/console/deals",
      "/console/tasks",
      "/console/admin",
      "/console/credit",
      "/console/reports",
    ],
    deepClick: ["/console/parties"],
  },
  {
    id: "super_rati",
    email: "rati@binarybonds.in",
    password: PW,
    brand: "binarybonds",
    level: "super_admin",
    expectNav: ["Admin", "Home"],
    expectNoNav: [],
    routes: [
      "/console",
      "/console/parties",
      "/console/matching",
      "/console/deals",
      "/console/admin",
      "/console/compliance/kyc",
    ],
    deepClick: ["/console/matching"],
  },
  {
    id: "super_niraj",
    email: "niraj@binarybonds.in",
    password: PW,
    brand: "binarybonds",
    level: "super_admin",
    expectNav: ["Admin", "Home"],
    expectNoNav: [],
    routes: ["/console", "/console/parties", "/console/deals", "/console/matching", "/console/admin"],
    deepClick: [],
  },
  {
    id: "employee_yash",
    email: "yash@binarycapital.in",
    password: PW,
    brand: "binarycapital",
    level: "employee",
    expectNav: ["Client book", "Home"],
    expectNoNav: ["Admin"],
    routes: EMPLOYEE_ROUTES,
    deepClick: ["/console/parties", "/console/leads"],
  },
  {
    id: "employee_pranjali",
    email: "pranjali@binarycapital.in",
    password: PW,
    brand: "binarycapital",
    level: "employee",
    expectNav: ["Home"],
    expectNoNav: ["Admin"],
    routes: ["/console", "/console/parties", "/console/tasks", "/console/admin"],
    deepClick: [],
  },
  {
    id: "employee_tashmit",
    email: "tashmit@binarybonds.in",
    password: PW,
    brand: "binarybonds",
    level: "employee",
    expectNav: ["Home"],
    expectNoNav: ["Admin"],
    routes: [
      "/console",
      "/console/parties",
      "/console/matching",
      "/console/deals",
      "/console/tasks",
      "/console/admin",
    ],
    deepClick: ["/console/parties"],
  },
];

const results = [];

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    appendFileSync(join(OUT, "logs", "e2e-run.log"), line + "\n");
  } catch {
    /* ignore */
  }
}

function ab(args, opts = {}) {
  // Isolate parallel desktop/mobile via --session
  const r = spawnSync("agent-browser", ["--session", SESSION, ...args], {
    encoding: "utf8",
    timeout: opts.timeout ?? 90_000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, AGENT_BROWSER_SESSION: SESSION },
  });
  return {
    ok: r.status === 0,
    status: r.status,
    out: (r.stdout || "") + (r.stderr || ""),
  };
}

function abOk(args, label) {
  const r = ab(args);
  if (!r.ok) log(`FAIL cmd ${label}: ${r.out.slice(0, 400)}`);
  return r;
}

function ensureChrome() {
  let c = ab(["connect", CDP]);
  if (c.ok) return;
  const chromePaths = spawnSync(
    "bash",
    ["-lc", "ls /home/Jashmhta/.agent-browser/browsers/chrome-*/chrome 2>/dev/null | head -1"],
    { encoding: "utf8" },
  );
  const chrome = chromePaths.stdout.trim();
  if (!chrome) throw new Error("Chrome binary not found for agent-browser");
  spawnSync("bash", ["-lc", `fuser -k ${CDP}/tcp 2>/dev/null || true`], {
    encoding: "utf8",
  });
  spawnSync(
    "bash",
    [
      "-lc",
      `mkdir -p ${PROFILE} && "${chrome}" --no-sandbox --disable-dev-shm-usage --headless=new --remote-debugging-port=${CDP} --user-data-dir=${PROFILE} about:blank >/tmp/ab-e2e-chrome-${CDP}.log 2>&1 & echo $!`,
    ],
    { encoding: "utf8" },
  );
  spawnSync("sleep", ["2"]);
  c = ab(["connect", CDP]);
  if (!c.ok) throw new Error("Failed to connect agent-browser to Chrome: " + c.out);
}

function setViewport(mode) {
  if (mode === "mobile") {
    abOk(["set", "viewport", "390", "844"], "viewport-mobile");
  } else {
    abOk(["set", "viewport", "1440", "900"], "viewport-desktop");
  }
}

function snapshot() {
  return ab(["snapshot", "-i"]).out;
}

function getUrl() {
  return ab(["get", "url"]).out.trim();
}

function getText() {
  return ab([
    "eval",
    "document.body ? document.body.innerText.slice(0, 5000) : ''",
  ]).out;
}

function evalJson(js) {
  const raw = ab(["eval", js]).out;
  let s = raw.trim();
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

function record(row) {
  results.push(row);
  const mark = row.pass ? "PASS" : "FAIL";
  log(`${mark} [${row.viewport}/${row.persona}] ${row.step}: ${row.detail || ""}`);
}

function pageHealth(body, url) {
  const has500 = /Application error|Internal Server Error|Something went wrong|Unhandled Runtime Error/i.test(
    body,
  );
  const hasStub = /ModuleStub|production roadmap|Coming soon stub/i.test(body);
  const bouncedLogin = url.includes("/console/login");
  return { has500, hasStub, bouncedLogin };
}

function login(persona, viewport) {
  abOk(["cookies", "clear"], "cookies-clear");
  abOk(["open", `${BASE}/console/login`], "open-login");
  spawnSync("sleep", ["2"]);
  let snap = snapshot();
  if (snap.includes("Binary Capital") || snap.includes("Binary Bonds")) {
    const brandLabel =
      persona.brand === "binarybonds" ? "Binary Bonds" : "Binary Capital";
    ab([
      "eval",
      `(() => {
        const btns = [...document.querySelectorAll('button')];
        const b = btns.find(x => (x.innerText||'').includes(${JSON.stringify(brandLabel)}));
        b?.click();
        return b ? 'clicked' : 'missing';
      })()`,
    ]);
    spawnSync("sleep", ["1.2"]);
  }
  const snap2 = snapshot();
  const emailRef = snap2.match(/textbox "Work email"[^\n]*\[ref=(e\d+)\]/);
  const passRef = snap2.match(/textbox "Password"[^\n]*\[ref=(e\d+)\]/);
  if (emailRef) ab(["fill", `@${emailRef[1]}`, persona.email]);
  else ab(["fill", 'input[name="email"]', persona.email]);
  if (passRef) ab(["fill", `@${passRef[1]}`, persona.password]);
  else ab(["fill", 'input[name="password"]', persona.password]);
  spawnSync("sleep", ["0.3"]);
  ab([
    "eval",
    "document.querySelector('button[type=submit]')?.click(); 'submit'",
  ]);
  spawnSync("sleep", ["5"]);
  let url = getUrl();
  let body = getText();
  if (url.includes("/login")) {
    ab([
      "eval",
      `(() => {
        const brandLabel = ${JSON.stringify(
          persona.brand === "binarybonds" ? "Binary Bonds" : "Binary Capital",
        )};
        const btns = [...document.querySelectorAll('button')];
        const b = btns.find(x => (x.innerText||'').includes(brandLabel));
        b?.click();
        return 'retry-brand';
      })()`,
    ]);
    spawnSync("sleep", ["1"]);
    const snap3 = snapshot();
    const er = snap3.match(/textbox "Work email"[^\n]*\[ref=(e\d+)\]/);
    const pr = snap3.match(/textbox "Password"[^\n]*\[ref=(e\d+)\]/);
    if (er) ab(["fill", `@${er[1]}`, persona.email]);
    if (pr) ab(["fill", `@${pr[1]}`, persona.password]);
    ab([
      "eval",
      "document.querySelector('button[type=submit]')?.click(); 'submit2'",
    ]);
    spawnSync("sleep", ["5"]);
    url = getUrl();
    body = getText();
  }
  const pass =
    url.includes("/console") &&
    !url.includes("/login") &&
    (body.includes("Home") ||
      body.includes("Good") ||
      body.includes("Client") ||
      body.includes("Console") ||
      body.includes("Shray") ||
      body.includes("Yash") ||
      body.includes("Tashmit") ||
      body.includes("Rati") ||
      body.includes("Niraj") ||
      body.includes("Pranjali") ||
      body.includes("Shahrukh") ||
      body.includes("Pipeline") ||
      body.includes("Investor") ||
      body.includes("Desk") ||
      body.includes("Mandate"));
  record({
    viewport,
    persona: persona.id,
    step: "login",
    pass,
    detail: `url=${url} bodyHead=${body.slice(0, 80).replace(/\n/g, " ")}`,
  });
  return pass;
}

function badPasswordEdge(viewport) {
  abOk(["cookies", "clear"], "clear-bad");
  abOk(["open", `${BASE}/console/login`], "open-bad");
  spawnSync("sleep", ["2"]);
  ab([
    "eval",
    `(() => {
      const btns = [...document.querySelectorAll('button')];
      const b = btns.find(x => (x.innerText||'').includes('Binary Capital'));
      b?.click();
      return 'brand';
    })()`,
  ]);
  spawnSync("sleep", ["1"]);
  const snap = snapshot();
  const emailRef = snap.match(/textbox "Work email"[^\n]*\[ref=(e\d+)\]/);
  const passRef = snap.match(/textbox "Password"[^\n]*\[ref=(e\d+)\]/);
  if (emailRef) ab(["fill", `@${emailRef[1]}`, "shray@binarycapital.in"]);
  else ab(["fill", 'input[name="email"]', "shray@binarycapital.in"]);
  if (passRef) ab(["fill", `@${passRef[1]}`, "WrongPassword!!!"]);
  else ab(["fill", 'input[name="password"]', "WrongPassword!!!"]);
  ab([
    "eval",
    "document.querySelector('button[type=submit]')?.click(); 'submit'",
  ]);
  spawnSync("sleep", ["3"]);
  const url = getUrl();
  const body = getText();
  const stayed =
    url.includes("/login") ||
    /invalid|incorrect|failed|wrong|credentials|try again/i.test(body);
  record({
    viewport,
    persona: "anon",
    step: "auth-bad-password",
    pass: stayed,
    detail: `url=${url}`,
  });
}

function checkNav(persona, viewport) {
  const body = getText();
  let pass = true;
  const missing = [];
  for (const n of persona.expectNav) {
    if (n === "Admin" && viewport === "mobile") continue;
    if (!body.includes(n)) {
      pass = false;
      missing.push(`missing:${n}`);
    }
  }
  if (persona.level === "employee") {
    if (body.includes("Create user & credentials")) {
      pass = false;
      missing.push("unexpected:admin-create-form");
    }
    // Admin nav item should not appear as a dedicated nav label for employees
    if (viewport === "desktop" && /\nAdmin\n/.test(body) && body.includes("Create user")) {
      pass = false;
      missing.push("unexpected:Admin-nav");
    }
  }
  record({
    viewport,
    persona: persona.id,
    step: "nav-rbac",
    pass,
    detail: missing.join(",") || "ok",
  });
}

function visitRoutes(persona, viewport) {
  for (const route of persona.routes) {
    ab(["open", `${BASE}${route}`]);
    spawnSync("sleep", ["1.6"]);
    const url = getUrl();
    const body = getText();
    const { has500, hasStub } = pageHealth(body, url);
    let pass = !has500 && !hasStub;
    if (url.includes("/console/login")) pass = false;

    if (route === "/console/admin") {
      if (persona.level === "super_admin") {
        // Super admins should see firm control / create user OR admin heading
        const hasAdminUi =
          body.includes("Create user") ||
          body.includes("Admin") ||
          body.includes("Firm") ||
          body.includes("Users") ||
          body.includes("credentials") ||
          body.includes("Assign");
        pass = pass && hasAdminUi;
        record({
          viewport,
          persona: persona.id,
          step: "admin-surface",
          pass: hasAdminUi,
          detail: hasAdminUi ? "admin-ui-present" : body.slice(0, 100).replace(/\n/g, " "),
        });
      } else {
        // Employees must not see create-user form
        const noCreate = !body.includes("Create user & credentials");
        pass = pass && noCreate;
        record({
          viewport,
          persona: persona.id,
          step: "admin-rbac-deny",
          pass: noCreate,
          detail: noCreate ? "no-create-form" : "LEAKED-create-form",
        });
      }
    }

    // Brand chrome for bonds vs capital on home
    if (route === "/console" && persona.brand === "binarybonds") {
      // Bonds shell should not crash; soft check
      pass = pass && !has500;
    }

    record({
      viewport,
      persona: persona.id,
      step: `route:${route}`,
      pass,
      detail: `url=${url}${has500 ? " ERROR500" : ""}${hasStub ? " STUB" : ""}`,
    });
  }
}

function deepClickThrough(persona, viewport) {
  for (const listRoute of persona.deepClick || []) {
    ab(["open", `${BASE}${listRoute}`]);
    spawnSync("sleep", ["1.8"]);
    const before = getUrl();
    const click = evalJson(`(() => {
      const anchors = [...document.querySelectorAll('a[href*="${listRoute}/"]')];
      const a = anchors.find(x => {
        const h = x.getAttribute('href') || '';
        return h.match(${JSON.stringify(listRoute)} + '/[^/?#]+') && !h.endsWith('/new');
      });
      if (!a) {
        // try row link pattern
        const any = [...document.querySelectorAll('a[href^="/console/"]')].find(x => {
          const h = x.getAttribute('href') || '';
          return h.split('/').length >= 4 && h.includes(${JSON.stringify(listRoute.split("/").pop())});
        });
        if (!any) return {ok:false, reason:'no-detail-link'};
        any.click();
        return {ok:true, href: any.getAttribute('href')};
      }
      a.click();
      return {ok:true, href: a.getAttribute('href')};
    })()`);
    spawnSync("sleep", ["2"]);
    const after = getUrl();
    const body = getText();
    const { has500 } = pageHealth(body, after);
    // Soft pass: either no rows (ok:false reason) OR navigated without 500
    let pass = !has500;
    if (click && click.ok) {
      pass = pass && after !== before && after.includes("/console");
    } else {
      // empty list is acceptable
      pass = true;
    }
    record({
      viewport,
      persona: persona.id,
      step: `deep:${listRoute}`,
      pass,
      detail: JSON.stringify({ click, after: after.slice(0, 120), has500 }),
    });
  }
}

function scrollCheck(viewport) {
  ab(["open", `${BASE}/console/admin`]);
  spawnSync("sleep", ["2"]);
  if (getUrl().includes("login")) return;
  const data = evalJson(`(() => {
    const m = document.querySelector('.c-desk-scroll') || document.querySelector('#main-content');
    if (!m) return {ok:false, reason:'no-main'};
    const can = m.scrollHeight > m.clientHeight + 2;
    m.scrollTop = 200;
    const moved = m.scrollTop >= 50;
    return {ok: can && moved, can, moved, scrollH: m.scrollHeight, clientH: m.clientHeight, top: m.scrollTop};
  })()`);
  record({
    viewport,
    persona: "super_shray",
    step: "scroll-main",
    pass: !!data.ok,
    detail: JSON.stringify(data),
  });
}

function overflowCheck(persona, viewport) {
  ab(["open", `${BASE}/console`]);
  spawnSync("sleep", ["1.5"]);
  const data = evalJson(`(() => {
    const de = document.documentElement;
    const body = document.body;
    const sw = Math.max(de.scrollWidth, body.scrollWidth);
    const cw = de.clientWidth;
    const overflowX = sw > cw + 2;
    const offenders = [];
    if (overflowX) {
      for (const el of document.querySelectorAll('main, aside, nav, header, .c-desk-scroll, [class*="shell"]')) {
        if (el.scrollWidth > el.clientWidth + 4) {
          offenders.push({tag: el.tagName, cls: (el.className||'').toString().slice(0,60), sw: el.scrollWidth, cw: el.clientWidth});
        }
      }
    }
    return {ok: !overflowX, sw, cw, overflowX, offenders: offenders.slice(0,5)};
  })()`);
  record({
    viewport,
    persona: persona.id,
    step: "ux-overflow-x",
    pass: !!data.ok,
    detail: JSON.stringify(data),
  });
}

function shellChromeCheck(persona, viewport) {
  ab(["open", `${BASE}/console`]);
  spawnSync("sleep", ["1.5"]);
  const data = evalJson(`(() => {
    const text = (document.body?.innerText || '').slice(0, 3000);
    const hasDesk =
      !!document.querySelector('.c-desk-scroll') ||
      !!document.querySelector('[data-console]') ||
      text.includes('Console') ||
      text.includes('Home') ||
      text.includes('Client');
    const legacyBounce =
      location.pathname === '/' ||
      location.pathname.startsWith('/dashboard') ||
      text.includes('Get started by editing');
    const hasError = /Application error|Internal Server Error/i.test(text);
    return {ok: hasDesk && !legacyBounce && !hasError, hasDesk, legacyBounce, hasError, path: location.pathname};
  })()`);
  record({
    viewport,
    persona: persona.id,
    step: "shell-chrome",
    pass: !!data.ok,
    detail: JSON.stringify(data),
  });
}

function brandGate(viewport) {
  abOk(["cookies", "clear"], "clear");
  abOk(["open", `${BASE}/console/login`], "open");
  spawnSync("sleep", ["2"]);
  const body = getText();
  const pass =
    body.includes("Binary Capital") &&
    body.includes("Binary Bonds") &&
    (body.includes("Choose desk") ||
      body.includes("brand") ||
      body.includes("Capital") ||
      body.includes("Bonds"));
  record({
    viewport,
    persona: "anon",
    step: "brand-gate",
    pass,
    detail: pass ? "Capital+Bonds visible" : body.slice(0, 120),
  });
  ab(["open", `${BASE}/login`]);
  spawnSync("sleep", ["1.5"]);
  const url = getUrl();
  record({
    viewport,
    persona: "anon",
    step: "legacy-login-redirect",
    pass: url.includes("/console/login"),
    detail: url,
  });
  // Root should not dump users into bare legacy forever
  ab(["open", `${BASE}/`]);
  spawnSync("sleep", ["1.5"]);
  const rootUrl = getUrl();
  const rootBody = getText();
  const rootOk =
    rootUrl.includes("/console") ||
    rootBody.includes("Binary Capital") ||
    rootBody.includes("Console") ||
    rootBody.includes("Choose desk");
  record({
    viewport,
    persona: "anon",
    step: "root-console-default",
    pass: rootOk,
    detail: rootUrl,
  });
}

function dashboardCharts(persona, viewport) {
  ab(["open", `${BASE}/console`]);
  spawnSync("sleep", ["2"]);
  if (getUrl().includes("login")) return;
  const data = evalJson(`(() => {
    const text = document.body?.innerText || '';
    const brand = document.querySelector('.console-root')?.getAttribute('data-brand')
      || document.documentElement.getAttribute('data-brand')
      || '';
    const kpiRoot = document.querySelector('[data-testid="console-home-kpis"]')
      || document.querySelector('[aria-label="Key metrics"]');
    const kpiLabels = kpiRoot
      ? [...kpiRoot.querySelectorAll('p')].map(p => (p.textContent||'').trim()).filter(Boolean)
      : [];
    const hasAllLabels =
      text.includes('Parties in view') &&
      text.includes('Open mandates') &&
      text.includes('Credit in progress') &&
      (text.includes('KYC soon') || text.includes('KYC'));
    const values = [...document.querySelectorAll('.c-kpi-value')].map(el => (el.textContent||'').trim());
    const numericKpis = values.filter(v => /^\\d+$/.test(v)).length >= 3 || values.length >= 3;
    const pipeline = document.querySelector('svg[aria-label="Open deals by pipeline stage"]')
      || document.querySelector('[data-testid="chart-pipeline-stage"]');
    const monthly = document.querySelector('svg[aria-label="Monthly deal count series"]')
      || document.querySelector('[data-testid="chart-monthly-flow"]');
    const pipelineBars = pipeline ? pipeline.querySelectorAll('rect').length : 0;
    const monthlyPts = monthly ? monthly.querySelectorAll('circle').length : 0;
    const emptyStage = text.includes('No stage series yet') || text.includes('No open deals');
    const chartOk = (pipelineBars > 0) || emptyStage || monthlyPts > 0;
    return {
      brand,
      hasAllLabels,
      numericKpis,
      values: values.slice(0, 6),
      pipelineBars,
      monthlyPts,
      emptyStage,
      chartOk,
      greeting: /Good (morning|afternoon|evening)/i.test(text),
      textHasPipeline: text.includes('Pipeline by stage') || text.includes('What needs you'),
    };
  })()`);
  // Brand CTA checks in body
  const body = getText();
  let ctaOk = true;
  let ctaDetail = "ok";
  if (persona.brand === "binarybonds") {
    ctaOk = body.includes("Open matching") || body.includes("matching") || body.includes("Pipeline");
    ctaDetail = ctaOk ? "bonds-cta" : "missing-bonds-cta";
  } else if (persona.brand === "binarycapital") {
    ctaOk =
      body.includes("Client book") ||
      body.includes("Leads") ||
      body.includes("All parties") ||
      body.includes("Admin");
    ctaDetail = ctaOk ? "capital-cta" : "missing-capital-cta";
  }
  const pass =
    !!data.hasAllLabels &&
    !!data.numericKpis &&
    !!data.chartOk &&
    !!data.greeting &&
    ctaOk;
  record({
    viewport,
    persona: persona.id,
    step: "dashboard-charts",
    pass,
    detail: JSON.stringify({ ...data, ctaDetail }),
  });
}

function interactiveFormSmoke(persona, viewport) {
  // Open create surfaces without submitting (mutation safety in shared DB).
  const probes = [];
  if (persona.level === "super_admin" || persona.id.includes("employee")) {
    probes.push({
      route: "/console/parties?new=1",
      step: "form-open:party",
      expect: /legal name|display name|party|nature|Create|New party/i,
    });
    probes.push({
      route: "/console/leads/new",
      step: "form-open:lead",
      expect: /lead|company|contact|BANT|Create|source/i,
    });
    probes.push({
      route: "/console/tasks",
      step: "form-open:task",
      expect: /task|title|assignee|due|Create|New/i,
    });
  }
  if (persona.level === "super_admin") {
    probes.push({
      route: "/console/admin",
      step: "form-open:admin-create",
      expect: /Create user|email|password|credentials|role/i,
    });
  }
  for (const p of probes) {
    ab(["open", `${BASE}${p.route}`]);
    spawnSync("sleep", ["1.5"]);
    const url = getUrl();
    const body = getText();
    const { has500 } = pageHealth(body, url);
    const formish = p.expect.test(body);
    record({
      viewport,
      persona: persona.id,
      step: p.step,
      pass: !has500 && !url.includes("/login") && formish,
      detail: `url=${url} formish=${formish}`,
    });
  }
}

function creditGateEmployee(persona, viewport) {
  if (persona.level !== "employee") return;
  ab(["open", `${BASE}/console/credit`]);
  spawnSync("sleep", ["1.5"]);
  const body = getText();
  const url = getUrl();
  const denied =
    body.includes("Credit module inactive") ||
    body.includes("limited to credit desk") ||
    (url.includes("/console") && !body.includes("analyses · internal"));
  // Strong: must show inactive empty, not full list
  const pass =
    body.includes("Credit module inactive") ||
    body.includes("limited to credit desk") ||
    body.includes("not enabled");
  record({
    viewport,
    persona: persona.id,
    step: "credit-desk-gate",
    pass: !!pass,
    detail: pass ? "denied" : body.slice(0, 120).replace(/\n/g, " "),
  });
}

function exportGateEmployee(persona, viewport) {
  if (persona.level !== "employee") return;
  ab(["open", `${BASE}/reports/export?kind=parties`]);
  spawnSync("sleep", ["1.5"]);
  const body = getText();
  // Next may show plain text body for 403 Response
  const pass =
    /Exports are restricted|restricted to super|403|Forbidden|not authorized|You do not have permission/i.test(
      body,
    );
  record({
    viewport,
    persona: persona.id,
    step: "export-403-employee",
    pass,
    detail: body.slice(0, 120).replace(/\n/g, " "),
  });
}

function runViewport(viewport) {
  log(`=== VIEWPORT ${viewport} BASE=${BASE} CDP=${CDP} ===`);
  setViewport(viewport);
  brandGate(viewport);
  badPasswordEdge(viewport);

  for (const persona of PERSONAS) {
    log(`--- persona ${persona.id} ---`);
    const ok = login(persona, viewport);
    if (!ok) {
      ab(["screenshot", join(OUT, viewport, `${persona.id}-login-fail.png`)]);
      continue;
    }
    checkNav(persona, viewport);
    shellChromeCheck(persona, viewport);
    overflowCheck(persona, viewport);
    dashboardCharts(persona, viewport);
    visitRoutes(persona, viewport);
    deepClickThrough(persona, viewport);
    interactiveFormSmoke(persona, viewport);
    creditGateEmployee(persona, viewport);
    exportGateEmployee(persona, viewport);
    if (persona.id === "super_shray") {
      scrollCheck(viewport);
    }
    ab(["screenshot", join(OUT, viewport, `${persona.id}.png`)]);
    // key module screenshots for first super + first employee per brand
    if (persona.id === "super_shray" || persona.id === "employee_tashmit") {
      for (const r of ["/console/parties", "/console/admin", "/console/deals"]) {
        ab(["open", `${BASE}${r}`]);
        spawnSync("sleep", ["1.2"]);
        const slug = r.replace(/\//g, "_");
        ab(["screenshot", join(OUT, viewport, `${persona.id}${slug}.png`)]);
      }
    }
  }
}

function main() {
  mkdirSync(join(OUT, "desktop"), { recursive: true });
  mkdirSync(join(OUT, "mobile"), { recursive: true });
  mkdirSync(join(OUT, "logs"), { recursive: true });
  writeFileSync(join(OUT, "logs", "e2e-run.log"), "");
  ensureChrome();
  const modes = VP === "all" ? ["desktop", "mobile"] : [VP];
  for (const m of modes) runViewport(m);

  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  const fails = results.filter((r) => !r.pass);
  const summary = {
    base: BASE,
    cdp: CDP,
    out: OUT,
    total: results.length,
    pass,
    fail,
    fails: fails.map((f) => ({
      viewport: f.viewport,
      persona: f.persona,
      step: f.step,
      detail: f.detail,
    })),
    results,
  };
  writeFileSync(join(OUT, "logs", "e2e-summary.json"), JSON.stringify(summary, null, 2));
  log(`DONE total=${results.length} pass=${pass} fail=${fail}`);
  console.log(
    JSON.stringify(
      {
        total: results.length,
        pass,
        fail,
        fails: summary.fails,
      },
      null,
      2,
    ),
  );
  process.exit(fail > 0 ? 1 : 0);
}

main();
