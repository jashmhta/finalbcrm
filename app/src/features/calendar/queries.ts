// Calendar — unifies tasks, interactions, KYC re-KYC, and deal target dates
// into a single month view for desk planning. Server-only; serializable rows.

import { and, eq, gte, isNull, lte, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { can, type CrmUser } from "@/lib/rbac";
import {
  deal,
  interaction,
  kycRecord,
  party,
  task,
} from "@/db/schema";

export type CalendarEventKind =
  | "task"
  | "interaction"
  | "kyc"
  | "deal"
  | "notification";

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  title: string;
  /** ISO date YYYY-MM-DD (date-only for month grid). */
  date: string;
  href: string;
  severity?: "info" | "warning" | "critical";
  meta?: string;
}

function toDateKey(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === "string") {
    // date columns come back as YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  }
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthDateStrings(year: number, month: number) {
  // month is 1-12; return inclusive YYYY-MM-DD bounds as strings (PgDateString)
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const startTs = new Date(`${start}T00:00:00.000Z`);
  const endTs = new Date(`${end}T23:59:59.999Z`);
  return { start, end, startTs, endTs };
}

/**
 * Load calendar events for a given month (1-12). Scoped by RBAC when the user
 * cannot read-all: tasks assigned to them, parties they own, deals they lead.
 */
export async function getCalendarEvents(
  year: number,
  month: number,
  user: CrmUser,
): Promise<CalendarEvent[]> {
  const { start, end, startTs, endTs } = monthDateStrings(year, month);
  const canAll =
    user.roles.includes("super_admin") ||
    user.roles.includes("admin") ||
    can(user, "read_all", "party");

  const events: CalendarEvent[] = [];
  const today = new Date().toISOString().slice(0, 10);

  // Tasks due this month
  const taskWhere = [
    isNull(task.deletedAt),
    gte(task.dueDate, start),
    lte(task.dueDate, end),
  ];
  if (!canAll && user.appUserId) {
    taskWhere.push(eq(task.assigneeUserId, user.appUserId));
  }

  const tasks = await db
    .select({
      id: task.taskId,
      title: task.title,
      due: task.dueDate,
      status: task.status,
      priority: task.priority,
    })
    .from(task)
    .where(and(...taskWhere))
    .limit(200);

  for (const t of tasks) {
    const date = toDateKey(t.due);
    if (!date) continue;
    const overdue =
      t.status !== "completed" &&
      t.status !== "cancelled" &&
      !!date &&
      date < today;
    events.push({
      id: `task:${t.id}`,
      kind: "task",
      title: t.title,
      date,
      href: `/tasks/${t.id}`,
      severity: overdue
        ? "critical"
        : t.priority === "high" || t.priority === "urgent"
          ? "warning"
          : "info",
      meta: t.status ?? undefined,
    });
  }

  // Interactions (timestamptz)
  const interactions = await db
    .select({
      id: interaction.interactionId,
      subject: interaction.subject,
      at: interaction.occurredAt,
      channel: interaction.channel,
    })
    .from(interaction)
    .where(
      and(
        isNull(interaction.deletedAt),
        gte(interaction.occurredAt, startTs),
        lte(interaction.occurredAt, endTs),
      ),
    )
    .limit(200);

  for (const i of interactions) {
    const date = toDateKey(i.at);
    if (!date) continue;
    events.push({
      id: `interaction:${i.id}`,
      kind: "interaction",
      title: i.subject ?? `${i.channel ?? "Interaction"}`,
      date,
      href: `/interactions/${i.id}`,
      severity: "info",
      meta: i.channel ?? undefined,
    });
  }

  // KYC re-KYC due this month
  const kycScope =
    !canAll && user.appUserId
      ? or(
          eq(party.assignedUserId, user.appUserId),
          eq(party.dataOwnerUserId, user.appUserId),
        )
      : undefined;

  const kycs = await db
    .select({
      id: kycRecord.kycRecordId,
      partyId: kycRecord.partyId,
      due: kycRecord.rekycDueDate,
      name: party.legalName,
    })
    .from(kycRecord)
    .innerJoin(party, eq(party.partyId, kycRecord.partyId))
    .where(
      and(
        isNull(kycRecord.deletedAt),
        isNull(party.deletedAt),
        sql`${kycRecord.rekycDueDate} is not null`,
        gte(kycRecord.rekycDueDate, start),
        lte(kycRecord.rekycDueDate, end),
        kycScope,
      ),
    )
    .limit(100);

  for (const k of kycs) {
    const date = toDateKey(k.due);
    if (!date) continue;
    events.push({
      id: `kyc:${k.id}`,
      kind: "kyc",
      title: `Re-KYC · ${k.name}`,
      date,
      href: `/compliance/kyc/${k.id}`,
      severity: "warning",
      meta: "PMLA re-KYC",
    });
  }

  // Deal target close dates
  const dealScope =
    !canAll && user.appUserId
      ? eq(deal.leadUserId, user.appUserId)
      : undefined;

  const deals = await db
    .select({
      id: deal.dealId,
      code: deal.dealCode,
      name: deal.dealName,
      target: deal.targetCloseDate,
      status: deal.status,
    })
    .from(deal)
    .where(
      and(
        isNull(deal.deletedAt),
        sql`${deal.targetCloseDate} is not null`,
        gte(deal.targetCloseDate, start),
        lte(deal.targetCloseDate, end),
        dealScope,
      ),
    )
    .limit(100);

  for (const d of deals) {
    const date = toDateKey(d.target);
    if (!date) continue;
    events.push({
      id: `deal:${d.id}`,
      kind: "deal",
      title: d.code ?? d.name ?? "Deal target close",
      date,
      href: `/deals/${d.id}`,
      severity: "info",
      meta: d.status ?? undefined,
    });
  }

  events.sort(
    (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
  );
  return events;
}
