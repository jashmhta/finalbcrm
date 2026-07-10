"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowFatDown,
  CalendarBlank,
  Flag,
  Warning,
  ListChecks,
  Sparkle,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type {
  TaskListItem,
  AssigneeOption,
} from "@/features/tasks/queries";
import {
  Card,
  Badge,
  Button,
  CommandBar,
  Reveal,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableEmpty,
  type Density,
} from "@/components/brand";
import { Num } from "@/components/brand/money";
import { ExportCsvButton } from "@/features/reports/export-button";
import { NewTaskDialog } from "./new-task-dialog";

export interface TasksListViewProps {
  rows: TaskListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q?: string;
  statusKey: string;
  assigneeUserId?: string;
  assignees: AssigneeOption[];
  statusFilters: ReadonlyArray<{
    key: string;
    label: string;
    openOnly?: boolean;
  }>;
}

function formatDueDate(value: string | null): {
  label: string;
  overdue: boolean;
} {
  if (!value) return { label: "-", overdue: false };
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { label: value, overdue: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = d < today;
  const label = d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
  return { label, overdue };
}

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

export function TasksListView({
  rows,
  total,
  page,
  pageSize,
  totalPages,
  q,
  statusKey,
  assigneeUserId,
  assignees,
  statusFilters,
}: TasksListViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [density, setDensity] = React.useState<Density>("comfortable");
  const [search, setSearch] = React.useState(q ?? "");

  React.useEffect(() => {
    setSearch(q ?? "");
  }, [q]);

  const pushSearch = React.useCallback(
    (value: string) => {
      const params = new URLSearchParams(sp.toString());
      if (value.trim()) params.set("q", value.trim());
      else params.delete("q");
      params.delete("page");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, sp],
  );

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchChange = React.useCallback(
    (value: string) => {
      setSearch(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => pushSearch(value), 280);
    },
    [pushSearch],
  );
  React.useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  function pushAssignee(value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set("assignee", value);
    else params.delete("assignee");
    params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const rangeFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-5">
      {/* Status filter rail - pill segments */}
      <Reveal y={8} duration={0.5} noBlur>
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-foreground/[0.02] p-1.5 ring-1 ring-hairline/60">
          {statusFilters.map((f) => {
            const active = f.key === statusKey;
            return (
              <Link
                key={f.key}
                href={`/tasks?${new URLSearchParams({
                  status: f.key,
                  ...(assigneeUserId ? { assignee: assigneeUserId } : {}),
                  ...(q ? { q } : {}),
                }).toString()}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-medium transition-all duration-200 ease-soft",
                  active
                    ? "bg-surface text-foreground shadow-soft ring-1 ring-hairline"
                    : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
                )}
              >
                {f.key === "all" ? (
                  <ListChecks weight="light" className="size-3.5" />
                ) : null}
                {f.label}
              </Link>
            );
          })}
        </div>
      </Reveal>

      <CommandBar
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search by title…"
        density={density}
        onDensityChange={setDensity}
        label={`${total} ${total === 1 ? "task" : "tasks"}`}
        filters={
          <AssigneeSelect
            value={assigneeUserId ?? ""}
            onChange={pushAssignee}
            assignees={assignees}
          />
        }
        actions={
          <>
            <ExportCsvButton type="tasks" />
            <NewTaskDialog />
          </>
        }
      />

      <Reveal y={14}>
        <Card className="overflow-hidden">
          <Table density={density}>
            <TableHeader>
              <TableRow>
                <TableHead>Due</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Status</TableHead>
                {/* Mobile: key-columns-only - Priority / Assignee / Context are
                    secondary on a phone, dropped below md so the worklist reads
                    Due · Task · Status. md+ restores the full 6-col read. */}
                <TableHead className="hidden md:table-cell">Priority</TableHead>
                <TableHead className="hidden md:table-cell">Assignee</TableHead>
                <TableHead className="hidden md:table-cell">Context</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="hover:bg-transparent before:hidden">
                  <TableCell colSpan={6} className="p-0">
                    <TableEmpty
                      icon={<Sparkle weight="light" />}
                      title={
                        total === 0
                          ? "The worklist is clear."
                          : "No tasks match this filter."
                      }
                      hint={
                        total === 0
                          ? "Create a task to start tracking the team's open work."
                          : "Try a different status filter or clear the search."
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((t) => {
                  const due = formatDueDate(t.dueDate);
                  return (
                    <TableRow key={t.taskId}>
                      <TableCell>
                        <span
                          className={cn(
                            "nums tabular-nums inline-flex items-center gap-1.5",
                            due.overdue
                              ? "text-down"
                              : "text-muted-foreground",
                          )}
                        >
                          {due.overdue ? (
                            <Warning weight="light" className="size-3.5" />
                          ) : (
                            <CalendarBlank
                              weight="light"
                              className="size-3.5 text-muted-foreground/60"
                            />
                          )}
                          {due.label}
                        </span>
                      </TableCell>
                      <TableCell primary>
                        <Link
                          href={`/tasks/${t.taskId}`}
                          className="group/task inline-flex flex-col gap-0.5"
                        >
                          <span className="transition-colors duration-200 ease-soft group-hover/task:text-gold">
                            {t.title}
                          </span>
                          {t.blockedByCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-down/90">
                              <Warning weight="light" className="size-3" />
                              blocked by{" "}
                              <Num value={t.blockedByCount} /> task
                              {t.blockedByCount === 1 ? "" : "s"}
                            </span>
                          ) : null}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {t.status ? (
                          <Badge variant={statusVariant(t.status)}>
                            {t.status.replace(/_/g, " ")}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/60">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {t.priority ? (
                          <Badge
                            variant={priorityVariant(t.priority)}
                            icon={<Flag weight="light" />}
                          >
                            {t.priority}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/60">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {t.assigneeEmail ? (
                          <span className="text-[12.5px] text-foreground/80">
                            {t.assigneeEmail}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">
                            unassigned
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-col gap-0.5 text-[12.5px]">
                          {t.partyName ? (
                            <Link
                              href={`/parties/${t.partyId}`}
                              className="transition-colors duration-200 ease-soft hover:text-gold"
                            >
                              {t.partyName}
                            </Link>
                          ) : null}
                          {t.dealCode ? (
                            <Link
                              href="/deals"
                              className="nums text-muted-foreground transition-colors duration-200 ease-soft hover:text-foreground"
                            >
                              {t.dealCode}
                            </Link>
                          ) : null}
                          {!t.partyName && !t.dealCode ? (
                            <span className="text-muted-foreground/60">-</span>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </Reveal>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12.5px] text-muted-foreground">
          {total === 0 ? (
            "Nothing to show."
          ) : (
            <>
              <span className="nums tabular-nums text-foreground/80">
                {rangeFrom.toLocaleString("en-IN")}–
                {rangeTo.toLocaleString("en-IN")}
              </span>{" "}
              of{" "}
              <span className="nums tabular-nums text-foreground/80">
                {total.toLocaleString("en-IN")}
              </span>{" "}
              tasks
            </>
          )}
        </p>
        {totalPages > 1 ? (
          <Pagination
            page={page}
            totalPages={totalPages}
            statusKey={statusKey}
            assigneeUserId={assigneeUserId}
            q={q}
          />
        ) : null}
      </div>
    </div>
  );
}

function AssigneeSelect({
  value,
  onChange,
  assignees,
}: {
  value: string;
  onChange: (v: string) => void;
  assignees: AssigneeOption[];
}) {
  return (
    <div className="group/field relative inline-flex items-center rounded-full bg-foreground/[0.04] ring-1 ring-hairline/60 transition-all duration-200 ease-soft focus-within:ring-hairline">
      <select
        aria-label="Filter by assignee"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 w-full appearance-none rounded-full bg-transparent pl-3.5 pr-8 text-[12.5px] text-foreground",
          "focus:outline-none",
        )}
      >
        <option value="">All assignees</option>
        {assignees.map((a) => (
          <option key={a.userId} value={a.userId}>
            {a.email}
            {a.desk ? ` · ${a.desk}` : ""}
          </option>
        ))}
      </select>
      <ArrowFatDown
        aria-hidden
        weight="light"
        className="pointer-events-none absolute right-3 size-3 text-muted-foreground"
      />
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  statusKey,
  assigneeUserId,
  q,
}: {
  page: number;
  totalPages: number;
  statusKey: string;
  assigneeUserId?: string;
  q?: string;
}) {
  const pageHref = (p: number) =>
    `/tasks?${new URLSearchParams({
      status: statusKey,
      ...(assigneeUserId ? { assignee: assigneeUserId } : {}),
      ...(q ? { q } : {}),
      page: String(p),
    }).toString()}`;

  const pages: number[] = [];
  const win = 1;
  const start = Math.max(1, page - win);
  const end = Math.min(totalPages, page + win);
  for (let i = start; i <= end; i++) pages.push(i);

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <div className="flex items-center gap-1.5">
      <Button
        asChild
        variant="secondary-hairline"
        size="icon-sm"
        aria-disabled={prevDisabled}
        className={cn(prevDisabled && "pointer-events-none opacity-40")}
      >
        <Link href={pageHref(Math.max(1, page - 1))} aria-label="Previous page">
          <ArrowLeft weight="light" className="size-4" />
        </Link>
      </Button>

      {start > 1 ? (
        <>
          <PagePill href={pageHref(1)} active={page === 1}>
            1
          </PagePill>
          {start > 2 ? (
            <span className="px-1 text-muted-foreground/60">…</span>
          ) : null}
        </>
      ) : null}

      {pages.map((p) => (
        <PagePill key={p} href={pageHref(p)} active={p === page}>
          {p}
        </PagePill>
      ))}

      {end < totalPages ? (
        <>
          {end < totalPages - 1 ? (
            <span className="px-1 text-muted-foreground/60">…</span>
          ) : null}
          <PagePill href={pageHref(totalPages)} active={page === totalPages}>
            {totalPages}
          </PagePill>
        </>
      ) : null}

      <Button
        asChild
        variant="secondary-hairline"
        size="icon-sm"
        aria-disabled={nextDisabled}
        className={cn(nextDisabled && "pointer-events-none opacity-40")}
      >
        <Link
          href={pageHref(Math.min(totalPages, page + 1))}
          aria-label="Next page"
        >
          <ArrowRight weight="light" className="size-4" />
        </Link>
      </Button>
    </div>
  );
}

function PagePill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2.5 text-[12.5px] transition-all duration-200 ease-soft",
        active
          ? "bg-gold/15 text-gold-deep ring-1 ring-gold/30"
          : "text-muted-foreground ring-1 ring-hairline hover:bg-foreground/[0.04] hover:text-foreground",
      )}
    >
      <span className="nums tabular-nums">{children}</span>
    </Link>
  );
}