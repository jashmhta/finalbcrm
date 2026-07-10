// AI Features - Next-best-action engine (user-scoped).
//
// For the LOGGED-IN user, surface 3-5 prioritized next actions drawn from the
// five coverage-desk attention surfaces:
//   1. Task overdue            - a task assigned to the user past its due date.
//   2. Deal stuck              - a deal the user leads, idle past its stage SLA.
//   3. Credit committee pending - a credit analysis the user owns as analyst,
//                                  awaiting a committee ruling.
//   4. KYC expiring            - a KYC re-KYC approaching due on a party that
//                                  is on one of the user's active deals.
//   5. No recent interaction   - a party on one of the user's active deals
//                                  with no logged interaction in 45 days.
//
// This is distinct from the global workflow notification engine
// (features/workflow/engine.ts), which is firm-wide and not user-scoped. This
// engine produces a small, RANKED, user-personalised set for the AI hub's
// "next best actions" panel - at most one item per kind (the most imminent),
// sorted critical → warning → info, capped at 5.
//
// Deterministic heuristic - no external LLM. Server-only (aggregate queries
// against the live DB, scoped by the user's app_user_id).

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  creditAnalysis,
  deal,
  dealParty,
  interaction,
  kycRecord,
  party,
  task,
} from "@/db/schema";

import {
  AI_PRIORITY_RANK,
  type AiPriority,
  type NextAction,
  type NextActionKind,
} from "./types";

const DAY = 24 * 60 * 60 * 1000;
const DEAL_TERMINAL = ["closed", "dropped"];
const TASK_DONE = ["completed", "cancelled"];
/** Deal-stuck SLA: a mandate idle past this many days is "stuck". */
const DEAL_STUCK_DAYS = 14;
/** Credit committee SLA: an analysis awaiting a ruling past this many days. */
const COMMITTEE_IDLE_DAYS = 5;
/** KYC horizon for the "kyc_expiring" action. */
const KYC_DUE_WINDOW_DAYS = 30;
/** No-recent-interaction threshold. */
const NO_INTERACTION_DAYS = 45;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateIso(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function daysUntil(iso: string, now: number = Date.now()): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.round((t - now) / DAY);
}

function relativeTime(iso: string | null, now: number = Date.now()): string {
  if (!iso) return "-";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "-";
  const diffMs = t - now;
  const past = diffMs <= 0;
  const abs = Math.abs(diffMs);
  const day = Math.round(abs / DAY);
  if (day < 1) return past ? "today" : "today";
  if (day === 1) return past ? "yesterday" : "tomorrow";
  if (day < 30) return past ? `${day} days ago` : `in ${day} days`;
  const month = Math.round(day / 30);
  if (month < 12) return past ? `${month} mo ago` : `in ${month} mo`;
  const year = Math.round(month / 12);
  return past ? `${year} yr ago` : `in ${year} yr`;
}

// ---------------------------------------------------------------------------
// Per-kind scans - each returns the single most-imminent item for the user,
// or null. Bounded WHERE so each scan touches only its window.
// ---------------------------------------------------------------------------

async function scanTaskOverdue(userId: string, now: number): Promise<NextAction | null> {
  const rows = await db
    .select({
      taskId: task.taskId,
      title: task.title,
      dueDate: task.dueDate,
      priority: task.priority,
    })
    .from(task)
    .where(
      and(
        isNull(task.deletedAt),
        eq(task.assigneeUserId, userId),
        sql`${task.dueDate} IS NOT NULL`,
        sql`${task.dueDate} < now()::date`,
        sql`${task.status} IS NULL OR ${task.status}::text <> ALL (ARRAY[${sql.join(TASK_DONE.map((s) => sql`${s}`), sql`, `)}]::text[])`,
      ),
    )
    .orderBy(sql`${task.dueDate} ASC`)
    .limit(1);

  const r = rows[0];
  if (!r) return null;
  const due = toDateIso(r.dueDate);
  if (!due) return null;
  const days = Math.abs(daysUntil(due, now));
  return {
    kind: "task_overdue",
    title: `Task overdue ${days} day${days === 1 ? "" : "s"}: ${r.title}`,
    description: `"${r.title}" passed its due date${r.priority ? ` (priority ${r.priority})` : ""}. Complete it or re-schedule to clear the escalation.`,
    href: `/tasks/${r.taskId}`,
    priority: "critical",
    entityLabel: r.title,
    occurredAt: due,
    relative: relativeTime(due, now),
  };
}

async function scanDealStuck(userId: string, now: number): Promise<NextAction | null> {
  const rows = await db
    .select({
      dealId: deal.dealId,
      dealCode: deal.dealCode,
      dealName: deal.dealName,
      status: deal.status,
      updatedAt: deal.updatedAt,
    })
    .from(deal)
    .where(
      and(
        isNull(deal.deletedAt),
        eq(deal.leadUserId, userId),
        sql`${deal.status} IS NULL OR ${deal.status}::text <> ALL (ARRAY[${sql.join(DEAL_TERMINAL.map((s) => sql`${s}`), sql`, `)}]::text[])`,
        sql`${deal.updatedAt} < now() - make_interval(days => ${DEAL_STUCK_DAYS})`,
      ),
    )
    .orderBy(sql`${deal.updatedAt} ASC`)
    .limit(1);

  const r = rows[0];
  if (!r) return null;
  const at = toDateIso(r.updatedAt);
  if (!at) return null;
  const days = Math.max(1, Math.round((now - new Date(at).getTime()) / DAY));
  const label = r.dealName?.trim() || r.dealCode || "Untitled mandate";
  return {
    kind: "deal_stuck",
    title: `Mandate idle ${days} day${days === 1 ? "" : "s"}: ${label}`,
    description: `Mandate "${label}" hasn't advanced in ${days} days. Chase the issuer, advance the stage, or mark it dropped.`,
    href: `/deals`,
    priority: "warning",
    entityLabel: label,
    occurredAt: at,
    relative: relativeTime(at, now),
  };
}

async function scanCommitteePending(userId: string, now: number): Promise<NextAction | null> {
  const rows = await db
    .select({
      creditAnalysisId: creditAnalysis.creditAnalysisId,
      partyId: creditAnalysis.partyId,
      updatedAt: creditAnalysis.updatedAt,
    })
    .from(creditAnalysis)
    .where(
      and(
        isNull(creditAnalysis.deletedAt),
        isNull(creditAnalysis.validTo),
        isNull(creditAnalysis.supersededBy),
        isNull(creditAnalysis.internalRatingAction),
        eq(creditAnalysis.analystUserId, userId),
        sql`${creditAnalysis.updatedAt} < now() - make_interval(days => ${COMMITTEE_IDLE_DAYS})`,
      ),
    )
    .orderBy(sql`${creditAnalysis.updatedAt} ASC`)
    .limit(1);

  const r = rows[0];
  if (!r) return null;
  const at = toDateIso(r.updatedAt);
  if (!at) return null;
  const days = Math.max(1, Math.round((now - new Date(at).getTime()) / DAY));
  return {
    kind: "credit_committee_pending",
    title: `Committee ruling pending ${days} day${days === 1 ? "" : "s"}`,
    description: "An internal credit analysis you own is awaiting a committee ruling (no internal rating action recorded). Schedule the committee review.",
    href: `/credit/${r.creditAnalysisId}`,
    priority: "warning",
    entityLabel: r.partyId, // resolved to a party name below
    occurredAt: at,
    relative: relativeTime(at, now),
  };
}

/** KYC re-KYC approaching due on a party that is on one of the user's active
 *  deals. Returns the soonest-due such KYC. */
async function scanKycExpiring(userId: string, now: number): Promise<NextAction | null> {
  // Active (non-terminal) deals the user leads → their deal_party parties.
  const dealRows = await db
    .select({ dealId: deal.dealId })
    .from(deal)
    .where(
      and(
        isNull(deal.deletedAt),
        eq(deal.leadUserId, userId),
        sql`${deal.status} IS NULL OR ${deal.status}::text <> ALL (ARRAY[${sql.join(DEAL_TERMINAL.map((s) => sql`${s}`), sql`, `)}]::text[])`,
      ),
    );
  const dealIds = dealRows.map((r) => r.dealId);
  if (dealIds.length === 0) return null;

  const dpRows = await db
    .select({ partyId: dealParty.partyId })
    .from(dealParty)
    .where(
      and(
        isNull(dealParty.deletedAt),
        sql`${dealParty.dealId} = ANY (ARRAY[${sql.join(dealIds.map((id) => sql`${id}::uuid`), sql`, `)}]::uuid[])`,
      ),
    );
  const partyIds = [...new Set(dpRows.map((r) => r.partyId))];
  if (partyIds.length === 0) return null;

  const kycRows = await db
    .select({
      kycRecordId: kycRecord.kycRecordId,
      partyId: kycRecord.partyId,
      rekycDueDate: kycRecord.rekycDueDate,
    })
    .from(kycRecord)
    .where(
      and(
        isNull(kycRecord.deletedAt),
        sql`${kycRecord.partyId} = ANY (ARRAY[${sql.join(partyIds.map((id) => sql`${id}::uuid`), sql`, `)}]::uuid[])`,
        sql`${kycRecord.rekycDueDate} IS NOT NULL`,
        sql`${kycRecord.rekycDueDate} >= now()::date`,
        sql`${kycRecord.rekycDueDate} <= now()::date + ${KYC_DUE_WINDOW_DAYS}::integer`,
      ),
    )
    .orderBy(sql`${kycRecord.rekycDueDate} ASC`)
    .limit(1);

  const r = kycRows[0];
  if (!r) return null;
  const due = toDateIso(r.rekycDueDate);
  if (!due) return null;
  const days = daysUntil(due, now);
  return {
    kind: "kyc_expiring",
    title: `KYC re-KYC due in ${days} day${days === 1 ? "" : "s"}`,
    description: "Risk-based re-KYC periodicity (RBI PMLA) is approaching on a party on one of your active mandates. Initiate the CDD/EDD refresh before the record lapses.",
    href: `/parties/${r.partyId}`,
    priority: "warning",
    entityLabel: r.partyId, // resolved to a party name below
    occurredAt: due,
    relative: relativeTime(due, now),
  };
}

/** A party on one of the user's active deals with no logged interaction in
 *  the last NO_INTERACTION_DAYS. Returns the longest-cold such party. */
async function scanNoRecentInteraction(userId: string, now: number): Promise<NextAction | null> {
  // Active deals the user leads → their parties.
  const dealRows = await db
    .select({ dealId: deal.dealId })
    .from(deal)
    .where(
      and(
        isNull(deal.deletedAt),
        eq(deal.leadUserId, userId),
        sql`${deal.status} IS NULL OR ${deal.status}::text <> ALL (ARRAY[${sql.join(DEAL_TERMINAL.map((s) => sql`${s}`), sql`, `)}]::text[])`,
      ),
    );
  const dealIds = dealRows.map((r) => r.dealId);
  if (dealIds.length === 0) return null;

  const dpRows = await db
    .select({ partyId: dealParty.partyId })
    .from(dealParty)
    .where(
      and(
        isNull(dealParty.deletedAt),
        sql`${dealParty.dealId} = ANY (ARRAY[${sql.join(dealIds.map((id) => sql`${id}::uuid`), sql`, `)}]::uuid[])`,
      ),
    );
  const partyIds = [...new Set(dpRows.map((r) => r.partyId))];
  if (partyIds.length === 0) return null;

  // Last interaction per party (among these parties).
  const lastInteractionRows = await db
    .select({
      partyId: interaction.partyId,
      lastAt: sql<Date>`max(${interaction.occurredAt})`,
    })
    .from(interaction)
    .where(
      and(
        isNull(interaction.deletedAt),
        sql`${interaction.partyId} = ANY (ARRAY[${sql.join(partyIds.map((id) => sql`${id}::uuid`), sql`, `)}]::uuid[])`,
      ),
    )
    .groupBy(interaction.partyId);
  const lastByParty = new Map<string, Date>();
  for (const r of lastInteractionRows) {
    // r.lastAt is typed Date via sql<Date>, but the postgres driver returns
    // the max() aggregate as an ISO string at runtime - normalize to a real
    // Date so the sort comparator's .getTime() (and every other consumer)
    // works instead of throwing "getTime is not a function".
    if (r.partyId && r.lastAt) lastByParty.set(r.partyId, new Date(r.lastAt));
  }

  // Parties with no interaction in the threshold window (or never).
  const cutoff = now - NO_INTERACTION_DAYS * DAY;
  const coldPartyIds: string[] = [];
  for (const pid of partyIds) {
    const last = lastByParty.get(pid);
    if (!last || new Date(last).getTime() < cutoff) coldPartyIds.push(pid);
  }
  if (coldPartyIds.length === 0) return null;

  // Pick the longest-cold: sort by last interaction ascending (never → first).
  coldPartyIds.sort((a, b) => {
    const ta = lastByParty.get(a)?.getTime() ?? 0;
    const tb = lastByParty.get(b)?.getTime() ?? 0;
    return ta - tb;
  });
  const partyId = coldPartyIds[0];
  const last = lastByParty.get(partyId);
  const at = last ? toDateIso(last) ?? new Date(cutoff).toISOString() : new Date(0).toISOString();
  const days = last
    ? Math.max(NO_INTERACTION_DAYS, Math.round((now - new Date(last).getTime()) / DAY))
    : 0;
  return {
    kind: "no_recent_interaction",
    title: days === 0
      ? "No interaction on record for a live mandate"
      : `No interaction in ${days} day${days === 1 ? "" : "s"} on a live mandate`,
    description: "A party on one of your active mandates has gone quiet. Log a check-in to keep the relationship warm and the mandate moving.",
    href: `/parties/${partyId}`,
    priority: "info",
    entityLabel: partyId, // resolved to a party name below
    occurredAt: at,
    relative: relativeTime(at, now),
  };
}

// ---------------------------------------------------------------------------
// Resolve placeholder party labels → party legal names (one batched query).
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolvePartyLabels(actions: NextAction[]): Promise<void> {
  const partyIds = new Set<string>();
  for (const a of actions) {
    if (UUID_RE.test(a.entityLabel)) partyIds.add(a.entityLabel);
  }
  if (partyIds.size === 0) return;
  const rows = await db
    .select({ partyId: party.partyId, legalName: party.legalName, displayName: party.displayName })
    .from(party)
    .where(
      and(
        sql`${party.partyId} = ANY (ARRAY[${sql.join([...partyIds].map((id) => sql`${id}::uuid`), sql`, `)}]::uuid[])`,
        isNull(party.deletedAt),
      ),
    );
  const nameByParty = new Map<string, string>();
  for (const r of rows) {
    nameByParty.set(r.partyId, (r.displayName?.trim() || r.legalName) ?? "Unknown party");
  }
  for (const a of actions) {
    if (UUID_RE.test(a.entityLabel)) {
      const name = nameByParty.get(a.entityLabel) ?? "Unknown party";
      // Rewrite the title to include the resolved name when it was a placeholder.
      if (a.kind === "credit_committee_pending") {
        a.title = `Committee ruling pending - ${name}`;
      } else if (a.kind === "kyc_expiring") {
        const days = daysUntil(a.occurredAt);
        a.title = `KYC re-KYC due in ${days} day${days === 1 ? "" : "s"} - ${name}`;
      } else if (a.kind === "no_recent_interaction") {
        a.title = a.title.replace("a live mandate", name);
      }
      a.entityLabel = name;
    }
  }
}

// ---------------------------------------------------------------------------
// getNextActions - the user-scoped entry point.
// ---------------------------------------------------------------------------

export interface NextActionsResult {
  actions: NextAction[];
  userId: string;
}

/** Surface 3-5 prioritized next-best-actions for the logged-in user. At most
 *  one item per kind (the most imminent), sorted critical → warning → info.
 *  Returns fewer than 5 when some kinds have no outstanding items. */
export async function getNextActions(
  userId: string | null,
  opts: { limit?: number } = {},
): Promise<NextActionsResult> {
  if (!userId) return { actions: [], userId: "" };
  const now = Date.now();
  const limit = opts.limit ?? 5;

  const [taskOverdue, dealStuck, committeePending, kycExpiring, noInteraction] =
    await Promise.all([
      scanTaskOverdue(userId, now),
      scanDealStuck(userId, now),
      scanCommitteePending(userId, now),
      scanKycExpiring(userId, now),
      scanNoRecentInteraction(userId, now),
    ]);

  const all = [taskOverdue, dealStuck, committeePending, kycExpiring, noInteraction].filter(
    (a): a is NextAction => a !== null,
  );

  await resolvePartyLabels(all);

  // Sort by priority rank (critical → info), then by absolute distance from
  // now ascending so the most-imminent item leads within each priority.
  all.sort((a, b) => {
    const s = AI_PRIORITY_RANK[a.priority] - AI_PRIORITY_RANK[b.priority];
    if (s !== 0) return s;
    const nowMs = Date.now();
    return (
      Math.abs(new Date(a.occurredAt).getTime() - nowMs) -
      Math.abs(new Date(b.occurredAt).getTime() - nowMs)
    );
  });

  return { actions: all.slice(0, limit), userId };
}
