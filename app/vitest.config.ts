// Vitest configuration — Track B (TESTS).
//
// Scope: pure library units under src/__tests__/. The financial engines
// (bondPricing, ratios, scorecard, ratingMap static mapping) are deterministic
// and side-effect free, so they run in the node environment without a database
// or a running Next server. The route smoke test is opt-in via SMOKE_BASE_URL
// (it fetches a live server) and self-skips otherwise, so `vitest run` stays
// green in CI / without a Postgres.
//
// Path alias `@/*` → `src/*` mirrors tsconfig.json so the engines can be
// imported exactly as the app imports them.

import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(here, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    // next/test-style route tests aren't used here; keep the suite hermetic.
    globals: false,
    // Don't fail on pending/skipped (smoke) tests.
    passWithNoTests: false,
    // Allow the opt-in HTTP smoke test headroom when a live server is present.
    testTimeout: 15_000,
    reporters: ["default"],
  },
});
