import { requireUser } from "@/lib/rbac";
import { getCreditReport } from "@/features/reports/queries";
import { ExportCsvButton } from "@/features/reports";
import {
  Reveal,
  SectionHeading,
  StatCard,
} from "@/components/brand";
import { ChartCard } from "@/components/brand/chart-theme";
import { ratingTierColor } from "@/features/reports/export";
import {
  CountBarChart,
  type LabelCountPoint,
} from "../_components/report-charts";
import { CreditReportView } from "../_components/credit-report-view";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";

// DB-backed report - never prerender. searchParams opt into dynamic rendering
// anyway, but force-dynamic is explicit so the build never tries to execute
// the query at build time.
export const dynamic = "force-dynamic";

export default async function CreditReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    band?: string;
    lifecycle?: string;
    watchlist?: string;
  }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const band = sp.band || undefined;
  const lifecycle =
    sp.lifecycle === "current" || sp.lifecycle === "superseded"
      ? sp.lifecycle
      : undefined;
  const watchlist = sp.watchlist === "1";

  const report = await getCreditReport({ q, band, lifecycle, watchlist }, user);
  const { rows, total, issuerCount, watchlistCount, bandDistribution } = report;

  const bandChartData: LabelCountPoint[] = bandDistribution.map((b) => ({
    label: b.band,
    count: b.count,
  }));
  // Per-bar color by rating tier (AAA/AA = emerald → D = down). Built from the
  // bands present so every bar on the chart is tinted by its credit quality.
  const bandCellColors: Record<string, string> = {};
  for (const b of bandDistribution) {
    bandCellColors[b.band] = ratingTierColor(b.band);
  }

  return (
    <PageShell>
      <SectionHeading
        display
        eyebrow="Reports"
        title="Credit report"
        description="Every credit analysis with issuer, internal rating, current scorecard score, band, lifecycle, and the latest gross obligor exposure. Filter by band, lifecycle, or watchlist - export to CSV for the credit-committee pack."
        className="mb-8"
        action={<ExportCsvButton type="credit-report" />}
      />

      <Reveal y={10} duration={0.55} noBlur>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Analyses" value={total} preset="int" />
          <StatCard
            label="Current issuers"
            value={issuerCount}
            preset="int"
            tone="up"
          />
          <StatCard
            label="Watchlist"
            value={watchlistCount}
            preset="int"
            tone="down"
          />
          <StatCard
            label="Bands represented"
            value={bandDistribution.length}
            preset="int"
            tone="gold"
          />
        </div>
      </Reveal>

      {/* Band distribution chart. */}
      {bandChartData.length > 0 ? (
        <Reveal y={14} delay={0.05} className="mt-5">
          <ChartCard
            title="Scorecard band distribution"
            description="Current analyses per internal band (BC-1 excellent → BC-6 distressed)."
          >
            <div className="px-3 pb-4 pt-3 md:px-4">
              <CountBarChart
                data={bandChartData}
                valueLabel="Analyses"
                cellColors={bandCellColors}
              />
            </div>
          </ChartCard>
        </Reveal>
      ) : null}

      {/* Filterable table. */}
      <Reveal y={14} delay={0.05} className="mt-5">
        <CreditReportView
          rows={rows}
          total={total}
          issuerCount={issuerCount}
          watchlistCount={watchlistCount}
          bandDistribution={bandDistribution}
          q={q}
          band={band}
          lifecycle={lifecycle}
          watchlist={watchlist}
        />
      </Reveal>
    </PageShell>
  );
}
