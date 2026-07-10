import Link from "next/link";

import { requireUser } from "@/lib/rbac";
import { getCalendarEvents } from "@/features/calendar/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";
import { toConsoleHref } from "@/console/lib/console-href";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar" };

export default async function ConsoleCalendarPage() {
  const user = await requireUser();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const events = await getCalendarEvents(year, month, user);

  const monthLabel = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(now);

  return (
    <div>
      <CPageHeader
        eyebrow="Workspace"
        title="Calendar"
        description={`${monthLabel} · ${events.length} events in scope.`}
      />
      {events.length === 0 ? (
        <CEmpty
          title="Nothing scheduled this month"
          body="Task due dates and related events appear here."
          actionLabel="Tasks"
          actionHref="/console/tasks"
        />
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={`${e.kind}-${e.id}`}>
              <Link href={toConsoleHref(e.href)} className="block">
                <CCard className="flex flex-wrap items-center justify-between gap-2 p-3 transition-colors hover:bg-[var(--c-surface)]">
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--c-ink)]">
                      {e.title}
                    </p>
                    <p className="text-[12px] text-[var(--c-ink-3)]">
                      {e.date}
                      {e.meta ? ` · ${e.meta}` : ""}
                    </p>
                  </div>
                  <CBadge tone="info">{e.kind}</CBadge>
                </CCard>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
