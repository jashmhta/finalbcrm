import Link from "next/link";

import { requireUser, can } from "@/lib/rbac";
import { listTasks } from "@/features/tasks/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";
import { ListSearch } from "@/console/patterns/list-search";
import { TaskStatusForm } from "./status-form";
import { NewTaskForm } from "./new-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tasks" };

export default async function ConsoleTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  if (!can(user, "read", "task") && !can(user, "create", "task")) {
    return (
      <CEmpty
        title="No task access"
        body="You need task:read to view the worklist."
        actionLabel="Home"
        actionHref="/console"
      />
    );
  }

  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const { rows, total } = await listTasks({
    user,
    openOnly: true,
    page: 1,
    pageSize: 50,
    q,
  });

  return (
    <div>
      <CPageHeader
        eyebrow="Workspace"
        title="Tasks"
        description={`${total} open items in your scope.`}
      />
      <ListSearch
        action="/console/tasks"
        q={q}
        placeholder="Search task title…"
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-2">
          {rows.length === 0 ? (
            <CEmpty
              title="No open tasks"
              body="Create a follow-up for a party or deal."
            />
          ) : (
            rows.map((t) => (
              <CCard key={t.taskId} className="p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/console/tasks/${t.taskId}`}
                      className="text-[13px] font-semibold text-[var(--c-accent)] hover:underline"
                    >
                      {t.title}
                    </Link>
                    <p className="mt-0.5 text-[12px] text-[var(--c-ink-3)]">
                      {t.priority} · due {t.dueDate ?? "—"}
                      {t.partyName ? ` · ${t.partyName}` : ""}
                      {t.dealCode ? ` · ${t.dealCode}` : ""}
                    </p>
                  </div>
                  <CBadge
                    tone={
                      t.status === "blocked"
                        ? "bad"
                        : t.status === "in_progress"
                          ? "info"
                          : "neutral"
                    }
                  >
                    {t.status}
                  </CBadge>
                </div>
                {can(user, "update", "task") ? (
                  <div className="mt-2">
                    <TaskStatusForm taskId={t.taskId} status={t.status ?? "pending"} />
                  </div>
                ) : null}
              </CCard>
            ))
          )}
        </div>
        <div>
          {can(user, "create", "task") ? (
            <CCard>
              <h2 className="mb-3 text-[13px] font-semibold">New task</h2>
              <NewTaskForm />
            </CCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
