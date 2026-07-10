import { PageShell, PageHeader } from "@/components/brand/page-shell";
import { requireUser } from "@/lib/rbac";
import { getNotificationsAndStats } from "@/features/workflow/queries";
import { Reveal } from "@/components/brand";
import { NotificationsCenter } from "./notifications-center";

// The notification center - computed alerts (KYC, deals, credit, tasks,
// consent) with severity filters + read state. DB-backed (scans five tables)
// and read-state is cookie-backed, so never prerender. force-dynamic keeps
// every scan out of the build.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Notifications · Binary Capital CRM",
};

export default async function NotificationsPage() {
  const user = await requireUser();

  // One engine pass → a bounded window of items (with read flags) + the
  // FULL-CARD severity/unread stats for the StatCards. `limit: 50` keeps the
  // rendered list light (the engine can compute thousands of notifications
  // from the 10k-party book - rendering all of them was the 499KB lag); stats
  // are computed over the full set so the StatCards still report the true
  // outstanding workload, not just the visible 50. `stats.total` is the full
  // notification count, passed as `total` so the center can show
  // "Showing 50 of N - Load more". The engine recomputes fresh on every load,
  // so a cleared trigger (completed task, advanced deal, refreshed KYC)
  // naturally drops its notification without any stale-state cleanup.
  const PAGE_LIMIT = 50;
  const { items, stats } = await getNotificationsAndStats({
    limit: PAGE_LIMIT,
    user,
  });

  return (
    <PageShell>
      <PageHeader
        title="Notifications"
        description="KYC, deals, tasks, and compliance alerts."
        action={
          <a
            href="/calendar"
            className="inline-flex h-9 items-center rounded-md bg-surface px-3 text-[13px] font-medium text-foreground ring-1 ring-hairline hover:bg-surface-2"
          >
            Open calendar
          </a>
        }
      />

      <Reveal y={8} duration={0.35} noBlur>
        <NotificationsCenter items={items} stats={stats} total={stats.total} />
      </Reveal>
    </PageShell>
  );
}
