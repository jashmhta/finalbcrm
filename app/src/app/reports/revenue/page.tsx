import { requireUser } from "@/lib/rbac";
import { getRevenueReport } from "@/features/reports/queries";
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
  HorizontalBarChart,
  type LabelValuePoint,
} from "../_components/report-charts";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";

// DB-backed aggregate - never prerender.
export const dynamic = "force-dynamic";

/** The by-deal table caps at 50 rows on screen (the seeded book has ~270
 *  closed deals); the CSV export ships the full set. */
const DEAL_TABLE_CAP = 50;

export default async function RevenueReportPage() {
  const user = await requireUser();
  const report = await getRevenueReport(user);
  const { byDeal, byMonth, byRm, totals } = report;

  const monthlyData: LabelValuePoint[] = byMonth.map((r) => ({
    label: r.monthLabel,
    value: r.revenue,
  }));
  const rmData: LabelValuePoint[] = byRm
    .slice(0, 10)
    .map((r) => ({ label: r.leadEmail ?? "Unassigned", value: r.revenue }));

  const shownDeals = byDeal.slice(0, DEAL_TABLE_CAP);

  return (
    <PageShell>
      <SectionHeading
        display
        eyebrow="Reports"
        title="Revenue report"
        description="Fee revenue recognized on closed mandates - by deal, close month, and relationship manager. Fees derive from deal.fee_structure (upfront + success bps × deal size), the IB retainer + success-fee model. Export to CSV for the revenue-committee pack."
        className="mb-8"
        action={<ExportCsvButton type="revenue" />}
      />

      <Reveal y={10} duration={0.55} noBlur>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Recognized revenue"
            value={totals.recognizedRevenue}
            preset="int"
            prefix="₹"
            suffix=" Cr"
            tone="gold"
          />
          <StatCard
            label="Pipeline fees"
            value={totals.pipelineFee}
            preset="int"
            prefix="₹"
            suffix=" Cr"
          />
          <StatCard
            label="Closed mandates"
            value={totals.closedDealCount}
            preset="int"
            tone="up"
          />
          <StatCard
            label="Avg fee rate"
            value={totals.avgFeeBps}
            preset="int"
            suffix=" bps"
          />
        </div>
      </Reveal>

      {/* Charts - monthly revenue trend + per-RM revenue. */}
      <div className="mt-5 grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-2">
        <Reveal y={14} delay={0.05}>
          <ChartCard
            title="Revenue by close month"
            description="Recognized fees (₹) grouped by actual close date - the desk's run-rate."
            ambient="gold"
          >
            <div className="px-3 pb-4 pt-3 md:px-4">
              <AreaTrendChart
                data={monthlyData}
                color="gold"
                valueLabel="Revenue"
                compactMode="cr"
              />
            </div>
          </ChartCard>
        </Reveal>
        <Reveal y={14} delay={0.1}>
          <ChartCard
            title="Revenue by relationship manager"
            description="Top 10 lead bankers by recognized fees - the revenue league."
          >
            <div className="px-3 pb-4 pt-3 md:px-4">
              <HorizontalBarChart
                data={rmData}
                valueLabel="Revenue"
                color="var(--gold)"
                compactMode="cr"
              />
            </div>
          </ChartCard>
        </Reveal>
      </div>

      {/* Per-month table. */}
      <Reveal y={14} delay={0.05} className="mt-5">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-1 px-5 pt-5 md:px-6 md:pt-6">
            <h3 className="text-[13px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Revenue by close month
            </h3>
            <p className="text-[13px] text-muted-foreground">
              Closed mandates grouped by actual close date - deal count, recognized fees, and gross deal size.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead align="right">Deals</TableHead>
                <TableHead align="right">Deal size</TableHead>
                <TableHead align="right">Revenue</TableHead>
                <TableHead align="right">Avg fee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byMonth.length === 0 ? (
                <TableRow className="hover:bg-transparent before:hidden">
                  <TableCell colSpan={5} className="p-0">
                    <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                      No closed mandates with a close date yet.
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                byMonth.map((r) => {
                  const avgFee =
                    r.dealCount > 0 ? r.revenue / r.dealCount : 0;
                  return (
                    <TableRow key={r.monthKey}>
                      <TableCell primary>{r.monthLabel}</TableCell>
                      <TableCell numeric>{r.dealCount}</TableCell>
                      <TableCell numeric>
                        <Num
                          value={r.targetSize}
                          format={(n) => formatCr(n)}
                        />
                      </TableCell>
                      <TableCell numeric>
                        <Num
                          value={r.revenue}
                          format={(n) => formatCr(n)}
                        />
                      </TableCell>
                      <TableCell numeric>
                        <Num
                          value={avgFee}
                          format={(n) => formatCr(n)}
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

      {/* Per-deal table - capped on screen, full set in the CSV. */}
      <Reveal y={14} delay={0.05} className="mt-5">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-1 px-5 pt-5 md:flex-row md:items-end md:justify-between md:px-6 md:pt-6">
            <div className="flex flex-col gap-1">
              <h3 className="text-[13px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Revenue by deal
              </h3>
              <p className="text-[13px] text-muted-foreground">
                Each closed mandate with its computed fee. Showing{" "}
                <span className="nums tabular-nums">{shownDeals.length}</span>{" "}
                of{" "}
                <span className="nums tabular-nums">{byDeal.length}</span> -
                export CSV for the full blotter.
              </p>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="hidden lg:table-cell">RM</TableHead>
                <TableHead className="hidden md:table-cell">Closed</TableHead>
                <TableHead align="right">Size</TableHead>
                <TableHead align="right">Bps</TableHead>
                <TableHead align="right">Fee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shownDeals.length === 0 ? (
                <TableRow className="hover:bg-transparent before:hidden">
                  <TableCell colSpan={7} className="p-0">
                    <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                      No closed mandates to report yet.
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                shownDeals.map((r) => (
                  <TableRow key={r.dealId}>
                    <TableCell primary>
                      <div className="flex flex-col gap-0.5">
                        <span>{r.dealName ?? r.dealCode ?? "-"}</span>
                        <span className="text-[11px] font-normal uppercase tracking-[0.1em] text-muted-foreground/70">
                          {r.dealCode}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {r.dealType.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {r.leadEmail ?? "-"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {r.actualCloseDate
                        ? new Date(`${r.actualCloseDate}T00:00:00`).toLocaleDateString(
                            "en-IN",
                            { year: "numeric", month: "short", day: "2-digit" },
                          )
                        : "-"}
                    </TableCell>
                    <TableCell numeric>
                      <Num
                        value={r.targetSize}
                        format={(n) => formatCr(n)}
                      />
                    </TableCell>
                    <TableCell numeric>
                      {r.upfrontBps + r.successBps}
                    </TableCell>
                    <TableCell numeric>
                      <Num
                        value={r.fee}
                        format={(n) => formatCr(n)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </Reveal>
    </PageShell>
  );
}
