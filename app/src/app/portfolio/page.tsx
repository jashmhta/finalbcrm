import { PageShell, PageHeader } from "@/components/brand/page-shell";
import { requireUser } from "@/lib/rbac";
import { compactCr } from "@/features/reports/export";
import {
  Reveal,
  SectionHeading,
  StatCard,
} from "@/components/brand";
import { ChartCard } from "@/components/brand/chart-theme";
import {
  getPortfolioOverview,
  getExposureBySector,
  getExposureByIssuer,
  getExposureByRatingBand,
  getExposureByTenor,
  getLimitUtilizationSummary,
  getConcentrationAlerts,
} from "@/features/portfolio";
import { OverviewView } from "./_components/overview-view";

// DB-backed aggregates - never prerender. force-dynamic is explicit so the
// build never tries to execute the queries at build time.
export const dynamic = "force-dynamic";

export default async function PortfolioOverviewPage() {
  const user = await requireUser();

  const [
    overview,
    bySector,
    byIssuer,
    byRating,
    byTenor,
    limits,
    alerts,
  ] = await Promise.all([
    getPortfolioOverview(user),
    getExposureBySector(user),
    getExposureByIssuer(10, user),
    getExposureByRatingBand(user),
    getExposureByTenor(user),
    getLimitUtilizationSummary(user),
    getConcentrationAlerts(user),
  ]);

  const breachCount = limits.overall.breachCount;

  return (
    <PageShell>
      <PageHeader
        title="Portfolio"
        description="Exposure, concentration, and limits."
      />
      

      {/* KPI row - gross / net / issuers / limit breaches. The hero gross uses
          a compact static (₹X.XX T) so a 6-figure crore count-up
          doesn't jitter; the supporting KPIs count up. */}
      <Reveal y={10} duration={0.55} noBlur>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Gross exposure"
            value={overview.totalGrossCr}
            display={compactCr(overview.totalGrossCr)}
            tone="gold"
          />
          <StatCard
            label="Net exposure"
            value={overview.totalNetCr}
            display={compactCr(overview.totalNetCr)}
          />
          <StatCard
            label="Obligors"
            value={overview.partyCount}
            preset="int"
            tone="up"
          />
          <StatCard
            label="Limit breaches"
            value={breachCount}
            preset="int"
            tone={breachCount > 0 ? "down" : "default"}
          />
        </div>
      </Reveal>

      <OverviewView
        overview={overview}
        bySector={bySector}
        byIssuer={byIssuer}
        byRating={byRating}
        byTenor={byTenor}
        limits={limits}
        alerts={alerts}
      />
    </PageShell>
  );
}
