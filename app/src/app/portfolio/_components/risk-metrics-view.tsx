"use client";

import * as React from "react";

import { Reveal, StatCard } from "@/components/brand";
import { ChartCard } from "@/components/brand/chart-theme";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/brand";
import { compactCr } from "@/features/reports/export";
import { compactINR } from "@/components/brand/money";
import type { RiskMetrics } from "@/features/portfolio";
import { VAR_ASSUMPTIONS } from "@/features/portfolio/risk";
import { VBarChart, type LabelValuePoint } from "./portfolio-charts";

/**
 * Risk metrics client view - the KPI row (modified duration, convexity, DV01,
 * VaR), a DV01-by-tenor bar, the top DV01 contributors table, and the model
 * assumptions card. The KPI StatCards live here (client) so they can pass
 * custom `format` functions for the duration / DV01 / VaR units - server
 * components cannot pass functions across the RSC boundary, so the page keeps
 * the KPIs out of the server tree.
 *
 * The DV01 bar is a lazy recharts dynamic import; the contributors table uses
 * the brand Table primitives inside a double-bezel container. Mount-based
 * motion; primary content renders VISIBLE on first paint.
 */
export interface RiskMetricsViewProps {
  metrics: RiskMetrics;
}

export function RiskMetricsView({ metrics }: RiskMetricsViewProps) {
  const { portfolio, byTenor, topDv01 } = metrics;

  const dv01ByTenor: LabelValuePoint[] = byTenor
    .filter((b) => b.dv01Lakh > 0)
    .map((b) => ({
      label: b.label,
      value: Number(b.dv01Lakh.toFixed(2)),
      hint: `${b.positionCount} position${b.positionCount === 1 ? "" : "s"}`,
    }));

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* KPI row - duration / convexity / DV01 / VaR. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Modified duration"
          value={portfolio.portfolioModDur}
          format={(n) => `${n.toFixed(2)} yrs`}
          tone="gold"
        />
        <StatCard
          label="Convexity"
          value={portfolio.portfolioConvexity}
          format={(n) => n.toFixed(2)}
        />
        <StatCard
          label="DV01 (per 1bp)"
          value={portfolio.dv01Lakh}
          format={(n) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 1 })} L`}
          tone="up"
        />
        <StatCard
          label={`${VAR_ASSUMPTIONS.horizon} ${VAR_ASSUMPTIONS.confidence} VaR`}
          value={portfolio.var1d99Cr}
          format={(n) => compactCr(n)}
          tone="down"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 md:gap-6 lg:grid-cols-12">
        {/* DV01 by tenor. */}
        <Reveal y={12} delay={0.04} className="lg:col-span-7">
          <ChartCard
            title="DV01 by tenor bucket"
            description="The rupee price impact of a +1bp parallel yield shift, per residual-tenor bucket (₹ lakh). Longer buckets carry the bulk of the rate sensitivity."
          >
            <div className="px-3 pb-4 pt-3 md:px-4">
              {dv01ByTenor.length > 0 ? (
                <VBarChart
                  data={dv01ByTenor}
                  height={300}
                  valueLabel="DV01"
                  color="var(--gold)"
                  compactValue={(n) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 1 })} L`}
                />
              ) : (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <span className="text-[15px] font-light text-foreground/80">
                    No residual tenor on the book.
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    Every position is past its maturity date.
                  </span>
                </div>
              )}
            </div>
          </ChartCard>
        </Reveal>

        {/* Model assumptions. */}
        <Reveal y={12} delay={0.08} className="lg:col-span-5">
          <AssumptionsCard portfolio={portfolio} />
        </Reveal>
      </div>

      {/* Top DV01 contributors. */}
      <Reveal y={12} delay={0.04}>
        <ChartCard
          title="Top DV01 contributors"
          description="The ten positions with the largest rupee price sensitivity to a 1bp yield move - the names a hedge / risk-reduce first touches."
        >
          <TopDv01Table rows={topDv01} />
        </ChartCard>
      </Reveal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Model assumptions card.
// ---------------------------------------------------------------------------

function AssumptionsCard({
  portfolio,
}: {
  portfolio: RiskMetrics["portfolio"];
}) {
  const assumptions: { label: string; value: string }[] = [
    { label: "Yield model", value: "Par bond (yield ≈ coupon)" },
    { label: "Default coupon", value: "8.00% (INR corp benchmark)" },
    {
      label: "1-day yield shock",
      value: `${(VAR_ASSUMPTIONS.dailyYieldShock * 1e4).toFixed(1)} bp`,
    },
    { label: "Confidence", value: `${VAR_ASSUMPTIONS.confidence} (z=${VAR_ASSUMPTIONS.z99})` },
    { label: "Horizon", value: VAR_ASSUMPTIONS.horizon },
    { label: "Book aggregated", value: `${portfolio.positionCount.toLocaleString("en-IN")} positions` },
  ];

  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl bg-foreground/[0.02] p-1.5 ring-1 ring-hairline/70">
      <div className="bezel-hi flex h-full flex-col gap-4 rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface p-5">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Model assumptions
          </span>
          <span className="text-[13px] text-muted-foreground">
            The simplified risk model&apos;s inputs.
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          {assumptions.map((a) => (
            <div
              key={a.label}
              className="flex items-center justify-between gap-3 border-b border-hairline/50 pb-2.5 text-[12.5px] last:border-0 last:pb-0"
            >
              <span className="text-muted-foreground">{a.label}</span>
              <span className="nums font-medium tabular-nums text-foreground/80">
                {a.value}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-auto rounded-xl bg-gold/[0.06] p-3 ring-1 ring-gold/22">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-gold-deep">
              Portfolio Macaulay duration
            </span>
            <span className="nums text-[20px] font-medium tabular-nums text-foreground">
              {portfolio.portfolioMacDur.toFixed(2)}{" "}
              <span className="text-[12px] text-muted-foreground">yrs</span>
            </span>
            <span className="text-[11.5px] leading-snug text-muted-foreground">
              DV01 ≈ {compactINR(portfolio.dv01Rupees)} per 1bp · VaR ≈ {compactCr(portfolio.var1d99Cr)} ({VAR_ASSUMPTIONS.horizon}, {VAR_ASSUMPTIONS.confidence})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top DV01 contributors table.
// ---------------------------------------------------------------------------

function TopDv01Table({
  rows,
}: {
  rows: RiskMetrics["topDv01"];
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-foreground/[0.055] p-1.5 ring-1 ring-hairline">
      <div className="overflow-hidden rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface ring-1 ring-inset ring-foreground/[0.08]">
        <Table density="comfortable">
          <TableHeader>
            <TableRow>
              <TableHead>Obligor</TableHead>
              <TableHead align="right">Exposure</TableHead>
              <TableHead align="right" className="hidden sm:table-cell">
                Tenor
              </TableHead>
              <TableHead align="right" className="hidden md:table-cell">
                Coupon
              </TableHead>
              <TableHead align="right">Mod. dur</TableHead>
              <TableHead align="right" className="hidden lg:table-cell">
                Convexity
              </TableHead>
              <TableHead align="right">DV01</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent before:hidden">
                <TableCell colSpan={7} className="p-0">
                  <TableEmpty
                    title="No rate-sensitive positions."
                    hint="The current book has no positions with a positive residual tenor."
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.partyId}>
                  <TableCell primary>{r.name}</TableCell>
                  <TableCell align="right" numeric>
                    {compactCr(r.grossCr)}
                  </TableCell>
                  <TableCell align="right" numeric className="hidden sm:table-cell">
                    {r.tenorYears > 0 ? `${r.tenorYears.toFixed(1)}y` : "-"}
                  </TableCell>
                  <TableCell align="right" numeric className="hidden md:table-cell">
                    {r.couponPct != null ? `${r.couponPct.toFixed(2)}%` : "-"}
                  </TableCell>
                  <TableCell align="right" numeric>
                    {r.modDur.toFixed(2)}
                  </TableCell>
                  <TableCell align="right" numeric className="hidden lg:table-cell">
                    {r.convexity.toFixed(2)}
                  </TableCell>
                  <TableCell align="right" numeric>
                    ₹{r.dv01Lakh.toLocaleString("en-IN", { maximumFractionDigits: 1 })} L
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
