/**
 * Map a legacy CRM path onto a *real* dual-console route.
 *
 * Only prefixes paths that have a shipped console list or [id] page under
 * `src/app/console/(desk)/**`. Unknown or unsupported detail segments fall
 * back to the nearest live console list (or `/console`) — never invents
 * `/console/...` URLs that 404.
 */

/** List/index routes that exist under /console. */
const LIST_ROUTES: Record<string, string> = {
  "/": "/console",
  "/deals": "/console/deals",
  "/parties": "/console/parties",
  "/leads": "/console/leads",
  "/tasks": "/console/tasks",
  "/interactions": "/console/interactions",
  "/documents": "/console/documents",
  "/matching": "/console/matching",
  "/onboarding": "/console/onboarding",
  "/credit": "/console/credit",
  "/modeling": "/console/modeling",
  "/portfolio": "/console/portfolio",
  "/reports": "/console/reports",
  "/notifications": "/console/notifications",
  "/calendar": "/console/calendar",
  "/admin": "/console/admin",
  "/integrations": "/console/integrations",
  "/ai": "/console/ai",
  "/compliance/kyc": "/console/compliance/kyc",
  // No dedicated console consent surface — compliance KYC queue is the live desk.
  "/compliance/consent": "/console/compliance/kyc",
  "/compliance": "/console/compliance/kyc",
  "/portal/client": "/console/portal/client",
  "/portal/investor": "/console/portal/investor",
};

/**
 * Detail patterns: [regex, builder]. Builder receives capture groups after the
 * full match (group 1 = entity id). Only patterns with a real console [id]
 * page are listed.
 */
const DETAIL_PATTERNS: Array<{
  re: RegExp;
  to: (id: string) => string;
}> = [
  { re: /^\/tasks\/([^/?#]+)$/, to: (id) => `/console/tasks/${id}` },
  {
    re: /^\/interactions\/([^/?#]+)$/,
    to: (id) => `/console/interactions/${id}`,
  },
  { re: /^\/deals\/([^/?#]+)$/, to: (id) => `/console/deals/${id}` },
  { re: /^\/parties\/([^/?#]+)$/, to: (id) => `/console/parties/${id}` },
  { re: /^\/leads\/([^/?#]+)$/, to: (id) => `/console/leads/${id}` },
  { re: /^\/credit\/([^/?#]+)$/, to: (id) => `/console/credit/${id}` },
  // legacy workspace path collapses to analysis detail
  {
    re: /^\/credit\/([^/?#]+)\/workspace$/,
    to: (id) => `/console/credit/${id}`,
  },
  { re: /^\/modeling\/([^/?#]+)$/, to: (id) => `/console/modeling/${id}` },
  {
    re: /^\/compliance\/kyc\/([^/?#]+)$/,
    to: (id) => `/console/compliance/kyc/${id}`,
  },
  { re: /^\/matching\/([^/?#]+)$/, to: (id) => `/console/matching/${id}` },
  {
    re: /^\/onboarding\/([^/?#]+)$/,
    to: (id) => `/console/onboarding/${id}`,
  },
  // documents: no console document detail — list only
  { re: /^\/documents\/([^/?#]+)$/, to: () => `/console/documents` },
];

function splitQueryHash(href: string): {
  path: string;
  suffix: string;
} {
  const q = href.search(/[?#]/);
  if (q === -1) return { path: href, suffix: "" };
  return { path: href.slice(0, q), suffix: href.slice(q) };
}

export function toConsoleHref(href: string | null | undefined): string {
  if (!href || href === "#") return "/console";
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("/console")) return href;

  const raw = href.startsWith("/") ? href : `/${href}`;
  const { path, suffix } = splitQueryHash(raw);

  for (const { re, to } of DETAIL_PATTERNS) {
    const m = path.match(re);
    if (m) {
      const id = m[1] ?? "";
      return `${to(id)}${suffix}`;
    }
  }

  if (LIST_ROUTES[path]) {
    return `${LIST_ROUTES[path]}${suffix}`;
  }

  // Strip trailing segment once: /foo/bar/baz → try /foo/bar then /foo
  const parts = path.split("/").filter(Boolean);
  while (parts.length > 0) {
    parts.pop();
    const candidate = parts.length ? `/${parts.join("/")}` : "/";
    if (LIST_ROUTES[candidate]) {
      return `${LIST_ROUTES[candidate]}${suffix}`;
    }
  }

  return `/console${suffix}`;
}

/**
 * Relative page path under `src/app/console` that should exist for a resolved
 * console href (no query/hash). Used by structural tests so mapped targets
 * cannot silently 404.
 *
 * Returns null for `/console` home (layout-served desk home).
 */
export function consolePageRelForHref(consoleHref: string): string | null {
  const { path } = splitQueryHash(
    consoleHref.startsWith("/console")
      ? consoleHref
      : toConsoleHref(consoleHref),
  );
  if (path === "/console" || path === "/console/") {
    return "(desk)/page.tsx";
  }
  if (!path.startsWith("/console/")) return null;

  const rest = path.slice("/console/".length); // e.g. tasks/uuid
  const segs = rest.split("/").filter(Boolean);
  if (segs.length === 0) return "(desk)/page.tsx";

  // login is outside (desk)
  if (segs[0] === "login") return "login/page.tsx";

  const last = segs[segs.length - 1]!;
  const STATIC_LEAVES = new Set([
    "new",
    "export",
    "client",
    "investor",
    "kyc",
  ]);
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  // Dynamic [id] segment when last token is a UUID (or opaque id) and not a
  // known static leaf under that module.
  if (segs.length >= 2 && !STATIC_LEAVES.has(last) && UUID_RE.test(last)) {
    const base = segs.slice(0, -1).join("/");
    return `(desk)/${base}/[id]/page.tsx`;
  }

  return `(desk)/${segs.join("/")}/page.tsx`;
}
