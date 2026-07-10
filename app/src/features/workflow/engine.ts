// Workflow Automation - the notification trigger engine.
//
// `generateNotifications(db)` scans live tables for workflow trigger
// conditions and returns a typed, serializable Notification[]. Nothing is
// persisted: the set is recomputed fresh on every load (the MVP stores only
// read/dismissed state in a cookie - see queries.ts / actions.ts). A
// notification naturally disappears when its trigger condition clears (the
// overdue task is completed, the stuck deal advances, the expired KYC is
// re-run), so the center never shows stale alerts.
//
// The scan is BOUNDED + BATCHED - each trigger is one targeted query whose
// WHERE limits to the trigger window (only kyc records within 30 days / past
// due, only deals idle > 14d, only tasks overdue / due-soon, only current
// credit analyses idle > 5d, only withdrawn consents), then party display
// names are resolved in a single batched query. No N+1.
//
// Triggers are accurate for an Indian bond house / IB:
//   • KYC re-KYC due / expired  → RBI PMLA risk-based periodicity
//     (kyc_record.rekyc_due_date, trigger-maintained = valid_until − risk lead).
//   • Deal stuck                → a mandate idle past its stage SLA (14d).
//   • Credit committee pending  → an internal credit analysis with no
//     internal_rating_action yet (committee hasn't ruled), idle > 5d.
//   • Task overdue / due soon   → desk tasks past / approaching due_date.
//   • Consent withdrawn         → a DPDP consent revoked
//     (consent_record.consent_withdrawn_at IS NOT NULL).
//   • Duplicate party           → an open party_duplicate_candidate needs a
//     merge/reject/defer decision before the master ledger pollutes downstream
//     leads, interactions, deals and KYC.
//
// Every query runs against the shared `db` client. RLS is fail-open on the
// read path (migration 0004), so no GUC context is required for these reads
// - the same posture as the leads/matching read paths.

import { and, eq, isNull, or, sql, type SQL } from "drizzle-orm";

import { db as defaultDb } from "@/db";
import { can, type CrmUser } from "@/lib/rbac";
import {
  consentRecord,
  creditAnalysis,
  deal,
  kycRecord,
  party,
  partyDuplicateCandidate,
  task,
} from "@/db/schema";

import {
  notificationId,
  type Notification,
  type NotificationType,
} from "./types";

/** The Drizzle client shape (the shared `db` export). Accepting it as a
 *  parameter honors the `generateNotifications(db)` signature from the spec
 *  while defaulting to the app's shared client for ergonomic call sites. */
type Db = typeof defaultDb;

export interface NotificationEngineOptions {
  limit?: number;
  offset?: number;
  user?: CrmUser | null;
}

const DAY = 24 * 60 * 60 * 1000;

/** Terminal deal statuses - a closed/dropped mandate is never "stuck". */
const DEAL_TERMINAL = ["closed", "dropped"];
/** Completed/cancelled tasks have no overdue/due-soon signal. */
const TASK_DONE = ["completed", "cancelled"];

// ---------------------------------------------------------------------------
// generateNotifications - the seven triggers
// ---------------------------------------------------------------------------

/**
 * Scan operational tables for trigger conditions and return the typed notification set, sorted
 * critical-first then by most-recent trigger instant. Safe to call from any
 * Server Component / server action.
 *
 * PAGINATION: `opts.limit` / `opts.offset` slice the SORTED set so callers can
 * bound what they render without re-running the scans. The scans themselves
 * are already bounded (each trigger's WHERE narrows to its window), so the
 * expensive part is the RENDER of thousands of cards, not the generation.
 * `getNotificationsAndStats({ limit })` generates the full set once (for
 * accurate severity stats), then hands the page a sliced window - stats stay
 * true to the full outstanding workload while the rendered list stays light.
 * Default (no opts) returns the full sorted set, preserving the existing
 * `generateNotifications(db)` + `generateNotifications()` call sites (the
 * bell, getUnreadCount, markAllAsRead).
 */
export async function generateNotifications(
  db: Db = defaultDb,
  opts: NotificationEngineOptions = {},
): Promise<Notification[]> {
  const scope = notificationScope(opts.user);
  // Run the seven scans concurrently - they touch disjoint tables, so a
  // Promise.all fans them out in one round-trip batch against the pool.
  const [
    kycExpiring,
    kycExpired,
    dealsStuck,
    creditPending,
    tasksOverdue,
    tasksDueSoon,
    consentWithdrawn,
    partyDuplicates,
  ] = await Promise.all([
    scanKycExpiring(db, scope),
    scanKycExpired(db, scope),
    scanDealsStuck(db, scope),
    scanCreditPending(db, scope),
    scanTasksOverdue(db, scope),
    scanTasksDueSoon(db, scope),
    scanConsentWithdrawn(db, scope),
    scanPartyDuplicates(db, scope),
  ]);

  const all = [
    ...kycExpiring,
    ...kycExpired,
    ...dealsStuck,
    ...creditPending,
    ...tasksOverdue,
    ...tasksDueSoon,
    ...consentWithdrawn,
    ...partyDuplicates,
  ];

  // Resolve party display names in ONE batched query (KYC / credit / consent
  // all reference party_id; deal + task carry their own labels).
  await attachPartyLabels(db, all);

  // Sort: critical first, then warning, then info; within a severity, the
  // most-recent trigger instant first. For past-due triggers "most recent"
  // = the largest occurredAt (closest to today); for future triggers it's the
  // soonest deadline - both surface the most actionable item at the top of
  // its severity bucket.
  const rank: Record<Notification["severity"], number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  all.sort((a, b) => {
    const s = rank[a.severity] - rank[b.severity];
    if (s !== 0) return s;
    // Within severity, overdue (past) items first by recency, then upcoming
    // items by soonest. Sort by absolute distance from now ascending so the
    // most-imminent/just-breached item leads.
    const now = Date.now();
    return Math.abs(new Date(a.occurredAt).getTime() - now) -
      Math.abs(new Date(b.occurredAt).getTime() - now);
  });

  // Apply the pagination window to the SORTED set. The full set was already
  // computed (for stats + the bell + markAllAsRead), so slicing here is a
  // cheap JS operation - the scans are not re-run.
  const offset = Math.max(0, opts.offset ?? 0);
  if (opts.limit != null && Number.isFinite(opts.limit)) {
    const limit = Math.max(0, Math.floor(opts.limit));
    return all.slice(offset, offset + limit);
  }
  if (offset > 0) return all.slice(offset);
  return all;
}

function canReadAllNotifications(
  user?: Pick<CrmUser, "roles" | "permissions"> | null,
) {
  return (
    !user ||
    user.roles.includes("admin") ||
    user.roles.includes("super_admin") ||
    can(user, "read_all", "notification") ||
    can(user, "manage", "user")
  );
}

function notificationScope(user?: CrmUser | null) {
  const userId = user?.appUserId ?? null;
  return {
    userId,
    readAll: canReadAllNotifications(user),
  };
}

type NotificationScope = ReturnType<typeof notificationScope>;

function partyScopeClause(scope: NotificationScope): SQL | undefined {
  if (scope.readAll || !scope.userId) return undefined;
  return or(
    eq(party.assignedUserId, scope.userId),
    eq(party.dataOwnerUserId, scope.userId),
    eq(party.createdByUserId, scope.userId),
  );
}

function dealScopeClause(scope: NotificationScope): SQL | undefined {
  if (scope.readAll || !scope.userId) return undefined;
  return or(
    eq(deal.leadUserId, scope.userId),
    eq(deal.creditAnalystUserId, scope.userId),
    eq(deal.createdByUserId, scope.userId),
    sql`EXISTS (
      SELECT 1
      FROM deal_party dp_scope
      JOIN party p_scope ON p_scope.party_id = dp_scope.party_id
      WHERE dp_scope.deal_id = ${deal.dealId}
        AND dp_scope.deleted_at IS NULL
        AND p_scope.deleted_at IS NULL
        AND (
          p_scope.assigned_user_id = ${scope.userId}
          OR p_scope.data_owner_user_id = ${scope.userId}
          OR p_scope.created_by_user_id = ${scope.userId}
        )
    )`,
  );
}

function taskScopeClause(scope: NotificationScope): SQL | undefined {
  if (scope.readAll || !scope.userId) return undefined;
  return or(
    eq(task.assigneeUserId, scope.userId),
    eq(task.createdByUserId, scope.userId),
    eq(deal.leadUserId, scope.userId),
    eq(deal.creditAnalystUserId, scope.userId),
    eq(deal.createdByUserId, scope.userId),
    eq(party.assignedUserId, scope.userId),
    eq(party.dataOwnerUserId, scope.userId),
    eq(party.createdByUserId, scope.userId),
  );
}

function duplicateScopeClause(scope: NotificationScope): SQL | undefined {
  if (scope.readAll || !scope.userId) return undefined;
  return sql`EXISTS (
    SELECT 1
    FROM party p_scope
    WHERE p_scope.party_id IN (
      ${partyDuplicateCandidate.sourcePartyId},
      ${partyDuplicateCandidate.candidatePartyId}
    )
      AND p_scope.deleted_at IS NULL
      AND (
        p_scope.assigned_user_id = ${scope.userId}
        OR p_scope.data_owner_user_id = ${scope.userId}
        OR p_scope.created_by_user_id = ${scope.userId}
      )
  )`;
}

// ---------------------------------------------------------------------------
// KYC - re-KYC due soon (warning) + expired (critical)
// ---------------------------------------------------------------------------

/** KYC re-KYC due in the next 30 days (warning). RBI PMLA risk-based
 *  periodicity: rekyc_due_date is trigger-maintained = valid_until − a
 *  risk-rated lead time, so this is the canonical "re-KYC is coming due"
 *  signal. Excludes already-expired (those surface as critical). */
async function scanKycExpiring(
  db: Db,
  scope: NotificationScope,
): Promise<Notification[]> {
  const rows = await db
    .select({
      kycRecordId: kycRecord.kycRecordId,
      partyId: kycRecord.partyId,
      rekycDueDate: kycRecord.rekycDueDate,
      status: kycRecord.status,
      riskRating: kycRecord.riskRating,
    })
    .from(kycRecord)
    .innerJoin(party, eq(party.partyId, kycRecord.partyId))
    .where(
      and(
        isNull(kycRecord.deletedAt),
        isNull(party.deletedAt),
        partyScopeClause(scope),
        sql`${kycRecord.rekycDueDate} IS NOT NULL`,
        // Today .. today+30 (date + integer ⇒ date in Postgres).
        sql`${kycRecord.rekycDueDate} >= now()::date`,
        sql`${kycRecord.rekycDueDate} <= now()::date + 30`,
      ),
    );

  const out: Notification[] = [];
  for (const r of rows) {
    const due = toDateIso(r.rekycDueDate);
    if (!due) continue;
    const days = daysUntil(due);
    out.push({
      id: notificationId("kyc_expiring", r.kycRecordId),
      type: "kyc_expiring",
      severity: "warning",
      title: `KYC re-KYC due in ${days} day${days === 1 ? "" : "s"}`,
      description:
        "Risk-based re-KYC periodicity (RBI PMLA) is approaching. Initiate CDD/EDD refresh before the record lapses.",
      href: `/parties/${r.partyId}`,
      entityLabel: r.partyId, // replaced by party legal name in attachPartyLabels
      entityId: r.kycRecordId,
      occurredAt: due,
    });
  }
  return out;
}

/** KYC re-KYC past due (critical). The record has lapsed - counterparty
 *  diligence is stale and the relationship may need to be paused under the
 *  firm's KYC stale-policy (party.is_kyc_stale). */
async function scanKycExpired(
  db: Db,
  scope: NotificationScope,
): Promise<Notification[]> {
  const rows = await db
    .select({
      kycRecordId: kycRecord.kycRecordId,
      partyId: kycRecord.partyId,
      rekycDueDate: kycRecord.rekycDueDate,
      status: kycRecord.status,
      riskRating: kycRecord.riskRating,
    })
    .from(kycRecord)
    .innerJoin(party, eq(party.partyId, kycRecord.partyId))
    .where(
      and(
        isNull(kycRecord.deletedAt),
        isNull(party.deletedAt),
        partyScopeClause(scope),
        sql`${kycRecord.rekycDueDate} IS NOT NULL`,
        sql`${kycRecord.rekycDueDate} < now()::date`,
      ),
    );

  const out: Notification[] = [];
  for (const r of rows) {
    const due = toDateIso(r.rekycDueDate);
    if (!due) continue;
    const days = Math.abs(daysUntil(due));
    out.push({
      id: notificationId("kyc_expired", r.kycRecordId),
      type: "kyc_expired",
      severity: "critical",
      title: `KYC expired ${days} day${days === 1 ? "" : "s"} ago`,
      description:
        "Re-KYC is past due: counterparty diligence has lapsed. Pause new business until CDD/EDD is refreshed.",
      href: `/parties/${r.partyId}`,
      entityLabel: r.partyId,
      entityId: r.kycRecordId,
      occurredAt: due,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Deal stuck (warning) - a mandate idle past its stage SLA
// ---------------------------------------------------------------------------

/** Deals not updated in > 14 days and not in a terminal state (closed /
 *  dropped). A stalled mandate surfaces as a warning so the coverage desk can
 *  unblock it (chase the issuer, advance the stage, or drop it). */
async function scanDealsStuck(
  db: Db,
  scope: NotificationScope,
): Promise<Notification[]> {
  const rows = await db
    .select({
      dealId: deal.dealId,
      dealCode: deal.dealCode,
      dealName: deal.dealName,
      dealType: deal.dealType,
      status: deal.status,
      updatedAt: deal.updatedAt,
    })
    .from(deal)
    .where(
      and(
        isNull(deal.deletedAt),
        dealScopeClause(scope),
        sql`${deal.status} IS NULL OR ${deal.status}::text <> ALL (${sql`ARRAY[${sql.join(
          DEAL_TERMINAL.map((s) => sql`${s}`),
          sql`, `,
        )}]::text[]`})`,
        sql`${deal.updatedAt} < now() - interval '14 days'`,
      ),
    );

  const out: Notification[] = [];
  for (const r of rows) {
    const at = toDateIso(r.updatedAt);
    if (!at) continue;
    const days = Math.max(1, Math.round((Date.now() - new Date(at).getTime()) / DAY));
    const label = r.dealName?.trim() || r.dealCode || "Untitled mandate";
    out.push({
      id: notificationId("deal_stuck", r.dealId),
      type: "deal_stuck",
      severity: "warning",
      title: `Deal idle ${days} day${days === 1 ? "" : "s"}`,
      description: `Mandate "${label}" hasn't advanced in ${days} days. Chase the issuer or advance the stage, or mark it dropped.`,
      href: "/deals",
      entityLabel: label,
      entityId: r.dealId,
      occurredAt: at,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Credit committee pending (warning) - analysis awaiting a committee ruling
// ---------------------------------------------------------------------------

/** Current credit analyses (valid_to IS NULL, not superseded, not deleted)
 *  with NO internal_rating_action yet - i.e. the analyst is done but the
 *  committee hasn't ruled - idle > 5 days. The credit feature captures the
 *  committee workflow as internal_rating_action + recommendation on
 *  credit_analysis (see features/credit/actions.ts advanceCommitteeState),
 *  so a NULL action is precisely "awaiting committee". */
async function scanCreditPending(
  db: Db,
  scope: NotificationScope,
): Promise<Notification[]> {
  const rows = await db
    .select({
      creditAnalysisId: creditAnalysis.creditAnalysisId,
      partyId: creditAnalysis.partyId,
      analysisType: creditAnalysis.analysisType,
      updatedAt: creditAnalysis.updatedAt,
    })
    .from(creditAnalysis)
    .innerJoin(party, eq(party.partyId, creditAnalysis.partyId))
    .where(
      and(
        isNull(creditAnalysis.deletedAt),
        isNull(party.deletedAt),
        partyScopeClause(scope),
        isNull(creditAnalysis.validTo),
        isNull(creditAnalysis.supersededBy),
        isNull(creditAnalysis.internalRatingAction),
        sql`${creditAnalysis.updatedAt} < now() - interval '5 days'`,
      ),
    );

  const out: Notification[] = [];
  for (const r of rows) {
    const at = toDateIso(r.updatedAt);
    if (!at) continue;
    const days = Math.max(1, Math.round((Date.now() - new Date(at).getTime()) / DAY));
    out.push({
      id: notificationId("credit_committee_pending", r.creditAnalysisId),
      type: "credit_committee_pending",
      severity: "warning",
      title: `Credit committee pending ${days} day${days === 1 ? "" : "s"}`,
      description:
        "Internal credit analysis is awaiting a committee ruling (no internal rating action recorded). Schedule the committee review.",
      href: `/credit/${r.creditAnalysisId}`,
      entityLabel: r.partyId,
      entityId: r.creditAnalysisId,
      occurredAt: at,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tasks - overdue (critical) + due soon (info)
// ---------------------------------------------------------------------------

/** Tasks past their due date and not completed/cancelled (critical). */
async function scanTasksOverdue(
  db: Db,
  scope: NotificationScope,
): Promise<Notification[]> {
  const rows = await db
    .select({
      taskId: task.taskId,
      title: task.title,
      partyId: task.partyId,
      dealId: task.dealId,
      dueDate: task.dueDate,
      priority: task.priority,
    })
    .from(task)
    .leftJoin(deal, eq(deal.dealId, task.dealId))
    .leftJoin(party, eq(party.partyId, task.partyId))
    .where(
      and(
        isNull(task.deletedAt),
        taskScopeClause(scope),
        sql`${task.dueDate} IS NOT NULL`,
        sql`${task.dueDate} < now()::date`,
        sql`${task.status} IS NULL OR ${task.status}::text <> ALL (${sql`ARRAY[${sql.join(
          TASK_DONE.map((s) => sql`${s}`),
          sql`, `,
        )}]::text[]`})`,
      ),
    );

  const out: Notification[] = [];
  for (const r of rows) {
    const due = toDateIso(r.dueDate);
    if (!due) continue;
    const days = Math.abs(daysUntil(due));
    out.push({
      id: notificationId("task_overdue", r.taskId),
      type: "task_overdue",
      severity: "critical",
      title: `Task overdue ${days} day${days === 1 ? "" : "s"}`,
      description: `"${r.title}" passed its due date. Complete it or re-schedule to clear the escalation.`,
      href: `/tasks/${r.taskId}`,
      entityLabel: r.title,
      entityId: r.taskId,
      occurredAt: due,
    });
  }
  return out;
}

/** Tasks due in the next 2 days (today .. today+2) and not completed/cancelled
 *  (info). Disjoint from overdue (overdue is strictly past today). */
async function scanTasksDueSoon(
  db: Db,
  scope: NotificationScope,
): Promise<Notification[]> {
  const rows = await db
    .select({
      taskId: task.taskId,
      title: task.title,
      partyId: task.partyId,
      dealId: task.dealId,
      dueDate: task.dueDate,
      priority: task.priority,
    })
    .from(task)
    .leftJoin(deal, eq(deal.dealId, task.dealId))
    .leftJoin(party, eq(party.partyId, task.partyId))
    .where(
      and(
        isNull(task.deletedAt),
        taskScopeClause(scope),
        sql`${task.dueDate} IS NOT NULL`,
        sql`${task.dueDate} >= now()::date`,
        sql`${task.dueDate} <= now()::date + 2`,
        sql`${task.status} IS NULL OR ${task.status}::text <> ALL (${sql`ARRAY[${sql.join(
          TASK_DONE.map((s) => sql`${s}`),
          sql`, `,
        )}]::text[]`})`,
      ),
    );

  const out: Notification[] = [];
  for (const r of rows) {
    const due = toDateIso(r.dueDate);
    if (!due) continue;
    const days = daysUntil(due);
    const when =
      days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
    out.push({
      id: notificationId("task_due_soon", r.taskId),
      type: "task_due_soon",
      severity: "info",
      title: `Task due ${when}`,
      description: `"${r.title}" is approaching its due date. Keep the mandate on track.`,
      href: `/tasks/${r.taskId}`,
      entityLabel: r.title,
      entityId: r.taskId,
      occurredAt: due,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Consent withdrawn (warning) - DPDP consent revoked
// ---------------------------------------------------------------------------

/** Consents with a consent_withdrawn_at timestamp (warning). A withdrawn
 *  consent may trigger a data-subject-request workflow (data_subject_request)
 *  and constrains what the firm may do with the principal's data under DPDP. */
async function scanConsentWithdrawn(
  db: Db,
  scope: NotificationScope,
): Promise<Notification[]> {
  const rows = await db
    .select({
      consentRecordId: consentRecord.consentRecordId,
      partyId: consentRecord.partyId,
      contactId: consentRecord.contactId,
      purpose: consentRecord.purpose,
      withdrawnAt: consentRecord.consentWithdrawnAt,
    })
    .from(consentRecord)
    .leftJoin(party, eq(party.partyId, consentRecord.partyId))
    .where(
      and(
        isNull(consentRecord.deletedAt),
        partyScopeClause(scope),
        sql`${consentRecord.consentWithdrawnAt} IS NOT NULL`,
      ),
    );

  const out: Notification[] = [];
  for (const r of rows) {
    const at = toDateIso(r.withdrawnAt);
    if (!at) continue;
    const purpose = r.purpose ?? "consent";
    const href = r.partyId ? `/parties/${r.partyId}` : "/compliance/consent";
    out.push({
      id: notificationId("consent_withdrawn", r.consentRecordId),
      type: "consent_withdrawn",
      severity: "warning",
      title: "Consent withdrawn",
      description: `DPDP consent for "${purpose}" was withdrawn. Confirm the data-subject-request workflow and cease the covered processing.`,
      href,
      entityLabel: r.partyId ?? "Data subject",
      entityId: r.consentRecordId,
      occurredAt: at,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Party duplicate candidates (warning) - merge/reject/defer queue
// ---------------------------------------------------------------------------

async function scanPartyDuplicates(
  db: Db,
  scope: NotificationScope,
): Promise<Notification[]> {
  let rows: {
    duplicateCandidateId: string;
    sourcePartyId: string;
    candidatePartyId: string;
    matchRule: string | null;
    matchScore: string | number;
    createdAt: Date | string | null;
  }[];
  try {
    rows = await db
      .select({
        duplicateCandidateId: partyDuplicateCandidate.duplicateCandidateId,
        sourcePartyId: partyDuplicateCandidate.sourcePartyId,
        candidatePartyId: partyDuplicateCandidate.candidatePartyId,
        matchRule: partyDuplicateCandidate.matchRule,
        matchScore: partyDuplicateCandidate.matchScore,
        createdAt: partyDuplicateCandidate.createdAt,
      })
      .from(partyDuplicateCandidate)
      .where(
        and(
          sql`${partyDuplicateCandidate.status} = 'open'`,
          duplicateScopeClause(scope),
        ),
      )
      .orderBy(sql`${partyDuplicateCandidate.createdAt} desc`)
      .limit(100);
  } catch (err) {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code?: string }).code
        : typeof err === "object" &&
            err !== null &&
            "cause" in err &&
            typeof (err as { cause?: unknown }).cause === "object" &&
            (err as { cause?: unknown }).cause !== null &&
            "code" in ((err as { cause?: unknown }).cause as object)
          ? (((err as { cause?: unknown }).cause as { code?: string }).code)
          : undefined;
    if (
      code === "42P01"
    ) {
      return [];
    }
    throw err;
  }

  const out: Notification[] = [];
  for (const r of rows) {
    const at = toDateIso(r.createdAt);
    if (!at) continue;
    const pct = Math.round(Number(r.matchScore) * 100);
    out.push({
      id: notificationId("party_duplicate", r.duplicateCandidateId),
      type: "party_duplicate",
      severity: pct >= 90 ? "critical" : "warning",
      title: `Possible duplicate party (${pct}%)`,
      description:
        "A party master record closely matches an existing company. Review and merge, reject, or defer before assignment and exports.",
      href: `/parties/${r.sourcePartyId}`,
      entityLabel: r.sourcePartyId,
      entityId: r.duplicateCandidateId,
      occurredAt: at,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Party label resolution - one batched query for every party_id referenced
// ---------------------------------------------------------------------------

/**
 * Replace placeholder `entityLabel === partyId` values with the party's display
 * name (displayName ?? legalName). Deal + task notifications already carry a
 * human label and are left untouched. A single `IN (ids)` query - no N+1.
 */
async function attachPartyLabels(
  db: Db,
  notifications: Notification[],
): Promise<void> {
  // Collect party ids that appear as a placeholder label (KYC / credit /
  // consent set entityLabel = partyId). A uuid-shaped placeholder is a party
  // id; anything else (deal name / task title / "Data subject") is already a
  // human label.
  const partyIds = new Set<string>();
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const n of notifications) {
    if (uuidRe.test(n.entityLabel)) partyIds.add(n.entityLabel);
  }
  if (partyIds.size === 0) return;

  const rows = await db
    .select({
      partyId: party.partyId,
      legalName: party.legalName,
      displayName: party.displayName,
    })
    .from(party)
    .where(
      and(
        sql`${party.partyId} = ANY (${sql`ARRAY[${sql.join(
          Array.from(partyIds).map((id) => sql`${id}::uuid`),
          sql`, `,
        )}]::uuid[]`})`,
        isNull(party.deletedAt),
      ),
    );

  const nameByParty = new Map<string, string>();
  for (const r of rows) {
    nameByParty.set(r.partyId, (r.displayName?.trim() || r.legalName) ?? "Unknown party");
  }

  for (const n of notifications) {
    if (uuidRe.test(n.entityLabel)) {
      n.entityLabel = nameByParty.get(n.entityLabel) ?? "Unknown party";
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Coerce a Drizzle date/timestamp value (string yyyy-mm-dd or Date) into an
 *  ISO string, or null when empty/invalid. `date` columns come back as
 *  yyyy-mm-dd strings (UTC midnight under `new Date`); `timestamp` columns
 *  come back as Date instances. */
function toDateIso(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Whole days from now to an ISO instant (negative = past). Used for the
 *  "in N days" / "N days ago" framing in titles. */
function daysUntil(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.round((t - Date.now()) / DAY);
}
