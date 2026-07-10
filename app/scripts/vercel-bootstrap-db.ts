/**
 * One-shot: push schema + seed org users on Neon / production Postgres.
 * Run after DATABASE_URL is set (local or Vercel pull).
 *
 *   DATABASE_URL=... npx tsx scripts/vercel-bootstrap-db.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of env.split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2];
    }
  } catch {
    /* ignore */
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

console.log("1) drizzle-kit push …");
const push = spawnSync("npx", ["drizzle-kit", "push", "--force"], {
  stdio: "inherit",
  env: process.env,
  cwd: process.cwd(),
});
if (push.status !== 0) process.exit(push.status ?? 1);

console.log("2) seed org users …");
const seed = spawnSync("npx", ["tsx", "src/db/seed-org-users.ts"], {
  stdio: "inherit",
  env: process.env,
  cwd: process.cwd(),
});
if (seed.status !== 0) process.exit(seed.status ?? 1);

console.log("3) seed console mock (optional light) …");
spawnSync("npx", ["tsx", "src/db/seed-console-mock.ts"], {
  stdio: "inherit",
  env: process.env,
  cwd: process.cwd(),
});

console.log("Bootstrap complete. Login: shray@binarycapital.in / BinaryCrm!2026");
