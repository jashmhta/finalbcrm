import Link from "next/link";

import { requireUser } from "@/lib/rbac";
import { getNotificationsAndStats } from "@/features/workflow/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard, CKpi } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";
import { toConsoleHref } from "@/console/lib/console-href";

export const dynamic = "force-dynamic";
export const metadata = { title: "Alerts" };

export default async function ConsoleNotificationsPage() {
  const user = await requireUser();
  const { items, stats } = await getNotificationsAndStats({
    limit: 50,
    user,
  });

  return (
    <div>
      <CPageHeader
        eyebrow="Workflow"
        title="Alerts"
        description="Computed desk signals - dismissals sync across devices when DB migration is applied."
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <CKpi label="Total" value={String(stats.total)} />
        <CKpi label="Unread" value={String(stats.unread)} />
        <CKpi label="Critical" value={String(stats.critical)} />
        <CKpi label="Warning" value={String(stats.warning)} />
      </div>

      {items.length === 0 ? (
        <CEmpty
          title="No alerts"
          body="Your queue is clear. Alerts appear for KYC, stuck deals, overdue tasks, and more."
          actionLabel="Home"
          actionHref="/console"
        />
      ) : (
        <CCard className="divide-y divide-[var(--c-line)] p-0 md:p-0">
          {items.map((n) => (
            <Link
              key={n.id}
              href={toConsoleHref(n.href)}
              className="flex flex-col gap-1 px-4 py-3.5 hover:bg-[var(--c-surface-2)]/60 md:flex-row md:items-center md:gap-4"
            >
              <CBadge
                tone={
                  n.severity === "critical"
                    ? "bad"
                    : n.severity === "warning"
                      ? "warn"
                      : "info"
                }
              >
                {n.severity}
              </CBadge>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[var(--c-ink)]">
                  {n.title}
                </p>
                <p className="text-[12px] text-[var(--c-ink-3)]">{n.description}</p>
              </div>
              <span className="text-[11px] text-[var(--c-ink-3)]">{n.relative}</span>
            </Link>
          ))}
        </CCard>
      )}
    </div>
  );
}
