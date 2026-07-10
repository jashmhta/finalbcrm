// Route smoke test - opt-in HTTP check against a running Next server.
//
// This is intentionally NOT a next/test render (which would pull in a DOM
// testing library the deps agent hasn't installed). Instead it fetches the
// real routes and asserts the HTTP shape: /login is public (200), and /parties
// is gated by the proxy/auth layer (redirects to /login or returns 401/403 -
// never 200 with a parties payload to an unauthenticated caller).
//
// Set SMOKE_BASE_URL (e.g. http://localhost:3000) to enable. Without it the
// suite self-skips so `vitest run` stays green in CI without a running app or
// a live Postgres.

import { describe, expect, it } from "vitest";

const baseUrl = process.env.SMOKE_BASE_URL;
const skip = !baseUrl;

const base = baseUrl ?? "http://placeholder.invalid";

// fetch with redirect: "manual" so a 307 to /login surfaces as 3xx rather than
// being followed transparently.
const smokeFetch = (path: string) =>
  fetch(`${base}${path}`, { redirect: "manual" });

describe.skipIf(skip)("route smoke (live server)", () => {
  it("GET /login returns 200 (public surface)", async () => {
    const res = await smokeFetch("/login");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.length).toBeGreaterThan(0);
  });

  it("GET /parties is gated (not an open 200 with party data)", async () => {
    const res = await smokeFetch("/parties");
    // Acceptable auth-gate outcomes: a redirect (307/302 → /login), or an
    // explicit 401/403. A 200 here would mean the proxy/auth wall is missing.
    const gated =
      (res.status >= 300 && res.status < 400) ||
      res.status === 401 ||
      res.status === 403;
    expect(gated).toBe(true);
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location") ?? "";
      expect(loc.toLowerCase()).toContain("login");
    }
  });
});

describe.skipIf(!skip)("route smoke (no server)", () => {
  it("skips when SMOKE_BASE_URL is unset", () => {
    expect(skip).toBe(true);
  });
});
