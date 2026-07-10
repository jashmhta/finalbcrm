import { PageHeader, PageShell } from "@/components/brand/page-shell";
import { requireUser } from "@/lib/rbac";
import {
  listTasks,
  listAssigneeOptions,
  type AssigneeOption,
} from "@/features/tasks/queries";
import { Reveal } from "@/components/brand";
import { TasksListView } from "./tasks-list-view";

// DB-backed worklist - never prerender.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export const STATUS_FILTERS = [
  { key: "all", label: "All open", openOnly: true },
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In progress" },
  { key: "blocked", label: "Blocked" },
  { key: "completed", label: "Completed" },
  { key: "deferred", label: "Deferred" },
  { key: "cancelled", label: "Cancelled" },
] as const;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    assignee?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const statusKey = sp.status ?? "all";
  const assigneeUserId = sp.assignee || undefined;

  const filter =
    STATUS_FILTERS.find((f) => f.key === statusKey) ?? STATUS_FILTERS[0];
  const { rows, total, page: curPage, pageSize } = await listTasks({
    status:
      "openOnly" in filter && filter.openOnly ? undefined : filter.key,
    openOnly: "openOnly" in filter && filter.openOnly,
    assigneeUserId,
    q,
    user,
    page,
    pageSize: PAGE_SIZE,
  });
  const assignees = await listAssigneeOptions();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <PageShell>
      <PageHeader title="Tasks" description="Desk work queue and follow-ups." />

      <TasksListView
        rows={rows}
        total={total}
        page={curPage}
        pageSize={pageSize}
        totalPages={totalPages}
        q={q}
        statusKey={statusKey}
        assigneeUserId={assigneeUserId}
        assignees={assignees}
        statusFilters={STATUS_FILTERS}
      />
    </PageShell>
  );
}
