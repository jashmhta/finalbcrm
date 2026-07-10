import { PageHeader, PageShell } from "@/components/brand/page-shell";
import { requireUser } from "@/lib/rbac";
import { getDealPipeline, type DealPipelineFilters } from "@/features/deals/queries";
import { DealsBoardView } from "./deals-board-view";

// DB-backed pipeline - never prerender. The query hits live Postgres, so the
// build must not try to evaluate it at build time.
export const dynamic = "force-dynamic";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    status?: string;
    brand?: string;
    leadUserId?: string;
    creditAnalystUserId?: string;
    partyId?: string;
    turnover?: string;
    sector?: string;
    rating?: string;
    agency?: string;
    investorType?: string;
    portfolioSize?: string;
    riskAppetite?: string;
    highYield?: string;
  }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters: DealPipelineFilters = {
    q: sp.q?.trim() || undefined,
    type: sp.type || undefined,
    status: sp.status || undefined,
    brand: sp.brand || undefined,
    leadUserId: sp.leadUserId || undefined,
    creditAnalystUserId: sp.creditAnalystUserId || undefined,
    partyId: sp.partyId || undefined,
    turnover: sp.turnover || undefined,
    sector: sp.sector || undefined,
    rating: sp.rating || undefined,
    agency: sp.agency || undefined,
    investorType: sp.investorType || undefined,
    portfolioSize: sp.portfolioSize || undefined,
    riskAppetite: sp.riskAppetite || undefined,
    highYield:
      sp.highYield === "1" ? true : sp.highYield === "0" ? false : undefined,
  };
  // Server-side pagination: cap each stage at 20 deals (the kanban's "20 per
  // stage max"). 9 pipeline + 2 off-pipeline stages × 20 = a worst-case ~220
  // rows - a small, fast single round-trip + party join. `total` is the full
  // non-deleted deal count (1,500) so the board's "Showing X of Y" indicator
  // tells the user how much of the book is on screen vs. reachable via search.
  // The client view (deals-board-view) further renders only the first 8 cards
  // per column with a "Load more" reveal, so the initial paint is light even
  // when a stage fills its 20-deal cap. This caps the server HTML payload that
  // previously shipped all 1,500 deals (~141KB / 7,500+ interactive elements).
  const { groups, total } = await getDealPipeline({
    perStage: 20,
    filters,
    user,
  });

  return (
    <PageShell>
      {/* Header renders visible on mount - no whileInView gate on the
          above-the-fold title (headless captures must show it). */}
      <PageHeader title="Deals" description="Mandate pipeline across IB and DCM." />

      <DealsBoardView groups={groups} total={total} initialSearch={filters.q} />
    </PageShell>
  );
}
