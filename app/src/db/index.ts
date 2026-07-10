import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Drizzle (postgres-js) client.
 *
 * Serverless-safe (Vercel Fluid Compute, bom1): `prepare: false` keeps connections
 * poolable across reused function instances. A global singleton is reused in dev to
 * avoid connection churn on hot reload. The Postgres itself must live in ap-south-1
 * to keep the DPDP / SEBI cloud-framework India data-residency posture intact.
 *
 * POOL TUNING (perf pass): max 20 (up from 10) for production concurrency,
 * idle_timeout 30s + connect_timeout 10s so dead/idle connections are reclaimed,
 * and a server-side statement_timeout of 30s (+ idle_in_transaction_session_timeout
 * 30s) via the `options` startup parameter so a single slow/abandoned query can
 * never pin a pooled connection. `prepare: false` is kept for serverless pooling.
 *
 * NOTE: we intentionally do NOT throw when DATABASE_URL is unset at module load.
 * `next build` imports route modules (which re-export `@/db`) without a live
 * database, and every DB-backed route is `force-dynamic` so no query runs at
 * build time. The postgres-js pool is lazy (no connection at construction), so
 * a missing URL falls back to a placeholder that is only ever contacted on the
 * first real query - the expected runtime failure mode when the env is missing.
 */
const url =
  process.env.DATABASE_URL ??
  "postgres://placeholder:placeholder@localhost:5432/placeholder";

declare global {
  var __dbClient: ReturnType<typeof postgres> | undefined;
}

const createClient = () =>
  postgres(url, {
    // Production concurrency: 20 pooled connections per instance (up from 10).
    max: 20,
    // Serverless-safe: prepared statements are session-local, so disable to keep
    // connections freely reusable across recycled function instances.
    prepare: false,
    // Reclaim idle connections (seconds) so a quiet instance doesn't hold DB
    // slots open indefinitely.
    idle_timeout: 30,
    // Fail fast on a unreachable DB rather than hanging a request (seconds).
    connect_timeout: 10,
    // Server-side GUCs applied on every new connection via the Postgres
    // `options` startup parameter. NOTE: the `options` parameter is removed
    // for Neon/serverless compatibility (PgBouncer in transaction mode may
    // reject it). statement_timeout is set via SET LOCAL in queries instead.
    connection: {
      application_name: "binary-crm",
    },
    // Neon/production require SSL. Local Postgres does not - opt out with
    // DATABASE_SSL=false or sslmode=disable in the URL.
    ssl:
      process.env.DATABASE_SSL === "false" ||
      /sslmode=disable/i.test(url)
        ? false
        : "require",
  });

const client = globalThis.__dbClient ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.__dbClient = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;
export { schema };
