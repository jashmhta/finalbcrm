import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser, can } from "@/lib/rbac";
import { getTaskDetail } from "@/features/tasks/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";
import { TaskStatusForm } from "../status-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Task" };

export default async function ConsoleTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "read", "task") && !can(user, "create", "task")) {
    return (
      <CEmpty
        title="No task access"
        body="You need task:read to view this task."
        actionLabel="Home"
        actionHref="/console"
      />
    );
  }

  const { id } = await params;
  const detail = await getTaskDetail(id, user);
  if (!detail) notFound();

  const t = detail.task;

  return (
    <div>
      <CPageHeader
        eyebrow={`Task · ${t.status ?? "open"}`}
        title={t.title}
        description={t.description ?? undefined}
        actions={
          <Link
            href="/console/tasks"
            className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] px-4 text-[13px] ring-1 ring-[var(--c-line-strong)]"
          >
            Worklist
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <CBadge
          tone={
            t.status === "blocked"
              ? "bad"
              : t.status === "in_progress"
                ? "info"
                : t.status === "completed"
                  ? "ok"
                  : "neutral"
          }
        >
          {t.status ?? "pending"}
        </CBadge>
        {t.priority ? <CBadge tone="accent">{t.priority}</CBadge> : null}
        {t.dueDate ? <CBadge tone="warn">Due {String(t.dueDate)}</CBadge> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <CCard className="lg:col-span-2 space-y-3">
          <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
            <Row k="Assignee" v={detail.assigneeEmail ?? t.assigneeUserId ?? "—"} />
            <Row k="Due" v={t.dueDate ? String(t.dueDate) : "—"} />
            <Row k="Party" v={detail.partyName ?? "—"} />
            <Row
              k="Deal"
              v={
                detail.dealCode || detail.dealName
                  ? `${detail.dealCode ?? ""} ${detail.dealName ?? ""}`.trim()
                  : "—"
              }
            />
          </dl>
          {t.description ? (
            <p className="text-[13px] leading-relaxed text-[var(--c-ink-2)]">
              {t.description}
            </p>
          ) : null}
          {can(user, "update", "task") ? (
            <div className="pt-2">
              <TaskStatusForm taskId={t.taskId} status={t.status ?? "pending"} />
            </div>
          ) : null}
        </CCard>

        <CCard>
          <h2 className="mb-3 text-[13px] font-semibold">Next actions</h2>
          <ul className="space-y-2 text-[13px]">
            {t.partyId ? (
              <li>
                <Link
                  className="text-[var(--c-accent)]"
                  href={`/console/parties/${t.partyId}`}
                >
                  Open party
                </Link>
              </li>
            ) : null}
            {t.dealId ? (
              <li>
                <Link
                  className="text-[var(--c-accent)]"
                  href={`/console/deals/${t.dealId}`}
                >
                  Open deal
                </Link>
              </li>
            ) : null}
            <li>
              <Link className="text-[var(--c-accent)]" href="/console/tasks">
                All tasks
              </Link>
            </li>
            <li>
              <Link className="text-[var(--c-accent)]" href="/console/calendar">
                Calendar
              </Link>
            </li>
          </ul>
        </CCard>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 border-b border-[var(--c-line)] pb-2 last:border-0">
      <dt className="text-[var(--c-ink-3)]">{k}</dt>
      <dd className="text-right font-medium text-[var(--c-ink)]">{v}</dd>
    </div>
  );
}
