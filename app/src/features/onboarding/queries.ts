// Client Onboarding - server-side data access.
//
// Storage: a JSONB `onboarding_meta` column on party (migration 0007). A party
// is an onboarding case iff onboarding_meta IS NOT NULL. Because onboarding_meta
// is not in the frozen Drizzle schema (the schema layer owns src/db/schema/*),
// the onboarding read paths use parameterised raw SQL via `db.execute(sql\`...\`)`
// - postgres-js parses the jsonb column into a JS object and timestamptz into a
// Date automatically. Writes (actions.ts) set onboarding_meta via raw SQL inside
// an RLS transaction.
//
// The live KYC status is JOINed from kyc_record (linked via
// onboarding_meta->>'kycRecordId') so it can never go stale - the gate that
// requires an approved KYC before documents_collected→kyc_verified reads the
// live status, not a denormalized copy.
//
// All functions are safe to call from Server Components. Reads run against the
// shared `db` client (RLS is fail-open on the read path per 0004_rls_fix); the
// onboarding_meta column rides party's existing RLS policies, so no new policy
// is needed.

import { sql, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { appUser, partyContact, contact, task } from "@/db/schema";
import { listInteractions } from "@/features/interactions/queries";
import type { InteractionListItem } from "@/features/interactions/queries";
import { can } from "@/lib/rbac-core";
import type { CrmUser } from "@/lib/rbac";

import {
  ONBOARDING_CLIENT_TYPE_ORDER,
  ONBOARDING_STAGE_ORDER,
  ONBOARDING_STAGE_SLA_DAYS,
  computeOnboardingSla,
  allDocsVerified,
  docsUploaded,
  docsVerified,
  freshChecklist,
  type OnboardingClientType,
  type OnboardingDocItem,
  type OnboardingMeta,
  type OnboardingSlaState,
  type OnboardingStage,
} from "./types";

function canReadAllOnboarding(
  user?: Pick<CrmUser, "roles" | "permissions"> | null,
) {
  return (
    !user ||
    user.roles.includes("admin") ||
    user.roles.includes("super_admin") ||
    can(user, "read_all", "onboarding") ||
    can(user, "read_all", "party") ||
    can(user, "manage", "user")
  );
}

function onboardingScopeSql(user?: CrmUser | null) {
  const userId = user?.appUserId;
  if (canReadAllOnboarding(user) || !userId) return sql``;
  return sql`AND (
    p.assigned_user_id = ${userId}
    OR p.data_owner_user_id = ${userId}
    OR p.created_by_user_id = ${userId}
    OR (p.onboarding_meta->>'assignedRm')::uuid = ${userId}
  )`;
}

// ---------------------------------------------------------------------------
// Row shapes returned to the view layer.
// ---------------------------------------------------------------------------

/** A relationship manager option for the assignment dropdown. */
export interface RmOption {
  userId: string;
  name: string;
  email: string;
  desk: string | null;
}

/** The live KYC state JOINed from kyc_record (null when no KYC linked). */
export interface OnboardingKycState {
  kycRecordId: string;
  status: string | null;
  riskRating: string | null;
  kycType: string | null;
  validUntil: string | null;
  approvedAt: Date | null;
}

/** An onboarding case as rendered on the pipeline board / detail header. */
export interface OnboardingRow {
  partyId: string;
  legalName: string;
  displayName: string | null;
  partyNature: string;
  countryOfIncorporation: string;
  onboarding: OnboardingMeta;
  /** Live KYC state (null when no kyc_record is linked). */
  kyc: OnboardingKycState | null;
  /** SLA state for the current stage (computed from stageHistory). */
  sla: OnboardingSlaState;
  assignedRmUserId: string | null;
  assignedRmName: string | null;
  assignedRmEmail: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface OnboardingPipelineGroup {
  stage: OnboardingStage;
  cases: OnboardingRow[];
}

/** A party contact linked to the onboarding case's company. */
export interface OnboardingContact {
  contactId: string;
  fullName: string;
  role: string | null;
  designation: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  isPrimary: boolean | null;
}

/** A task anchored to the onboarding case's party. */
export interface OnboardingTask {
  taskId: string;
  title: string;
  status: string | null;
  priority: string | null;
  dueDate: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  completedAt: Date | null;
}

export interface OnboardingDetail extends OnboardingRow {
  partyTypes: string[];
  contacts: OnboardingContact[];
  interactions: InteractionListItem[];
  tasks: OnboardingTask[];
}

// ---------------------------------------------------------------------------
// Raw row type from the onboarding SQL (onboarding_meta parsed to unknown → cast).
// ---------------------------------------------------------------------------

// NOTE: `type` aliases (not `interface`) so the row shape satisfies
// `db.execute<T>`'s `Record<string, unknown>` constraint - TS treats open
// interfaces as non-assignable to that constraint but sealed type literals as
// assignable.
type OnboardingDbRow = {
  party_id: string;
  legal_name: string;
  display_name: string | null;
  party_nature: string;
  country_of_incorporation: string;
  onboarding_meta: unknown;
  kyc_record_id: string | null;
  kyc_status: string | null;
  kyc_risk_rating: string | null;
  kyc_type: string | null;
  kyc_valid_until: string | null;
  kyc_approved_at: Date | null;
  rm_user_id: string | null;
  rm_name: string | null;
  rm_email: string | null;
  created_at: Date;
  updated_at: Date | null;
};

/**
 * Coerce a raw onboarding_meta (unknown) into a typed OnboardingMeta, filling
 * defaults for any field an older blob might lack (forward-compatible).
 * Exported so actions.ts can load → mutate → write a blob without re-implementing
 * the defaults.
 */
export function normalizeOnboarding(raw: unknown): OnboardingMeta {
  const m = (raw ?? {}) as Partial<OnboardingMeta>;
  const docs = Array.isArray(m.documents)
    ? (m.documents as Partial<OnboardingDocItem>[]).map((d) => ({
        key: (d.key as OnboardingDocItem["key"]) ?? "consent_form",
        status: (d.status as OnboardingDocItem["status"]) ?? "pending",
        verification:
          (d.verification as OnboardingDocItem["verification"]) ?? "pending",
        documentId: d.documentId ?? null,
        uploadedAt: d.uploadedAt ?? null,
        verifiedAt: d.verifiedAt ?? null,
        verifiedBy: d.verifiedBy ?? null,
        rejectionReason: d.rejectionReason ?? null,
      }))
    : freshChecklist();
  const stageHistory = Array.isArray(m.stageHistory)
    ? (m.stageHistory as OnboardingMeta["stageHistory"])
    : [];
  return {
    stage: (m.stage as OnboardingStage) ?? "initiated",
    clientType:
      (m.clientType as OnboardingClientType) ?? "issuer",
    assignedRm: m.assignedRm ?? null,
    contactName: m.contactName ?? null,
    contactTitle: m.contactTitle ?? null,
    contactEmail: m.contactEmail ?? null,
    contactPhone: m.contactPhone ?? null,
    pan: m.pan ?? null,
    cin: m.cin ?? null,
    gstin: m.gstin ?? null,
    state: m.state ?? null,
    city: m.city ?? null,
    documents: docs,
    kycRecordId: m.kycRecordId ?? null,
    complianceApprovedBy: m.complianceApprovedBy ?? null,
    complianceApprovedAt: m.complianceApprovedAt ?? null,
    complianceRejectedBy: m.complianceRejectedBy ?? null,
    complianceRejectedAt: m.complianceRejectedAt ?? null,
    complianceNote: m.complianceNote ?? null,
    stageHistory,
    rejectionReason: m.rejectionReason ?? null,
    createdAt: m.createdAt ?? new Date().toISOString(),
    updatedAt: m.updatedAt ?? new Date().toISOString(),
  };
}

function rowToOnboarding(r: OnboardingDbRow): OnboardingRow {
  const onboarding = normalizeOnboarding(r.onboarding_meta);
  const kyc: OnboardingKycState | null = r.kyc_record_id
    ? {
        kycRecordId: r.kyc_record_id,
        status: r.kyc_status,
        riskRating: r.kyc_risk_rating,
        kycType: r.kyc_type,
        validUntil: r.kyc_valid_until,
        approvedAt: r.kyc_approved_at,
      }
    : null;
  return {
    partyId: r.party_id,
    legalName: r.legal_name,
    displayName: r.display_name,
    partyNature: r.party_nature,
    countryOfIncorporation: r.country_of_incorporation,
    onboarding,
    kyc,
    sla: computeOnboardingSla(onboarding.stage, onboarding.stageHistory),
    assignedRmUserId: r.rm_user_id,
    assignedRmName: r.rm_name,
    assignedRmEmail: r.rm_email,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ---------------------------------------------------------------------------
// listRms - relationship managers assignable to an onboarding case.
// ---------------------------------------------------------------------------

/**
 * Active app_users with their Auth.js display name, ordered by name. Used to
 * populate the "assigned RM" dropdown on the wizard + detail page. Raw SQL
 * because the display name lives on the `users` table (Auth.js identity),
 * joined to app_user via users.app_user_id → app_user.user_id (the actual
 * Neon linkage - the Drizzle schema declares users.app_user_id; app_user has
 * NO auth_user_id column despite earlier comments claiming otherwise).
 */
export async function listRms(): Promise<RmOption[]> {
  const rows = await db.execute<RmDbRow>(sql`
    SELECT u.user_id, u.email, u.desk, usr.name
    FROM app_user u
    LEFT JOIN users usr ON usr.app_user_id = u.user_id
    WHERE u.is_active = true AND u.deleted_at IS NULL
    ORDER BY COALESCE(usr.name, u.email)
  `);
  return rows.map((r) => ({
    userId: r.user_id,
    name: r.name ?? r.email,
    email: r.email,
    desk: r.desk,
  }));
}

type RmDbRow = {
  user_id: string;
  email: string;
  desk: string | null;
  name: string | null;
};

// ---------------------------------------------------------------------------
// fetchAllOnboarding - the shared base query for the pipeline + analytics.
// ---------------------------------------------------------------------------

const ONBOARDING_SELECT = sql`
  SELECT
    p.party_id,
    p.legal_name,
    p.display_name,
    p.party_nature,
    p.country_of_incorporation,
    p.onboarding_meta,
    p.created_at,
    p.updated_at,
    k.kyc_record_id AS kyc_record_id,
    k.status       AS kyc_status,
    k.risk_rating  AS kyc_risk_rating,
    k.kyc_type     AS kyc_type,
    k.valid_until  AS kyc_valid_until,
    k.approved_at  AS kyc_approved_at,
    rm.user_id     AS rm_user_id,
    usr.name       AS rm_name,
    rm.email       AS rm_email
  FROM party p
  LEFT JOIN kyc_record k
    ON k.kyc_record_id = (p.onboarding_meta->>'kycRecordId')::uuid
    AND k.deleted_at IS NULL
  LEFT JOIN app_user rm
    ON rm.user_id = (p.onboarding_meta->>'assignedRm')::uuid
  LEFT JOIN users usr
    ON usr.app_user_id = rm.user_id
  WHERE p.onboarding_meta IS NOT NULL
    AND p.deleted_at IS NULL
`;

/** All onboarding cases, newest activity first (onboarding_meta.updatedAt desc). */
export async function fetchAllOnboarding(
  user?: CrmUser | null,
): Promise<OnboardingRow[]> {
  const rows = await db.execute<OnboardingDbRow>(sql`
    ${ONBOARDING_SELECT}
    ${onboardingScopeSql(user)}
    ORDER BY (p.onboarding_meta->>'updatedAt') DESC NULLS LAST
  `);
  return rows.map(rowToOnboarding);
}

// ---------------------------------------------------------------------------
// getOnboardingPipeline - cases grouped by stage, in canonical funnel order.
// ---------------------------------------------------------------------------

export async function getOnboardingPipeline(
  user?: CrmUser | null,
): Promise<
  OnboardingPipelineGroup[]
> {
  const cases = await fetchAllOnboarding(user);
  const byStage = new Map<OnboardingStage, OnboardingRow[]>();
  for (const stage of ONBOARDING_STAGE_ORDER) byStage.set(stage, []);
  for (const c of cases) {
    const arr = byStage.get(c.onboarding.stage) ?? [];
    arr.push(c);
    byStage.set(c.onboarding.stage, arr);
  }
  return ONBOARDING_STAGE_ORDER.map((stage) => ({
    stage,
    cases: byStage.get(stage) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// getOnboardingDetail - one case + its contacts, interactions, tasks, KYC.
// ---------------------------------------------------------------------------

export async function getOnboardingDetail(
  partyId: string,
  user?: CrmUser | null,
): Promise<OnboardingDetail | null> {
  // Onboarding row (scoped to this party_id).
  const rows = await db.execute<OnboardingDbRow>(sql`
    ${ONBOARDING_SELECT}
      AND p.party_id = ${partyId}
      ${onboardingScopeSql(user)}
  `);
  if (rows.length === 0) return null;
  const base = rowToOnboarding(rows[0]!);

  // Party types (party_type_assignment).
  const types = await db.execute<{ party_type: string }>(sql`
    SELECT party_type FROM party_type_assignment
    WHERE party_id = ${partyId} AND deleted_at IS NULL
  `);

  // Contacts (party_contact → contact).
  const contactRows = await db
    .select({
      contactId: contact.contactId,
      fullName: contact.fullName,
      role: partyContact.role,
      designation: contact.designation,
      primaryEmail: contact.primaryEmail,
      primaryPhone: contact.primaryPhone,
      isPrimary: partyContact.isPrimary,
    })
    .from(partyContact)
    .innerJoin(contact, eq(contact.contactId, partyContact.contactId))
    .where(
      sql`${partyContact.partyId} = ${partyId} AND ${partyContact.deletedAt} IS NULL`,
    )
    .orderBy(asc(partyContact.isPrimary), asc(contact.fullName));

  // Interactions anchored to this party (reuse the shared interaction query).
  const { rows: interactions } = await listInteractions({
    partyId,
    user,
    page: 1,
    pageSize: 25,
  });

  // Tasks anchored to this party.
  const taskRows = await db
    .select({
      taskId: task.taskId,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      completedAt: task.completedAt,
      assigneeEmail: appUser.email,
    })
    .from(task)
    .leftJoin(appUser, eq(appUser.userId, task.assigneeUserId))
    .where(sql`${task.partyId} = ${partyId} AND ${task.deletedAt} IS NULL`)
    .orderBy(asc(task.dueDate));

  const assigneeNames = new Map<string, string>();
  if (taskRows.some((t) => t.assigneeEmail)) {
    const emails = Array.from(
      new Set(taskRows.map((t) => t.assigneeEmail).filter(Boolean) as string[]),
    );
    if (emails.length) {
      // postgres-js cannot bind a JS array as text[] via `${emails}::text[]`.
      const emailsArr = sql`ARRAY[${sql.join(
        emails.map((e) => sql`${e}`),
        sql`, `,
      )}]::text[]`;
      const rmRows = await db.execute<{ email: string; name: string }>(sql`
        SELECT u.email, usr.name FROM app_user u
        LEFT JOIN users usr ON usr.app_user_id = u.user_id
        WHERE u.email = ANY(${emailsArr})
      `);
      for (const r of rmRows) assigneeNames.set(r.email, r.name ?? r.email);
    }
  }

  return {
    ...base,
    partyTypes: types.map((t) => t.party_type),
    contacts: contactRows.map((c) => ({
      contactId: c.contactId,
      fullName: c.fullName,
      role: c.role,
      designation: c.designation,
      primaryEmail: c.primaryEmail,
      primaryPhone: c.primaryPhone,
      isPrimary: c.isPrimary,
    })),
    interactions,
    tasks: taskRows.map((t) => ({
      taskId: t.taskId,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      assigneeEmail: t.assigneeEmail,
      assigneeName: t.assigneeEmail
        ? (assigneeNames.get(t.assigneeEmail) ?? t.assigneeEmail)
        : null,
      completedAt: t.completedAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// Live KYC lookup - the gate check reads the live kyc_record status.
// ---------------------------------------------------------------------------

/**
 * The current status of the kyc_record linked to an onboarding case (via
 * onboarding_meta.kycRecordId), or null when no KYC is linked / the record is
 * gone. Used by actions.ts to enforce the documents_collected → kyc_verified
 * gate without trusting a denormalized copy.
 */
export async function getLinkedKycStatus(
  partyId: string,
): Promise<{ status: string | null; kycRecordId: string | null } | null> {
  const rows = await db.execute<{ status: string | null; kyc_record_id: string | null }>(sql`
    SELECT k.status, k.kyc_record_id
    FROM kyc_record k
    WHERE k.kyc_record_id = (
        SELECT (p.onboarding_meta->>'kycRecordId')::uuid
        FROM party p
        WHERE p.party_id = ${partyId}
          AND p.onboarding_meta IS NOT NULL
          AND p.deleted_at IS NULL
      )
      AND k.deleted_at IS NULL
  `);
  if (rows.length === 0) return null;
  return { status: rows[0]!.status, kycRecordId: rows[0]!.kyc_record_id };
}

// ---------------------------------------------------------------------------
// getOnboardingAnalytics - the pipeline dashboard's KPIs + breakdowns.
// ---------------------------------------------------------------------------

export interface OnboardingStageBreakdown {
  stage: OnboardingStage;
  count: number;
  slaDays: number;
  overdue: number;
}

export interface OnboardingClientTypeBreakdown {
  clientType: OnboardingClientType;
  total: number;
  active: number;
  open: number;
}

export interface OnboardingRmBreakdown {
  rmUserId: string | null;
  rmName: string;
  total: number;
  active: number;
  open: number;
  overdue: number;
}

export interface OnboardingAnalytics {
  totalCases: number;
  open: number;
  active: number;
  /** Cases whose current-stage SLA has lapsed (excludes active). */
  overdue: number;
  /** Cases due within ONBOARDING_SLA_DUE_SOON_DAYS (excludes active + overdue). */
  dueSoon: number;
  /** Cases blocked at documents_collected because not all docs are verified. */
  awaitingDocs: number;
  /** Cases in kyc_verified awaiting compliance sign-off. */
  awaitingCompliance: number;
  /** Mean days open across active cases (createdAt → complianceApprovedAt). */
  avgDaysToActivate: number;
  byStage: OnboardingStageBreakdown[];
  byClientType: OnboardingClientTypeBreakdown[];
  byRm: OnboardingRmBreakdown[];
}

/**
 * Compute the full analytics payload from the onboarding set in JS - the
 * onboarding volume is small (the firm's active onboarding queue), so a single
 * fetch + in-memory rollup is cheaper and simpler than N grouped SQL queries,
 * and keeps the stage/clientType/RM breakdowns consistent with one another.
 */
export async function getOnboardingAnalytics(
  user?: CrmUser | null,
): Promise<OnboardingAnalytics> {
  const cases = await fetchAllOnboarding(user);

  const byStageCount = new Map<OnboardingStage, number>();
  const byStageOverdue = new Map<OnboardingStage, number>();
  for (const s of ONBOARDING_STAGE_ORDER) {
    byStageCount.set(s, 0);
    byStageOverdue.set(s, 0);
  }

  let open = 0;
  let active = 0;
  let overdue = 0;
  let dueSoon = 0;
  let awaitingDocs = 0;
  let awaitingCompliance = 0;
  let activateDaySum = 0;
  let activateCount = 0;

  const clientTypeMap = new Map<
    OnboardingClientType,
    { total: number; active: number; open: number }
  >();
  const rmMap = new Map<
    string,
    {
      name: string;
      total: number;
      active: number;
      open: number;
      overdue: number;
    }
  >();

  for (const c of cases) {
    const m = c.onboarding;
    const stage = m.stage;
    byStageCount.set(stage, (byStageCount.get(stage) ?? 0) + 1);

    const isOpen = stage !== "active";
    if (isOpen) {
      open++;
      if (c.sla.status === "overdue") {
        overdue++;
        byStageOverdue.set(stage, (byStageOverdue.get(stage) ?? 0) + 1);
      } else if (c.sla.status === "due_soon") {
        dueSoon++;
      }
      if (stage === "documents_collected" && !allDocsVerified(m.documents)) {
        awaitingDocs++;
      }
      if (stage === "kyc_verified") {
        awaitingCompliance++;
      }
    } else {
      active++;
      // days to activate = createdAt → complianceApprovedAt (the last gate
      // before activation). Falls back to updatedAt when approval stamp absent.
      const startMs = new Date(m.createdAt).getTime();
      const endIso = m.complianceApprovedAt ?? m.updatedAt;
      const endMs = new Date(endIso).getTime();
      if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
        activateDaySum += (endMs - startMs) / 86_400_000;
        activateCount++;
      }
    }

    // client type rollup
    const ct = m.clientType;
    const cv = clientTypeMap.get(ct) ?? { total: 0, active: 0, open: 0 };
    cv.total++;
    if (isOpen) cv.open++;
    else cv.active++;
    clientTypeMap.set(ct, cv);

    // RM rollup
    const rmKey = m.assignedRm ?? "__unassigned__";
    const rv = rmMap.get(rmKey) ?? {
      name: m.assignedRm ? (c.assignedRmName ?? c.assignedRmEmail ?? "RM") : "Unassigned",
      total: 0,
      active: 0,
      open: 0,
      overdue: 0,
    };
    rv.total++;
    if (isOpen) {
      rv.open++;
      if (c.sla.status === "overdue") rv.overdue++;
    } else {
      rv.active++;
    }
    rmMap.set(rmKey, rv);
  }

  const byStage: OnboardingStageBreakdown[] = ONBOARDING_STAGE_ORDER.map(
    (s) => ({
      stage: s,
      count: byStageCount.get(s) ?? 0,
      slaDays: ONBOARDING_STAGE_SLA_DAYS[s],
      overdue: byStageOverdue.get(s) ?? 0,
    }),
  );

  const byClientType: OnboardingClientTypeBreakdown[] =
    ONBOARDING_CLIENT_TYPE_ORDER.filter((ct) => clientTypeMap.has(ct)).map(
      (ct) => {
        const v = clientTypeMap.get(ct)!;
        return { clientType: ct, total: v.total, active: v.active, open: v.open };
      },
    );

  const byRm: OnboardingRmBreakdown[] = Array.from(rmMap.entries())
    .map(([rmUserId, v]) => ({
      rmUserId: rmUserId === "__unassigned__" ? null : rmUserId,
      rmName: v.name,
      total: v.total,
      active: v.active,
      open: v.open,
      overdue: v.overdue,
    }))
    .sort((a, b) => b.open - a.open || b.total - a.total);

  return {
    totalCases: cases.length,
    open,
    active,
    overdue,
    dueSoon,
    awaitingDocs,
    awaitingCompliance,
    avgDaysToActivate: activateCount > 0 ? activateDaySum / activateCount : 0,
    byStage,
    byClientType,
    byRm,
  };
}

// Re-export the helpers the view layer uses for card / detail rendering.
export {
  computeOnboardingSla,
  allDocsVerified,
  docsUploaded,
  docsVerified,
  freshChecklist,
};
