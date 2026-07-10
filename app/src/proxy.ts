// Next.js 16 Proxy - the renamed, Node.js-runtime successor to `middleware.ts`.
// See node_modules/next/dist/docs/01-app/.../proxy.md: "Starting with Next.js
// 16, Middleware is now called Proxy." The file convention is `proxy.ts` at the
// same level as `app/` (i.e. in `src/` for this project), and the exported
// function is `proxy` (named) or a default export.
//
// RESPONSIBILITY: COARSE auth only - redirect unauthenticated users to
// /login and bounce already-authenticated users off /login. RBAC enforcement
// (can()) runs SERVER-SIDE in each route/server-action; the proxy cannot see
// DB row compartments, so it must not be the only control (ARCHITECTURE
// §4.6). RLS (SET LOCAL app.user_id / app.wall / app.mandate_ids) is the
// authoritative data-level control.
//
// `auth` (from @/lib/auth) used as a proxy wrapper decodes the JWT cookie and
// exposes `req.auth`. With the JWT session strategy this is a pure cookie
// decode - no DB/adapter access in the hot path.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/console/login"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Auth.js API routes (signin/signout/callback/session) handle their own
  // redirects - pass them through untouched.
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const isLoggedIn = !!req.auth;

  // Always send legacy /login to the brand-first console gate (Capital | Bonds).
  if (!isLoggedIn && pathname === "/login") {
    const url = new URL("/console/login", req.nextUrl);
    const cb = req.nextUrl.searchParams.get("callbackUrl");
    if (cb && cb.startsWith("/")) {
      url.searchParams.set(
        "callbackUrl",
        cb.startsWith("/console") ? cb : "/console",
      );
    }
    return NextResponse.redirect(url);
  }

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!isLoggedIn && !isPublic) {
    // Default unauthenticated users into the console brand gate.
    const url = new URL("/console/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname.startsWith("/console") ? pathname : "/console");
    return NextResponse.redirect(url);
  }

  // Authenticated users hitting login or bare root land on the console desk
  // (never the legacy / command center at /).
  if (
    isLoggedIn &&
    (pathname === "/login" ||
      pathname === "/console/login" ||
      pathname === "/")
  ) {
    return NextResponse.redirect(new URL("/console", req.nextUrl));
  }

  // Help root layout detect console routes (optional header).
  const res = NextResponse.next();
  res.headers.set("x-pathname", pathname);
  return res;
});

export const config = {
  // Run on everything except Auth.js API routes, Next internals, and static
  // assets. The proxy still runs on /_next/data/* routes by design (so
  // protected pages' data routes are guarded too).
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
