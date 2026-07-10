import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Flag,
  CalendarBlank,
  Warning,
  User,
  Buildings,
  ArrowsLeftRight,
  ArrowRight,
  Sparkle,
  ListChecks,
  LinkBreak,
} from "@/components/brand/icons";

import { requireUser } from "@/lib/rbac";
import { getTaskDetail } from "@/features/tasks/queries";
import {
  Card,
  Badge,
  Button,
  Reveal,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableEmpty,
} from "@/components/brand";
import { Eyebrow, SectionHeading } from "@/components/brand/text";
import { TaskStatusForm } from "./task-status-form";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";

export const dynamic = "force-dynamic";

const STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
  "blocked",
  "deferred",
] as const;

function statusVariant(
  status: string | null,
): React.ComponentProps<typeof Badge>["variant"] {
  if (!status) return "neutral";
  if (status === "completed") return "emerald";
  if (status === "blocked") return "down";
  if (status === "cancelled" || status === "deferred") return "outline";
  if (status === "in_progress") return "info";
  return "neutral";
}

function priorityVariant(
  priority: string | null,
): React.ComponentProps<typeof Badge>["variant"] {
  if (priority === "urgent") return "down";
  if (priority === "high") return "gold";
  if (priority === "low") return "outline";
  return "neutral";
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const d = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const detail = await getTaskDetail(id, user);
  if (!detail) notFound();

  const { task: t, assigneeEmail, dealCode, dealName, partyName, dependencies, dependents } =
    detail;

  const overdue = isOverdue(t.dueDate) && t.status !== "completed";

  return (
    <PageShell>
      <DetailTopBar
        backHref="/tasks"
        backLabel="Tasks"
        crumb={t.taskId.slice(0, 8)}
        action={
          <Button asChild variant="secondary-hairline" size="sm">
            <Link href="/tasks">All tasks</Link>
          </Button>
        }
      />
      <PageHeader title={t.title} description="Status, due date, assignee, and dependencies." />

      {/* Header band */}
      <Reveal y={14} duration={0.6}>
        <Card className="mb-8 overflow-hidden">
          <div className="flex flex-col gap-6 p-6 md:p-8">

            {/* Meta rail */}
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-hairline pt-5 text-[12.5px]">
              <MetaItem icon={<CalendarBlank weight="light" />} label="Due">
                {t.dueDate ? (
                  <span
                    className={
                      overdue ? "nums tabular-nums text-down" : "nums tabular-nums"
                    }
                  >
                    {new Date(`${t.dueDate}T00:00:00`).toLocaleDateString(
                      "en-IN",
                      { year: "numeric", month: "short", day: "2-digit" },
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground/60">no due date</span>
                )}
              </MetaItem>
              <MetaItem icon={<User weight="light" />} label="Assignee">
                {assigneeEmail ?? (
                  <span className="text-muted-foreground/60">unassigned</span>
                )}
              </MetaItem>
              <MetaItem icon={<LinkBreak weight="light" />} label="Dependencies">
                <span className="nums tabular-nums">{dependencies.length}</span>
              </MetaItem>
              <MetaItem icon={<ListChecks weight="light" />} label="Blocks">
                <span className="nums tabular-nums">{dependents.length}</span>
              </MetaItem>
              {t.completedAt ? (
                <MetaItem icon={<ArrowRight weight="light" />} label="Completed">
                  <span className="nums tabular-nums">
                    {t.completedAt.toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </MetaItem>
              ) : null}
            </div>

            {/* Status control */}
            <div className="flex items-center justify-end border-t border-hairline pt-5">
              <TaskStatusForm
                taskId={t.taskId}
                current={t.status ?? "pending"}
                statuses={[...STATUSES]}
              />
            </div>
          </div>
        </Card>
      </Reveal>

      {t.description ? (
        <Reveal y={14} duration={0.6} delay={0.05} className="mb-6">
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 p-6">
              <Eyebrow>Description</Eyebrow>
              <p className="whitespace-pre-wrap text-[13.5px] leading-[1.65] text-foreground/85">
                {t.description}
              </p>
            </div>
          </Card>
        </Reveal>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Context */}
        <Reveal y={14} duration={0.6} delay={0.05}>
          <Card className="h-full">
            <div className="flex flex-col gap-4 p-6">
              <Eyebrow>Context</Eyebrow>
              <div className="flex flex-col gap-3.5 text-[13.5px]">
                <ContextRow icon={<User weight="light" />} label="Assignee">
                  {assigneeEmail ?? (
                    <span className="text-muted-foreground/60">-</span>
                  )}
                </ContextRow>
                <ContextRow icon={<Buildings weight="light" />} label="Party">
                  {partyName && t.partyId ? (
                    <Link
                      href={`/parties/${t.partyId}`}
                      className="transition-colors duration-200 ease-soft hover:text-gold"
                    >
                      {partyName}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground/60">-</span>
                  )}
                </ContextRow>
                <ContextRow
                  icon={<ArrowsLeftRight weight="light" />}
                  label="Deal"
                >
                  {dealCode ? (
                    <Link
                      href="/deals"
                      className="nums transition-colors duration-200 ease-soft hover:text-gold"
                    >
                      {dealCode}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground/60">-</span>
                  )}
                  {dealName ? (
                    <span className="ml-2 text-muted-foreground">
                      {dealName}
                    </span>
                  ) : null}
                </ContextRow>
                {t.parentTaskId ? (
                  <ContextRow icon={<ListChecks weight="light" />} label="Parent">
                    <Link
                      href={`/tasks/${t.parentTaskId}`}
                      className="nums transition-colors duration-200 ease-soft hover:text-gold"
                    >
                      {t.parentTaskId.slice(0, 8)}
                    </Link>
                  </ContextRow>
                ) : null}
                {t.completedAt ? (
                  <ContextRow icon={<ArrowRight weight="light" />} label="Completed">
                    <span className="nums tabular-nums text-foreground/80">
                      {t.completedAt.toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </ContextRow>
                ) : null}
              </div>
            </div>
          </Card>
        </Reveal>

        {/* Dependencies */}
        <Reveal y={14} duration={0.6} delay={0.1}>
          <Card className="h-full overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-6 pt-6">
              <div className="flex items-center gap-2">
                <Eyebrow dot>Depends on</Eyebrow>
                <span className="nums text-[12.5px] text-muted-foreground/70">
                  {dependencies.length}
                </span>
              </div>
            </div>
            <div className="mt-2">
              <Table density="compact">
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dependencies.length === 0 ? (
                    <TableRow className="hover:bg-transparent before:hidden">
                      <TableCell colSpan={2} className="p-0">
                        <TableEmpty
                          icon={<Sparkle weight="light" />}
                          title="No dependencies."
                          hint="This task can start immediately."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    dependencies.map((d) => (
                      <TableRow key={d.dependsOnTaskId}>
                        <TableCell primary>
                          <Link
                            href={`/tasks/${d.dependsOnTaskId}`}
                            className="group/dep inline-flex flex-col"
                          >
                            <span className="transition-colors duration-200 ease-soft group-hover/dep:text-gold">
                              {d.dependsOnTitle}
                            </span>
                            <span className="nums text-[11px] text-muted-foreground/70">
                              {d.dependsOnTaskId.slice(0, 8)}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          {d.dependsOnStatus ? (
                            <Badge variant={statusVariant(d.dependsOnStatus)}>
                              {d.dependsOnStatus.replace(/_/g, " ")}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/60">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </Reveal>
      </div>

      {/* Blocks */}
      <Reveal y={14} duration={0.6} delay={0.1} className="mt-6">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-6 pt-6">
            <div className="flex items-center gap-2">
              <Eyebrow dot>Blocks</Eyebrow>
              <span className="nums text-[12.5px] text-muted-foreground/70">
                {dependents.length}
              </span>
            </div>
          </div>
          <div className="mt-2">
            <Table density="compact">
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dependents.length === 0 ? (
                  <TableRow className="hover:bg-transparent before:hidden">
                    <TableCell colSpan={2} className="p-0">
                      <TableEmpty
                        icon={<Sparkle weight="light" />}
                        title="Nothing is blocked by this task."
                        hint="Completing it won't unblock any downstream work."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  dependents.map((d) => (
                    <TableRow key={d.taskId}>
                      <TableCell primary>
                        <Link
                          href={`/tasks/${d.taskId}`}
                          className="group/dep inline-flex flex-col"
                        >
                            <span className="transition-colors duration-200 ease-soft group-hover/dep:text-gold">
                            {d.title}
                          </span>
                          <span className="nums text-[11px] text-muted-foreground/70">
                            {d.taskId.slice(0, 8)}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        {d.status ? (
                          <Badge variant={statusVariant(d.status)}>
                            {d.status.replace(/_/g, " ")}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/60">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </Reveal>
    </PageShell>
  );
}

function MetaItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70 [&_svg]:size-3.5">
        {icon}
        {label}
      </span>
      <span className="text-foreground/85">{children}</span>
    </div>
  );
}

function ContextRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline/50 pb-3.5 last:border-0 last:pb-0">
      <span className="inline-flex items-center gap-2 text-muted-foreground [&_svg]:size-4">
        {icon}
        {label}
      </span>
      <span className="text-right text-foreground/85">{children}</span>
    </div>
  );
}
