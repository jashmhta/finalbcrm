import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the `x-powered-by` response header — removes a minor information leak
  // and a tiny per-response write. Default is true.
  poweredByHeader: false,

  // Keep gzip compression on for `next start` (default true, made explicit so a
  // future edit can't silently disable it). If a reverse proxy (nginx/CDN) is
  // configured to do brotli instead, flip this to false to avoid double work.
  compress: true,

  // Strict Mode is on by default for the app router (since 13.5.1); pinned
  // explicit so the double-invoke dev guard never silently regresses.
  reactStrictMode: true,

  experimental: {
    // @phosphor-icons/react ships thousands of named icon modules from a flat
    // barrel. Named imports tree-shake under Turbopack, but adding the package
    // to optimizePackageImports guarantees only the USED icon modules are
    // evaluated (in both dev and prod) — so the ~80 icons the CRM actually uses
    // are the only ones that ever touch the bundle. recharts is already in the
    // default optimizePackageImports list, so it needs no entry here.
    optimizePackageImports: ["@phosphor-icons/react"],
  },
};

export default nextConfig;
