import { requireUser } from "@/lib/rbac";
import { getPipelineReport } from "@/features/reports/queries";
import { ExportCsvButton } from "@/features/reports";
import {
  Card,
  Reveal,
  SectionHeading,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/brand";
import { ChartCard } from "@/components/brand/chart-theme";
import { Num } from "@/components/brand/money";
import { formatCr } from "@/features/reports/export";
import {
  AreaTrendChart,
  CountBarChart,
  HorizontalBarChart,
  type LabelCountPoint,
  type LabelValuePoint,
} from "../_components/report-charts";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";

// DB-backed aggregate - never prerender.
export const dynamic = "force-dynamic";

export default async function PipelineReportPage() {
  const user = await requireUser();
  const report = await getPipelineReport(user);
  const { byStage, byType, byRm, totals } = report;

  // Chart point shapes - serializable arrays handed to the lazy client charts.
  const stageCountData: LabelCountPoint[] = byStage.map((r) => ({
    label: r.statusLabel,
    count: r.dealCount,
  }));
  const stageExposureData: LabelValuePoint[] = byStage.map((r) => ({
    label: r.statusLabel,
    value: r.targetExposure,
  }));
  // Top 10 deal types by mandate count - the long tail of 18 types would
  // overcrowd a horizontal bar chart; the top-10 captures the shape of the
  // book and the table below carries the full breakdown.
  const typeCountData: LabelValuePoint[] = byType.slice(0, 10).map((r) => ({
    label: r.dealTypeLabel,
    value: r.dealCount,
  }));

  return (
    <PageShell>
      <SectionHeading
        display
        eyebrow="Reports"
        title="Pipeline report"
        description="The mandate book by stage, deal type, and relationship manager - target exposure, weighted funnel, and per-RM hit-rate. Export to CSV for the Monday-morning coverage meeting."
        className="mb-8"
        action={<ExportCsvButton type="pipeline" />}
      />

      {/* KPI strip - total / open / closed / target exposure. StatCard uses
          serializable presets (no function props cross the RSC boundary). */}
      <Reveal y={10} duration={0.55} noBlur>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total mandates"
            value={totals.dealCount}
            preset="int"
          />
          <StatCard
            label="Open"
            value={totals.openCount}
            preset="int"
            tone="up"
          />
          <StatCard
            label="Closed / settled"
            value={totals.closedCount}
            preset="int"
            tone="gold"
          />
          <StatCard
            label="Target exposure"
            value={totals.targetExposure}
            preset="int"
            prefix="₹"
            suffix=" Cr"
            tone="gold"
          />
        </div>
      </Reveal>

      {/* Charts - stage count (bar) + stage exposure (area). */}
      <div className="mt-5 grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-2">
        <Reveal y={14} delay={0.05}>
          <ChartCard
            title="Mandates by stage"
            description="Deal count across the 9-stage live funnel + 2 off-pipeline statuses."
          >
            <div className="px-3 pb-4 pt-3 md:px-4">
              <CountBarChart data={stageCountData} valueLabel="Deals" />
            </div>
          </ChartCard>
        </Reveal>
        <Reveal y={14} delay={0.1}>
          <ChartCard
            title="Target exposure by stage"
            description="Sum of deal.target_size (₹) per stage - the weighted funnel."
            ambient="gold"
          >
            <div className="px-3 pb-4 pt-3 md:px-4">
              <AreaTrendChart
                data={stageExposureData}
                color="emerald"
                valueLabel="Exposure"
                compactMode="cr"
              />
            </div>
          </ChartCard>
        </Reveal>
      </div>

      {/* Deal-type breakdown + RM league table. */}
      <div className="mt-5 grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-2">
        <Reveal y={14} delay={0.05}>
          <ChartCard
            title="Mandates by deal type"
            description="Top 10 product types by mandate count - the shape of the book."
          >
            <div className="px-3 pb-4 pt-3 md:px-4">
              <HorizontalBarChart
                data={typeCountData}
                valueLabel="Deals"
                color="var(--gold)"
              />
            </div>
          </ChartCard>
        </Reveal>

        <Reveal y={14} delay={0.1}>
          <Card className="h-full">
            <div className="flex flex-col gap-1 px-5 pt-5 md:px-6 md:pt-6">
              <h3 className="text-[13px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                By relationship manager
              </h3>
              <p className="text-[13px] text-muted-foreground">
                Lead-banker league - mandate footprint, exposure, and hit-rate.
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RM</TableHead>
                  <TableHead align="right">Deals</TableHead>
                  <TableHead align="right">Exposure</TableHead>
                  <TableHead align="right">Closed</TableHead>
                  <TableHead align="right">Hit rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byRm.length === 0 ? (
                  <TableRow className="hover:bg-transparent before:hidden">
                    <TableCell colSpan={5} className="p-0">
                      <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                        No mandated deals on the book yet.
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  byRm.map((r) => {
                    const hitRate =
                      r.dealCount > 0
                        ? (r.closedCount / r.dealCount) * 100
                        : 0;
                    return (
                      <TableRow key={r.leadUserId ?? "unassigned"}>
                        <TableCell primary>
                          {r.leadEmail ?? "Unassigned"}
                        </TableCell>
                        <TableCell numeric>{r.dealCount}</TableCell>
                        <TableCell numeric>
                          <Num
                            value={r.targetExposure}
                            format={(n) => formatCr(n, { decimals: 1 })}
                          />
                        </TableCell>
                        <TableCell numeric>{r.closedCount}</TableCell>
                        <TableCell numeric>
                          <Num
                            value={hitRate}
                            format={(n) => `${n.toFixed(1)}%`}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </Reveal>
      </div>

      {/* Full stage table - the deal-count + exposure + avg-size breakdown. */}
      <Reveal y={14} delay={0.05} className="mt-5">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-1 px-5 pt-5 md:flex-row md:items-end md:justify-between md:px-6 md:pt-6">
            <div className="flex flex-col gap-1">
              <h3 className="text-[13px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Pipeline by stage
              </h3>
              <p className="text-[13px] text-muted-foreground">
                The full stage breakdown - deal count, target exposure, average size.
              </p>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stage</TableHead>
                <TableHead align="right">Deals</TableHead>
                <TableHead align="right">Target exposure</TableHead>
                <TableHead align="right">Avg size</TableHead>
                <TableHead align="right">% of book</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byStage.map((r) => {
                const pct =
                  totals.targetExposure > 0
                    ? (r.targetExposure / totals.targetExposure) * 100
                    : 0;
                return (
                  <TableRow key={r.status}>
                    <TableCell primary>{r.statusLabel}</TableCell>
                    <TableCell numeric>{r.dealCount}</TableCell>
                    <TableCell numeric>
                      <Num
                        value={r.targetExposure}
                        format={(n) => formatCr(n)}
                      />
                    </TableCell>
                    <TableCell numeric>
                      <Num
                        value={r.avgSize}
                        format={(n) => formatCr(n)}
                      />
                    </TableCell>
                    <TableCell numeric>
                      <Num value={pct} format={(n) => `${n.toFixed(1)}%`} />
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell primary>Total</TableCell>
                <TableCell numeric>{totals.dealCount}</TableCell>
                <TableCell numeric>
                  <Num
                    value={totals.targetExposure}
                    format={(n) => formatCr(n)}
                  />
                </TableCell>
                <TableCell numeric>
                  {totals.dealCount > 0 ? (
                    <Num
                      value={totals.targetExposure / totals.dealCount}
                      format={(n) => formatCr(n)}
                    />
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell numeric>100.0%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </Reveal>
    </PageShell>
  );
}
