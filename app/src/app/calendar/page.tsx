import { PageShell, PageHeader } from "@/components/brand/page-shell";
import Link from "next/link";
import { requireUser } from "@/lib/rbac";
import {
  getCalendarEvents,
  type CalendarEvent,
} from "@/features/calendar/queries";
import { Card, CardBody } from "@/components/brand";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Calendar",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const KIND_DOT: Record<CalendarEvent["kind"], string> = {
  task: "bg-gold",
  interaction: "bg-info",
  kyc: "bg-down",
  deal: "bg-emerald",
  notification: "bg-muted-foreground",
};

function parseMonth(searchParams: {
  y?: string;
  m?: string;
}): { year: number; month: number } {
  const now = new Date();
  const year = Number(searchParams.y) || now.getFullYear();
  const month = Number(searchParams.m) || now.getMonth() + 1;
  const m = Math.min(12, Math.max(1, month));
  const y = Math.min(2100, Math.max(2000, year));
  return { year: y, month: m };
}

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** Build Mon-start grid cells for the month (null = padding day). */
function buildGrid(year: number, month: number): (number | null)[] {
  const first = new Date(year, month - 1, 1);
  // JS: 0=Sun … 6=Sat → Mon-start index
  const jsDow = first.getDay();
  const monStart = (jsDow + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < monStart; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const { year, month } = parseMonth(sp);
  const events = await getCalendarEvents(year, month, user);
  const byDate = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }

  const grid = buildGrid(year, month);
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const todayKey = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  })();

  const kindCounts = {
    task: events.filter((e) => e.kind === "task").length,
    interaction: events.filter((e) => e.kind === "interaction").length,
    kyc: events.filter((e) => e.kind === "kyc").length,
    deal: events.filter((e) => e.kind === "deal").length,
  };

  return (
    <PageShell>
      <PageHeader
        title="Calendar"
        description="Tasks, meetings, re-KYC, and deal targets."
        action={
          <a
            href="/calendar"
            className="inline-flex h-9 items-center rounded-md bg-surface px-3 text-[13px] font-medium text-foreground ring-1 ring-hairline hover:bg-surface-2"
          >
            Open calendar
          </a>
        }
      />

      {/* Legend + counts */}
      <div className="mb-4 flex flex-wrap gap-3 text-[12px] text-muted-foreground">
        {(
          [
            ["task", "Tasks", kindCounts.task],
            ["interaction", "Interactions", kindCounts.interaction],
            ["kyc", "Re-KYC", kindCounts.kyc],
            ["deal", "Deal targets", kindCounts.deal],
          ] as const
        ).map(([kind, label, n]) => (
          <span
            key={kind}
            className="inline-flex items-center gap-1.5 rounded-md bg-surface px-2.5 py-1 ring-1 ring-hairline"
          >
            <span className={cn("size-1.5 rounded-full", KIND_DOT[kind])} />
            {label}
            <span className="nums font-medium text-foreground">{n}</span>
          </span>
        ))}
      </div>

      <Card>
        <CardBody className="p-0 md:p-0">
          <div className="grid grid-cols-7 border-b border-hairline">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((day, idx) => {
              if (day === null) {
                return (
                  <div
                    key={`pad-${idx}`}
                    className="min-h-[88px] border-b border-r border-hairline bg-surface-2/40 md:min-h-[110px]"
                  />
                );
              }
              const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayEvents = byDate.get(key) ?? [];
              const isToday = key === todayKey;
              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-[88px] border-b border-r border-hairline p-1.5 md:min-h-[110px] md:p-2",
                    isToday && "bg-gold/[0.04]",
                  )}
                >
                  <div
                    className={cn(
                      "nums mb-1 flex size-6 items-center justify-center rounded-full text-[12px] font-medium",
                      isToday
                        ? "bg-gold text-on-gold"
                        : "text-muted-foreground",
                    )}
                  >
                    {day}
                  </div>
                  <ul className="flex flex-col gap-0.5">
                    {dayEvents.slice(0, 3).map((e) => (
                      <li key={e.id}>
                        <Link
                          href={e.href}
                          className={cn(
                            "flex items-start gap-1 rounded px-1 py-0.5 text-[11px] leading-snug text-foreground hover:bg-surface-2",
                            e.severity === "critical" && "text-down",
                            e.severity === "warning" && "text-gold-deep",
                          )}
                          title={e.title}
                        >
                          <span
                            className={cn(
                              "mt-1 size-1.5 shrink-0 rounded-full",
                              KIND_DOT[e.kind],
                            )}
                          />
                          <span className="line-clamp-2">{e.title}</span>
                        </Link>
                      </li>
                    ))}
                    {dayEvents.length > 3 ? (
                      <li className="px-1 text-[10px] text-muted-foreground">
                        +{dayEvents.length - 3} more
                      </li>
                    ) : null}
                  </ul>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Agenda list for the month */}
      <section className="mt-8">
        <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em]">
          Agenda this month
        </h2>
        {events.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-[13.5px] text-muted-foreground">
                No scheduled tasks, interactions, re-KYC dates, or deal targets
                this month.
              </p>
            </CardBody>
          </Card>
        ) : (
          <ul className="divide-y divide-hairline overflow-hidden rounded-xl bg-surface ring-1 ring-hairline">
            {events.map((e) => (
              <li key={e.id}>
                <Link
                  href={e.href}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      KIND_DOT[e.kind],
                    )}
                  />
                  <span className="nums w-24 shrink-0 text-[12px] text-muted-foreground">
                    {e.date}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground">
                    {e.title}
                  </span>
                  {e.meta ? (
                    <span className="hidden shrink-0 text-[12px] text-muted-foreground sm:inline">
                      {e.meta}
                    </span>
                  ) : null}
                  <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {e.kind}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
