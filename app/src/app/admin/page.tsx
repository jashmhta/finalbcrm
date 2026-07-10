import { PageHeader, PageShell } from "@/components/brand/page-shell";
// Admin dashboard - system stats, recent audit, system health.
//
// The admin's at-a-glance posture: counts (users / roles / deals / parties /
// DB size), a security health rail (active / inactive / locked / MFA / never-
// logged-in + audit hash-chain integrity), and the recent audit event rail +
// breakdowns (entity / operation / top actors). All reads are server-side;
// the client view owns the motion + count-ups.

import { requireUser, can } from "@/lib/rbac";
import { redirect } from "next/navigation";
import {
  getSystemStats,
  getSystemHealth,
  listRecentAuditEntries,
  getAuditEntityBreakdown,
  getAuditOperationBreakdown,
  getTopAuditActors,
} from "@/features/admin/queries";
import { Reveal } from "@/components/brand";
import { AdminDashboardView } from "./dashboard-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin · Binary Capital CRM",
};

export default async function AdminDashboardPage() {
  const user = await requireUser();
  // The admin panel is gated to roles that can manage users or read audit. The
  // proxy only checks authentication; RBAC is enforced here (ARCHITECTURE §4.6).
  if (!can(user, "manage", "user") && !can(user, "read", "audit")) {
    redirect("/parties");
  }

  const [stats, health, recent, entityBreak, opBreak, topActors] =
    await Promise.all([
      getSystemStats(),
      getSystemHealth(),
      listRecentAuditEntries(12),
      getAuditEntityBreakdown(10),
      getAuditOperationBreakdown(),
      getTopAuditActors(8),
    ]);

  // activeUsers = stats.activeUserCount (cheaper than a second query - already
  // fetched in stats). The health read intentionally does not re-fetch it.
  health.activeUsers = stats.activeUserCount;

  return (
    <PageShell>
      <PageHeader title="Admin" description="Users, roles, master data, and audit." />

      <AdminDashboardView
        stats={stats}
        health={health}
        recent={recent}
        entityBreak={entityBreak}
        opBreak={opBreak}
        topActors={topActors}
      />
    </PageShell>
  );
}
