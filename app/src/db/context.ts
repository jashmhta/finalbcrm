// RLS context helper - sets Postgres session GUCs per-transaction so Row Level
// Security policies on `deal`, `deal_party`, `allocation_event`, `credit_*`,
// `interaction`, `document`, `party` can consult them (ARCHITECTURE §4.4).
//
// GUCs:
//   app.user_id      text         - the acting app_user.user_id (uuid as text)
//   app.wall         text[]       - barrier clearance tags (ABAC compartments)
//   app.mandate_ids  uuid[]       - deals the user is staffed on (mandate scope)
//
// Per §4.4, arrays are set directly as Postgres arrays (ARRAY[...]::text[])
// - NOT as a comma-separated string parsed with string_to_array per row (the
// per-row parse is slower and error-prone on empty/NULL values).
//
// `SET LOCAL` only lasts for the current transaction, so withContext MUST be
// called inside `db.transaction(async (tx) => { await withContext(tx, ...); ... })`.
// The app role should have `FORCE ROW LEVEL SECURITY` on these tables; the
// migration/DBA role (BYPASSRLS) is never used by the application (§4.4).

import { sql } from "drizzle-orm";

import { db } from "@/db";

/** Transaction handle from `db.transaction` (same query API as `db`). */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Set RLS GUCs on a transaction. Call as the FIRST statement inside
 * `db.transaction` so every subsequent query in the txn sees the context.
 *
 * @param tx          the transaction client from db.transaction
 * @param userId      app_user.user_id (uuid, passed as text)
 * @param wallTags    barrier clearance tags (app_user.barrier_clearance)
 * @param mandateIds  deal_ids the user is staffed on (mandate scope)
 */
export async function withContext(
  tx: Tx,
  userId: string,
  wallTags: string[] = [],
  mandateIds: string[] = [],
): Promise<void> {
  // SET LOCAL does NOT accept parameter placeholders ($1) - Postgres utility
  // commands are not parameterized, so drizzle's `sql` template would emit
  // `SET LOCAL app.user_id = $1` and raise a syntax error. The values here are
  // TRUSTED auth context from the JWT (app_user.user_id, barrier_clearance,
  // mandate deal ids - all UUIDs / server-controlled tags), never user input,
  // so we embed them as quoted literals via sql.raw. Single quotes are doubled
  // (the SQL standard escape) so a malformed value can't break out of the
  // literal even in the pathological case.
  //
  // ARRAY GUCs: a custom GUC stores a TEXT value, and the RLS predicates read
  // it back with current_setting('app.wall')::text[]. The value must therefore
  // be the Postgres array-literal TEXT form '{a,b}' (quoted elements for
  // safety), NOT an ARRAY[] constructor - `SET LOCAL app.wall = ARRAY[...]`
  // raises "syntax error at or near ARRAY" because the GUC assignment expects
  // a scalar/coercible-to-text value, and ARRAY[] is not that. '{}' is the
  // valid empty-array text form.
  const lit = (s: string) => `'${String(s).replace(/'/g, "''")}'`;
  // Postgres array-literal TEXT form for a GUC: '{"a","b"}' (or '{}' empty).
  // Each element is double-quoted with backslash-escaping for backslash and
  // double-quote so a value can't break out of its element.
  const textArrLit = (arr: string[]): string => {
    if (arr.length === 0) return `'{}'`;
    const inner = arr
      .map(
        (v) =>
          `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
      )
      .join(",");
    return "'{" + inner + "}'";
  };
  await tx.execute(
    sql`SET LOCAL app.user_id = ${sql.raw(lit(userId))}`,
  );
  await tx.execute(
    sql`SET LOCAL app.wall = ${sql.raw(textArrLit(wallTags))}`,
  );
  await tx.execute(
    sql`SET LOCAL app.mandate_ids = ${sql.raw(textArrLit(mandateIds))}`,
  );
}

/**
 * Run `work` inside a transaction with the RLS context set. Convenience wrapper
 * so callers don't have to remember the SET LOCAL ordering.
 *
 * POST-TRANSACTION GUC CLEANUP: `SET LOCAL` reverts custom GUCs (app.user_id,
 * app.wall, app.mandate_ids) to `''` (the empty-string default for custom
 * GUCs) - NOT NULL - after the transaction commits. The RLS predicate helpers
 * cast `app.wall` / `app.mandate_ids` to text[]/uuid[] inline
 * (`COALESCE(current_setting('app.wall', true)::text[], ...)`), and `''::text[]`
 * throws "malformed array literal: ''". Postgres `OR` does not short-circuit,
 * so even the fail-open branch (`app.user_id IS NULL`) can't prevent the cast
 * from aborting the query. This broke the RSC re-render after every withRls
 * write action (the revalidatePath read pass on a reused pooled connection saw
 * `app.wall = ''` and the RLS function blew up → 500).
 *
 * We cannot set a custom GUC back to NULL (`SET app.user_id = NULL` is a syntax
 * error; `RESET` yields `''`), and the RLS functions are owned by `postgres`
 * (the `crm` app role cannot `CREATE OR REPLACE` them). So the fix is to set
 * the ARRAY GUCs to a valid empty-array literal (`'{}'`) AFTER the transaction,
 * on the same connection, so subsequent reads' array casts succeed. `app.user_id`
 * stays `''` (not NULL) - the fail-open `IS NULL` check won't fire, so walled
 * rows (a small minority: 1.8–13% of rows carry a barrier_id) are hidden on the
 * post-write re-render, but the query SUCCEEDS and returns the unwalled
 * majority. This unblocks every write action's revalidatePath re-render.
 */
export async function withRls<T>(
  userId: string,
  wallTags: string[],
  mandateIds: string[],
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await withContext(tx, userId, wallTags, mandateIds);
    const result = await work(tx);
    // POST-TRANSACTION GUC CLEANUP (runs on the SAME connection as the txn):
    // `SET LOCAL` reverts custom GUCs to `''` (empty string - the default for
    // custom GUCs) - NOT NULL - after the transaction commits. The RLS
    // predicate helpers cast `app.wall` / `app.mandate_ids` to text[]/uuid[]
    // inline (`COALESCE(current_setting('app.wall', true)::text[], ...)`), and
    // `''::text[]` throws "malformed array literal: ''". Postgres `OR` does not
    // short-circuit, so even the fail-open branch can't prevent the cast from
    // aborting the query. This broke the RSC re-render after every withRls
    // write action (revalidatePath read pass on a reused pooled connection saw
    // `app.wall = ''` and the RLS function blew up → 500).
    //
    // We cannot set a custom GUC back to NULL, and the RLS functions are owned
    // by `postgres` (the `crm` app role cannot CREATE OR REPLACE them). So the
    // fix is to set the ARRAY GUCs to a valid empty-array literal (`'{}'`) with
    // `SET` (NOT `SET LOCAL`) as the LAST statement inside the committing
    // transaction - `SET` (without LOCAL) inside a transaction that COMMITS
    // persists as the session-level value for the connection. After commit,
    // `app.wall` / `app.mandate_ids` are `'{}'` (valid), so subsequent reads'
    // array casts succeed. `app.user_id` stays `''` (SET LOCAL reverts it), so
    // the fail-open `IS NULL` check won't fire - walled rows (a small minority:
    // 1.8–13% of rows carry a barrier_id) are hidden on the post-write
    // re-render, but the query SUCCEEDS and returns the unwalled majority.
    // This unblocks every write action's revalidatePath re-render.
    await tx.execute(sql`SET app.wall = '{}'`);
    await tx.execute(sql`SET app.mandate_ids = '{}'`);
    return result;
  });
}

/**
 * Run read work inside a transaction with request-scoped RLS context. Use this
 * for Server Component read paths that need the caller's wall/mandate grants.
 */
export async function withRlsRead<T>(
  userId: string,
  wallTags: string[],
  mandateIds: string[],
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await withContext(tx, userId, wallTags, mandateIds);
    return work(tx);
  });
}
