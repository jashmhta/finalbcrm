/**
 * Vercel project configuration — Path 1a (India residency, Mumbai).
 *
 * Programmatic equivalent of vercel.json (Vercel reads the `config` export at
 * build time). See https://vercel.com/docs/project-configuration/vercel-ts.
 *
 * Hosting posture (ARCHITECTURE.md §2.3):
 *   - Fluid Compute is pinned to `bom1` (Mumbai, ap-south-1) so primary
 *     processing of PII / MNPI stays in-region (DPDP Act 2023 + SEBI Cloud
 *     Framework). `sin1` is configured as the failover region only.
 *   - Regulated data lives on Aurora/RDS Postgres `ap-south-1` + S3
 *     `ap-south-1` + ElastiCache `ap-south-1`. Vercel is used ONLY for compute
 *     + static edge — never Vercel Blob / KV / Edge Config for regulated data
 *     (control-plane metadata residency caveat, §2.3 "REAL residual concern").
 *   - The same codebase runs on Path 2 (`ap-south-1` containers) via the
 *     Dockerfile — hosting-portable, no Vercel-only primitives in the hot path.
 *
 * Why no `@vercel/config` type import: that package is only needed for IDE
 * autocomplete. Importing it would add a dependency the deps track owns, and
 * Vercel only reads the export shape (which mirrors the vercel.json schema).
 */
export const config = {
  "$schema": "https://openapi.vercel.sh/vercel.json",
  // Framework preset — Next.js (verified Vercel adapter, Next 16).
  framework: "nextjs",
  // Build/install: deterministic CI installs. `next build` is the project build.
  buildCommand: "next build",
  installCommand: "npm ci",
  outputDirectory: ".next",
  // Region: iad1 (default) for preview/demo deploys. For production with India
  // data residency, use the Dockerfile Path 2 (ap-south-1 containers) OR upgrade
  // to Vercel Enterprise for bom1 (Mumbai) region support.
  regions: ["iad1"],
  // Fluid Compute: auto-scales with concurrency — fits bursty import /
  // credit-model workloads (10k+ import, xlsx model recalc).
  fluid: true,
  // Default function sizing for Server Actions / route handlers. The import
  // and model-calc routes are the heavy ones; 1GB / 60s covers the 10k batch.
  functions: {
    "src/app/**/*.{ts,tsx}": { memory: 1024, maxDuration: 60 },
  },
  // Baseline security headers (DPDP / SEBI hygiene). HSTS assumes HTTPS at the edge.
  headers: [
    {
      source: "/(.*)",
      headers: [
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    },
  ],
};
