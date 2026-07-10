// RLS apply + verify helper (Track B / RLS).
//
// Pairs with drizzle/0003_rls.sql. The migration provisions:
//   - a non-superuser, non-BYPASSRLS app role `crm_app`;
//   - ENABLE + FORCE ROW LEVEL SECURITY on the 16 walled tables;
//   - GUC-driven policies (app.user_id, app.wall text[], app.mandate_ids uuid[]);
//   - an immutable, tamper-evident audit_log (INSERT-only + sha256 hash chain);
//   - GRANTs: SELECT/INSERT/UPDATE on operational tables, INSERT-only on
//     audit_log.
//
// `applyRlsMigration()` reads the SQL file and executes it statement-by-statement
// via the app's `db` connection (which authenticates as the table OWNER, `crm`).
// The owner can apply the policy / trigger / GRANT layer; the CREATE ROLE +
// CREATE EXTENSION statements at the top of the file require a DBA (superuser)
// one-time and will error when run from Node - they are tolerated (reported as
// `skipped`) so the helper is safely re-runnable for the policy layer.
//
// `verifyRls()` introspects the catalog and runs a wall-filter smoke test,
// returning a structured report. It is safe to call from a Node script or a
// `force-dynamic` route.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "drizzle-orm";

import { db } from "@/db";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = join(__dirname, "..", "..", "drizzle", "0003_rls.sql");

/** Tables that must have ENABLE + FORCE ROW LEVEL SECURITY. */
export const WALLED_TABLES = [
  "party",
  "deal",
  "deal_party",
  "interaction",
  "interaction_attendee",
  "document",
  "credit_analysis",
  "financial_model",
  "allocation_event",
  "trade_event",
  "kyc_record",
  "consent_record",
  "external_rating",
  "exposure",
  "credit_limit",
  "audit_log",
] as const;

export type RlsTableStatus = {
  table: string;
  rlsEnabled: boolean;
  rlsForced: boolean;
  policyCount: number;
};

export type RlsVerifyReport = {
  crmAppRoleExists: boolean;
  crmAppBypassRls: boolean;
  pgcryptoInstalled: boolean;
  auditLogChainTrigger: boolean;
  auditLogImmutableTrigger: boolean;
  auditLogInsertOnly: boolean;
  tables: RlsTableStatus[];
  wallSmokeTest: {
    ok: boolean;
    detail: string;
  };
};

/**
 * Split a SQL script into individual statements, respecting:
 *   - single-quoted string literals ('' escape)
 *   - dollar-quoted blocks ($tag$ ... $tag$)
 *   - line comments (-- ...) and block comments (slash-star ... star-slash)
 * Trailing whitespace/semicolons are stripped; empty statements are dropped.
 */
function splitSql(script: string): string[] {
  const stmts: string[] = [];
  let buf = "";
  let i = 0;
  let inSingle = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag: string | null = null;

  const isIdentChar = (c: string) => /[A-Za-z0-9_]/.test(c);

  while (i < script.length) {
    const c = script[i];
    const next = script[i + 1] ?? "";

    if (dollarTag) {
      buf += c;
      if (c === "$") {
        // Try to match the closing $tag$.
        const tagEnd = script.indexOf(`$${dollarTag}$`, i);
        if (tagEnd === i) {
          buf += `${dollarTag}$`;
          i += dollarTag.length + 2;
          dollarTag = null;
          continue;
        }
      }
      i++;
      continue;
    }

    if (inLineComment) {
      buf += c;
      if (c === "\n") inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      buf += c;
      if (c === "*" && next === "/") {
        buf += "/";
        i += 2;
        inBlockComment = false;
        continue;
      }
      i++;
      continue;
    }
    if (inSingle) {
      buf += c;
      if (c === "'") {
        if (next === "'") {
          buf += "'";
          i += 2;
          continue;
        }
        inSingle = false;
      }
      i++;
      continue;
    }

    if (c === "-" && next === "-") {
      inLineComment = true;
      buf += "--";
      i += 2;
      continue;
    }
    if (c === "/" && next === "*") {
      inBlockComment = true;
      buf += "/*";
      i += 2;
      continue;
    }
    if (c === "'") {
      inSingle = true;
      buf += c;
      i++;
      continue;
    }
    if (c === "$") {
      // Detect $tag$ opener.
      let j = i + 1;
      let tag = "";
      while (j < script.length && isIdentChar(script[j])) {
        tag += script[j];
        j++;
      }
      if (j < script.length && script[j] === "$") {
        dollarTag = tag;
        buf += `$${tag}$`;
        i = j + 1;
        continue;
      }
    }
    if (c === ";") {
      const trimmed = buf.trim();
      if (trimmed.length > 0) stmts.push(trimmed);
      buf = "";
      i++;
      continue;
    }
    buf += c;
    i++;
  }
  const tail = buf.trim();
  if (tail.length > 0) stmts.push(tail);
  return stmts;
}

/**
 * Apply (or re-apply) drizzle/0003_rls.sql from Node.
 *
 * Statements that require DBA privileges (CREATE EXTENSION pgcrypto, the
 * CREATE ROLE DO-block) are reported as `skipped` when the caller lacks the
 * privilege - the policy / trigger / GRANT layer still applies cleanly because
 * the app's `db` connection authenticates as the table owner (`crm`).
 *
 * @returns per-statement outcome list.
 */
export async function applyRlsMigration(): Promise<
  { statement: string; ok: boolean; skipped?: boolean; error?: string }[]
> {
  const script = await readFile(MIGRATION_PATH, "utf8");
  const statements = splitSql(script);
  const results: { statement: string; ok: boolean; skipped?: boolean; error?: string }[] = [];

  for (const stmt of statements) {
    const head = stmt.slice(0, 60).replace(/\s+/g, " ");
    try {
      await db.execute(sql.raw(stmt));
      results.push({ statement: head, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const skipped =
        /CREATE ROLE|CREATE EXTENSION|pgcrypto|must be superuser|CREATEROLE/i.test(
          msg,
        ) || /^DO\b/i.test(stmt.trim());
      results.push({ statement: head, ok: false, skipped, error: msg });
    }
  }
  return results;
}

/**
 * Introspect the catalog and run a wall smoke test as the current `db` user.
 * Returns a structured report suitable for a /health/rls route or a CI script.
 */
export async function verifyRls(): Promise<RlsVerifyReport> {
  const roleRow = await db.execute<{ exists: boolean; bypass: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_app') AS exists,
           (SELECT rolbypassrls FROM pg_roles WHERE rolname = 'crm_app') AS bypass
  `);
  const crmAppRoleExists = Boolean(roleRow[0]?.exists);
  const crmAppBypassRls = Boolean(roleRow[0]?.bypass);

  const extRow = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') AS exists
  `);
  const pgcryptoInstalled = Boolean(extRow[0]?.exists);

  const triggerRow = await db.execute<{ chain: boolean; immutable: boolean }>(sql`
    SELECT
      EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_log_chain') AS chain,
      EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_log_no_update_delete') AS immutable
  `);
  const auditLogChainTrigger = Boolean(triggerRow[0]?.chain);
  const auditLogImmutableTrigger = Boolean(triggerRow[0]?.immutable);

  // INSERT-only check: crm_app must have INSERT and must NOT have UPDATE/DELETE
  // on audit_log. (postgres-js returns columns under their snake_case names.)
  const grantRow = await db.execute<{
    can_insert: boolean;
    can_update: boolean;
    can_delete: boolean;
  }>(sql`
    SELECT
      bool_or(has_table_privilege('crm_app', 'audit_log', 'INSERT')) AS can_insert,
      bool_or(has_table_privilege('crm_app', 'audit_log', 'UPDATE')) AS can_update,
      bool_or(has_table_privilege('crm_app', 'audit_log', 'DELETE')) AS can_delete
  `);
  const auditLogInsertOnly =
    Boolean(grantRow[0]?.can_insert) &&
    !Boolean(grantRow[0]?.can_update) &&
    !Boolean(grantRow[0]?.can_delete);

  const tableRows = await db.execute<{
    relname: string;
    relrowsecurity: boolean;
    relforcerowsecurity: boolean;
    policy_count: number;
  }>(sql`
    SELECT c.relname,
           c.relrowsecurity,
           c.relforcerowsecurity,
           COALESCE(p.cnt, 0) AS policy_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN (SELECT polrelid, count(*) AS cnt
               FROM pg_policy GROUP BY polrelid) p ON p.polrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relname = ANY(ARRAY[${sql.join(
        WALLED_TABLES.map((t) => sql`${t}`),
        sql`, `,
      )}]::text[])
  `);

  const byName = new Map(tableRows.map((r) => [r.relname, r]));
  const tables: RlsTableStatus[] = WALLED_TABLES.map((table) => {
    const r = byName.get(table);
    return {
      table,
      rlsEnabled: Boolean(r?.relrowsecurity),
      rlsForced: Boolean(r?.relforcerowsecurity),
      policyCount: Number(r?.policy_count ?? 0),
    };
  });

  // Wall smoke test. The owner role (`crm`) is itself subject to FORCE RLS, so
  // it cannot see barriered party rows without a wall - discover a barrier from
  // the non-walled `information_barrier` registry (party-walls have party_id
  // set), then set app.wall in a transaction and confirm filtering: rows in the
  // picked barrier become visible, rows in any other barrier stay hidden.
  const pickRow = await db.execute<{ barrier_id: string }>(sql`
    SELECT barrier_id::text
    FROM information_barrier
    WHERE party_id IS NOT NULL
      AND is_active
      AND deleted_at IS NULL
    LIMIT 1
  `);
  const pickedBarrier = pickRow[0]?.barrier_id ?? null;

  let ok = false;
  let detail =
    pickedBarrier === null
      ? "no party-walled barrier present to test"
      : `picked=${pickedBarrier} (test not run)`;

  if (pickedBarrier !== null && /^[0-9a-f-]{36}$/i.test(pickedBarrier)) {
    const result = await db.transaction(async (tx) => {
      // SET LOCAL only accepts string-literal values (no $1 params, no
      // ARRAY[...] expressions), so array GUCs are set as Postgres array-literal
      // strings: app.wall = '{uuid}', app.mandate_ids = '{}'. `pickedBarrier`
      // is a UUID read straight from information_barrier and regex-validated
      // above - safe to embed.
      await tx.execute(
        sql.raw(`SET LOCAL app.user_id = '00000000-0000-0000-0000-000000000000'`),
      );
      await tx.execute(
        sql.raw(`SET LOCAL app.wall = '{${pickedBarrier}}'`),
      );
      await tx.execute(sql.raw(`SET LOCAL app.mandate_ids = '{}'`));
      return tx.execute<{ in_wall: number; out_wall: number; total: number }>(
        sql`
          SELECT
            count(*) FILTER (WHERE barrier_id = ${pickedBarrier}::uuid) AS in_wall,
            count(*) FILTER (WHERE barrier_id IS NOT NULL
                             AND barrier_id <> ${pickedBarrier}::uuid) AS out_wall,
            count(*) AS total
          FROM party
        `,
      );
    });
    const inWall = Number(result[0]?.in_wall ?? 0);
    const outWall = Number(result[0]?.out_wall ?? 0);
    // Pass: at least the picked barrier's parties are visible AND no other
    // barrier's parties leak through.
    ok = inWall >= 1 && outWall === 0;
    detail = `picked=${pickedBarrier} in_wall=${inWall} out_wall=${outWall} (expect in_wall>=1, out_wall=0)`;
  }

  return {
    crmAppRoleExists,
    crmAppBypassRls,
    pgcryptoInstalled,
    auditLogChainTrigger,
    auditLogImmutableTrigger,
    auditLogInsertOnly,
    tables,
    wallSmokeTest: { ok, detail },
  };
}
