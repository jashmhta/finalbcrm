import { PageHeader, PageShell } from "@/components/brand/page-shell";
import { requireUser } from "@/lib/rbac";
import {
  getLeadsPipeline,
  getConversionAnalytics,
  listRms,
} from "@/features/leads/queries";
import { Reveal } from "@/components/brand";
import { LeadsBoardView } from "./leads-board-view";

// Lead & Opportunity pipeline. DB-backed kanban + conversion analytics - never
// prerender. force-dynamic so no query runs at build.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Leads & Opportunities · Binary Capital CRM",
};

export default async function LeadsPage() {
  const user = await requireUser();

  // Three independent reads; run concurrently so the board paints in one RTT.
  const [groups, analytics, rms] = await Promise.all([
    getLeadsPipeline(user),
    getConversionAnalytics(user),
    listRms(),
  ]);

  return (
    <PageShell>
      <PageHeader title="Leads" description="Qualify prospects and convert wins into mandates." />

      {/* The board is primary content - its own motion is mount-based
          (initial→animate), so it is NOT wrapped in a whileInView Reveal
          (that would gate it behind an opacity-0 on first paint). */}
      <LeadsBoardView groups={groups} analytics={analytics} rms={rms} />
    </PageShell>
  );
}
