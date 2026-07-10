// Lead & Opportunity Management - server-side data access.
//
// Storage: a JSONB `lead_meta` column on party (migration 0006). A party is a
// lead iff lead_meta IS NOT NULL. Because lead_meta is not in the frozen
// Drizzle schema (the schema layer owns src/db/schema/*), the lead read paths
// use parameterised raw SQL via `db.execute(sql\`...\`)` - postgres-js parses
// the jsonb column into a JS object and timestamptz into a Date automatically.
// Writes (actions.ts) set lead_meta via raw SQL inside an RLS transaction.
//
// All functions are safe to call from Server Components. Reads run against the
// shared `db` client (RLS is fail-open on the read path per 0004_rls_fix); the
// lead_meta column rides party's existing RLS policies, so no new policy is
// needed. The Deals module is untouched - a won lead promotes to a real deal
// row only on conversion (see actions.ts winLead).

import { sql } from "drizzle-orm";
import { asc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { appUser, party, partyContact, contact, task } from "@/db/schema";
import { can } from "@/lib/rbac-core";
import type { CrmUser } from "@/lib/rbac";
import type { InteractionListItem } from "@/features/interactions/queries";
import { listInteractions } from "@/features/interactions/queries";

import {
  LEAD_DEAL_TYPE_ORDER,
  LEAD_SOURCE_ORDER,
  LEAD_STAGE_DEFAULT_PROBABILITY,
  LEAD_STAGE_ORDER,
  isQualified,
  type LeadDealType,
  type LeadMeta,
  type LeadSource,
  type LeadStage,
} from "./types";

function canReadAllLeads(user?: Pick<CrmUser, "roles" | "permissions"> | null) {
  return (
    !user ||
    user.roles.includes("admin") ||
    user.roles.includes("super_admin") ||
    can(user, "read_all", "lead") ||
    can(user, "read_all", "party") ||
    can(user, "manage", "user")
  );
}

function leadScopeSql(user?: CrmUser | null) {
  const userId = user?.appUserId;
  if (canReadAllLeads(user) || !userId) return sql``;
  return sql`AND (
    p.assigned_user_id = ${userId}
    OR p.data_owner_user_id = ${userId}
    OR p.created_by_user_id = ${userId}
    OR (p.lead_meta->>'assignedRm')::uuid = ${userId}
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

/** A lead as rendered on the pipeline board / detail header. */
export interface LeadRow {
  partyId: string;
  legalName: string;
  displayName: string | null;
  kycRiskRating: string | null;
  countryOfIncorporation: string;
  lead: LeadMeta;
  assignedRmUserId: string | null;
  assignedRmName: string | null;
  assignedRmEmail: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface LeadPipelineGroup {
  stage: LeadStage;
  leads: LeadRow[];
}

/** A party contact linked to the lead's company (party_contact → contact). */
export interface LeadContact {
  contactId: string;
  fullName: string;
  role: string | null;
  designation: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  isPrimary: boolean | null;
}

/** A task anchored to the lead's party. */
export interface LeadTask {
  taskId: string;
  title: string;
  status: string | null;
  priority: string | null;
  dueDate: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  completedAt: Date | null;
}

export interface LeadDetail extends LeadRow {
  partyTypes: string[];
  contacts: LeadContact[];
  interactions: InteractionListItem[];
  tasks: LeadTask[];
}

// ---------------------------------------------------------------------------
// Raw row type from the lead SQL (lead_meta parsed to unknown → cast).
// ---------------------------------------------------------------------------

// NOTE: `type` aliases (not `interface`) so the row shape satisfies
// `db.execute<T>`'s `Record<string, unknown>` constraint - TS treats open
// interfaces as non-assignable to that constraint but sealed type literals as
// assignable.
type LeadDbRow = {
  party_id: string;
  legal_name: string;
  display_name: string | null;
  kyc_risk_rating: string | null;
  country_of_incorporation: string;
  lead_meta: unknown;
  rm_user_id: string | null;
  rm_name: string | null;
  rm_email: string | null;
  created_at: Date;
  updated_at: Date | null;
};

/** Coerce a raw lead_meta (unknown) into a typed LeadMeta, filling defaults
 *  for any field an older blob might lack (forward-compatible). Exported so
 *  actions.ts can load → mutate → write a blob without re-implementing the
 *  defaults. */
export function normalizeLead(raw: unknown): LeadMeta {
  const m = (raw ?? {}) as Partial<LeadMeta>;
  return {
    stage: (m.stage as LeadStage) ?? "new",
    source: (m.source as LeadSource) ?? "referral",
    dealType: (m.dealType as LeadDealType) ?? "bond_underwriting",
    estSizeCr: m.estSizeCr ?? null,
    probability: m.probability ?? LEAD_STAGE_DEFAULT_PROBABILITY.new,
    expectedClose: m.expectedClose ?? null,
    assignedRm: m.assignedRm ?? null,
    contactName: m.contactName ?? null,
    contactTitle: m.contactTitle ?? null,
    contactEmail: m.contactEmail ?? null,
    contactPhone: m.contactPhone ?? null,
    bant: {
      budget: m.bant?.budget ?? false,
      authority: m.bant?.authority ?? false,
      need: m.bant?.need ?? false,
      timeline: m.bant?.timeline ?? false,
    },
    notes: m.notes ?? null,
    lossReason: m.lossReason ?? null,
    convertedDealId: m.convertedDealId ?? null,
    closedAt: m.closedAt ?? null,
    createdAt: m.createdAt ?? new Date().toISOString(),
    updatedAt: m.updatedAt ?? new Date().toISOString(),
  };
}

function rowToLead(r: LeadDbRow): LeadRow {
  return {
    partyId: r.party_id,
    legalName: r.legal_name,
    displayName: r.display_name,
    kycRiskRating: r.kyc_risk_rating,
    countryOfIncorporation: r.country_of_incorporation,
    lead: normalizeLead(r.lead_meta),
    assignedRmUserId: r.rm_user_id,
    assignedRmName: r.rm_name,
    assignedRmEmail: r.rm_email,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ---------------------------------------------------------------------------
// listRMs - relationship managers assignable to a lead.
// ---------------------------------------------------------------------------

/**
 * Active app_users with their Auth.js display name, ordered by name. Used to
 * populate the "assigned RM" dropdown on the capture form + detail page. Raw
 * SQL because the display name lives on the `users` table (Auth.js identity),
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
// fetchAllLeads - the shared base query for the pipeline + analytics.
// ---------------------------------------------------------------------------

const LEAD_SELECT = sql`
  SELECT
    p.party_id,
    p.legal_name,
    p.display_name,
    p.kyc_risk_rating,
    p.country_of_incorporation,
    p.lead_meta,
    p.created_at,
    p.updated_at,
    rm.user_id     AS rm_user_id,
    usr.name       AS rm_name,
    rm.email       AS rm_email
  FROM party p
  LEFT JOIN app_user rm  ON rm.user_id = (p.lead_meta->>'assignedRm')::uuid
  LEFT JOIN users   usr  ON usr.app_user_id = rm.user_id
  WHERE p.lead_meta IS NOT NULL
    AND p.deleted_at IS NULL
`;

/** All leads, newest activity first (lead_meta.updatedAt desc). */
export async function fetchAllLeads(
  user?: CrmUser | null,
): Promise<LeadRow[]> {
  const rows = await db.execute<LeadDbRow>(sql`
    ${LEAD_SELECT}
    ${leadScopeSql(user)}
    ORDER BY (p.lead_meta->>'updatedAt') DESC NULLS LAST
  `);
  return rows.map(rowToLead);
}

// ---------------------------------------------------------------------------
// getLeadsPipeline - leads grouped by stage, in canonical funnel order.
// ---------------------------------------------------------------------------

export async function getLeadsPipeline(
  user?: CrmUser | null,
  opts?: { q?: string; activeOnly?: boolean },
): Promise<LeadPipelineGroup[]> {
  let leads = await fetchAllLeads(user);
  const q = opts?.q?.trim().toLowerCase();
  if (q) {
    leads = leads.filter((l) => {
      const hay = [
        l.legalName,
        l.displayName,
        l.lead.dealType,
        l.lead.source,
        l.lead.contactName,
        l.lead.contactEmail,
        l.assignedRmEmail,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }
  const stages = opts?.activeOnly
    ? (["new", "qualified", "opportunity"] as LeadStage[])
    : LEAD_STAGE_ORDER;
  const byStage = new Map<LeadStage, LeadRow[]>();
  for (const stage of stages) byStage.set(stage, []);
  for (const l of leads) {
    if (!byStage.has(l.lead.stage)) continue;
    const arr = byStage.get(l.lead.stage) ?? [];
    arr.push(l);
    byStage.set(l.lead.stage, arr);
  }
  return stages.map((stage) => ({
    stage,
    leads: byStage.get(stage) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// getLeadDetail - one lead + its contacts, interactions and tasks.
// ---------------------------------------------------------------------------

export async function getLeadDetail(
  partyId: string,
  user?: CrmUser | null,
): Promise<LeadDetail | null> {
  // Lead row (scoped to this party_id).
  const leadRows = await db.execute<LeadDbRow>(sql`
    ${LEAD_SELECT}
      AND p.party_id = ${partyId}
      ${leadScopeSql(user)}
  `);
  if (leadRows.length === 0) return null;
  const base = rowToLead(leadRows[0]!);

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
// getConversionAnalytics - the pipeline dashboard's KPIs + breakdowns.
// ---------------------------------------------------------------------------

export interface SourceBreakdown {
  source: LeadSource;
  total: number;
  won: number;
  open: number;
  rate: number; // won / (won + lost)
  pipelineValueCr: number; // sum estSizeCr of open leads from this source
}

export interface DealTypeBreakdown {
  dealType: LeadDealType;
  total: number;
  won: number;
  open: number;
  rate: number;
  pipelineValueCr: number;
}

export interface RmBreakdown {
  rmUserId: string | null;
  rmName: string;
  total: number;
  won: number;
  open: number;
  rate: number;
  pipelineValueCr: number;
}

export interface MonthBucket {
  month: string; // "Jul 2025"
  won: number;
  lost: number;
}

export interface ConversionAnalytics {
  totalLeads: number;
  open: number;
  won: number;
  lost: number;
  /** won / (won + lost) - the headline conversion rate. 0 when no closed leads. */
  conversionRate: number;
  /** Sum of estSizeCr across open leads (the qualified pipeline value). */
  pipelineValueCr: number;
  /** Sum of estSizeCr across won leads. */
  wonValueCr: number;
  byStage: { stage: LeadStage; count: number; valueCr: number }[];
  bySource: SourceBreakdown[];
  byDealType: DealTypeBreakdown[];
  byRm: RmBreakdown[];
  overTime: MonthBucket[];
  /** Average BANT score across open leads (0–4). */
  avgBantScore: number;
}

/**
 * Compute the full analytics payload from the lead set in JS - the lead volume
 * is small (the firm's active prospect set), so a single fetch + in-memory
 * rollup is cheaper and simpler than N grouped SQL queries, and keeps the
 * stage/source/dealType/RM breakdowns consistent with one another.
 */
export async function getConversionAnalytics(
  user?: CrmUser | null,
): Promise<ConversionAnalytics> {
  const leads = await fetchAllLeads(user);

  const byStageCount = new Map<LeadStage, number>();
  const byStageValue = new Map<LeadStage, number>();
  for (const s of LEAD_STAGE_ORDER) {
    byStageCount.set(s, 0);
    byStageValue.set(s, 0);
  }

  let open = 0;
  let won = 0;
  let lost = 0;
  let pipelineValueCr = 0;
  let wonValueCr = 0;
  let bantSum = 0;

  const sourceMap = new Map<
    LeadSource,
    { total: number; won: number; lost: number; open: number; value: number }
  >();
  const dealTypeMap = new Map<
    LeadDealType,
    { total: number; won: number; lost: number; open: number; value: number }
  >();
  const rmMap = new Map<
    string,
    {
      name: string;
      total: number;
      won: number;
      lost: number;
      open: number;
      value: number;
    }
  >();

  const monthBuckets = new Map<string, { won: number; lost: number }>();

  for (const l of leads) {
    const m = l.lead;
    const size = m.estSizeCr ?? 0;
    const stage = m.stage;
    byStageCount.set(stage, (byStageCount.get(stage) ?? 0) + 1);
    byStageValue.set(stage, (byStageValue.get(stage) ?? 0) + size);

    const isOpen = stage === "new" || stage === "qualified" || stage === "opportunity";
    if (isOpen) {
      open++;
      pipelineValueCr += size;
      bantSum += Number(m.bant.budget) + Number(m.bant.authority) + Number(m.bant.need) + Number(m.bant.timeline);
    } else if (stage === "won") {
      won++;
      wonValueCr += size;
    } else if (stage === "lost") {
      lost++;
    }

    // source rollup
    const s = sourceMap.get(m.source) ?? {
      total: 0,
      won: 0,
      lost: 0,
      open: 0,
      value: 0,
    };
    s.total++;
    if (isOpen) {
      s.open++;
      s.value += size;
    } else if (stage === "won") s.won++;
    else if (stage === "lost") s.lost++;
    sourceMap.set(m.source, s);

    // deal type rollup
    const d = dealTypeMap.get(m.dealType) ?? {
      total: 0,
      won: 0,
      lost: 0,
      open: 0,
      value: 0,
    };
    d.total++;
    if (isOpen) {
      d.open++;
      d.value += size;
    } else if (stage === "won") d.won++;
    else if (stage === "lost") d.lost++;
    dealTypeMap.set(m.dealType, d);

    // RM rollup
    const rmKey = m.assignedRm ?? "__unassigned__";
    const r = rmMap.get(rmKey) ?? {
      name: m.assignedRm ? (l.assignedRmName ?? l.assignedRmEmail ?? "RM") : "Unassigned",
      total: 0,
      won: 0,
      lost: 0,
      open: 0,
      value: 0,
    };
    r.total++;
    if (isOpen) {
      r.open++;
      r.value += size;
    } else if (stage === "won") r.won++;
    else if (stage === "lost") r.lost++;
    rmMap.set(rmKey, r);

    // over-time (won/lost by closedAt month). Key on a sortable yyyy-mm so
    // chronological ordering never depends on locale date-string parsing.
    if ((stage === "won" || stage === "lost") && m.closedAt) {
      const d2 = new Date(m.closedAt);
      if (!Number.isNaN(d2.getTime())) {
        const key = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, "0")}`;
        const b = monthBuckets.get(key) ?? { won: 0, lost: 0 };
        if (stage === "won") b.won++;
        else b.lost++;
        monthBuckets.set(key, b);
      }
    }
  }

  const closed = won + lost;
  const conversionRate = closed > 0 ? (won / closed) * 100 : 0;

  const bySource: SourceBreakdown[] = LEAD_SOURCE_ORDER.filter((s) =>
    sourceMap.has(s),
  ).map((s) => {
    const v = sourceMap.get(s)!;
    const c = v.won + v.lost;
    return {
      source: s,
      total: v.total,
      won: v.won,
      open: v.open,
      rate: c > 0 ? (v.won / c) * 100 : 0,
      pipelineValueCr: v.value,
    };
  });

  const byDealType: DealTypeBreakdown[] = LEAD_DEAL_TYPE_ORDER.filter((d) =>
    dealTypeMap.has(d),
  ).map((d) => {
    const v = dealTypeMap.get(d)!;
    const c = v.won + v.lost;
    return {
      dealType: d,
      total: v.total,
      won: v.won,
      open: v.open,
      rate: c > 0 ? (v.won / c) * 100 : 0,
      pipelineValueCr: v.value,
    };
  });

  const byRm: RmBreakdown[] = Array.from(rmMap.entries())
    .map(([rmUserId, v]) => {
      const c = v.won + v.lost;
      return {
        rmUserId: rmUserId === "__unassigned__" ? null : rmUserId,
        rmName: v.name,
        total: v.total,
        won: v.won,
        open: v.open,
        rate: c > 0 ? (v.won / c) * 100 : 0,
        pipelineValueCr: v.value,
      };
    })
    .sort((a, b) => b.pipelineValueCr - a.pipelineValueCr);

  // over-time: last 6 months ending at the most recent closedAt, chronological.
  const overTime: MonthBucket[] = Array.from(monthBuckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([key, v]) => {
      const [y, mo] = key.split("-");
      const d = new Date(Number(y), Number(mo) - 1, 1);
      return {
        month: d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata",
          month: "short",
          year: "numeric",
        }),
        won: v.won,
        lost: v.lost,
      };
    });

  return {
    totalLeads: leads.length,
    open,
    won,
    lost,
    conversionRate,
    pipelineValueCr,
    wonValueCr,
    byStage: LEAD_STAGE_ORDER.map((s) => ({
      stage: s,
      count: byStageCount.get(s) ?? 0,
      valueCr: byStageValue.get(s) ?? 0,
    })),
    bySource,
    byDealType,
    byRm,
    overTime,
    avgBantScore: open > 0 ? bantSum / open : 0,
  };
}

// Re-export the qualification helper for the view layer's convenience.
export { isQualified };
