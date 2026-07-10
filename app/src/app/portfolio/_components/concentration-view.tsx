"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Badge, Reveal } from "@/components/brand";
import type { BadgeProps } from "@/components/brand";
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
import type {
  SectorConcentrationRow,
  IssuerConcentrationRow,
  RatingConcentrationRow,
} from "@/features/portfolio";
import {
  VBarChart,
  type LabelValuePoint,
} from "./portfolio-charts";

/**
 * Concentration analysis client view - three sections:
 *   1. Sector concentration - bar chart + the RBI sectoral-exposure-limits
 *      comparison table (share vs cap, breach flag).
 *   2. Issuer concentration - top-25 obligors with cumulative % + the
 *      issuer's single-name limit + utilization + concentration class.
 *   3. Rating concentration - per-band exposure + party count + share, color-
 *      coded by rating tier.
 *
 * Server-fetched serializable data only. The sector bar is a lazy recharts
 * dynamic import; the tables are the brand Table primitives inside a double-
 * bezel container. No function props cross the RSC boundary.
 */
export interface ConcentrationViewProps {
  sectors: SectorConcentrationRow[];
  issuers: IssuerConcentrationRow[];
  ratings: RatingConcentrationRow[];
}

export function ConcentrationView(props: ConcentrationViewProps) {
  const { sectors, issuers, ratings } = props;

  const sectorChartData: LabelValuePoint[] = sectors.map((s) => ({
    label: s.sector,
    value: Number(s.grossCr.toFixed(2)),
    hint: `${s.sharePct.toFixed(1)}% of book`,
  }));

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* 1. Sector concentration + RBI cap comparison. */}
      <Reveal y={12} duration={0.55} noBlur>
        <div className="grid grid-cols-1 gap-5 md:gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <ChartCard
              title="Sector concentration"
              description="Book share by sector family, ₹ Cr."
            >
              <div className="px-3 pb-4 pt-3 md:px-4">
                {sectorChartData.length > 0 ? (
                  <VBarChart
                    data={sectorChartData}
                    height={280}
                    valueLabel="Exposure"
                    color="var(--emerald)"
                    compactValue={(n) => compactCr(n)}
                  />
                ) : null}
              </div>
            </ChartCard>
          </div>

          <div className="lg:col-span-7">
            <ChartCard
              title="RBI sectoral exposure limits"
              description="Live sector share vs the RBI prudential sectoral cap. Breached sectors are flagged."
            >
              <SectorRbiTable rows={sectors} />
            </ChartCard>
          </div>
        </div>
      </Reveal>

      {/* 2. Issuer concentration - top 25. */}
      <Reveal y={12} delay={0.04}>
        <ChartCard
          title="Issuer concentration"
          description="The top obligors by exposure, with cumulative book share and the issuer's single-name limit + utilization. Classified against the house 5% / 10% thresholds and the RBI 25% single-borrower cap."
        >
          <IssuerTable rows={issuers} />
        </ChartCard>
      </Reveal>

      {/* 3. Rating concentration. */}
      <Reveal y={12} delay={0.04}>
        <ChartCard
          title="Rating concentration"
          description="Book share by long-term external rating band, with obligor count. Sub-investment-grade (BB+ and below) is the watchlist bucket."
        >
          <RatingTable rows={ratings} />
        </ChartCard>
      </Reveal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sector × RBI cap table.
// ---------------------------------------------------------------------------

function SectorRbiTable({ rows }: { rows: SectorConcentrationRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-foreground/[0.055] p-1.5 ring-1 ring-hairline">
      <div className="overflow-hidden rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface ring-1 ring-inset ring-foreground/[0.08]">
        <Table density="comfortable">
          <TableHeader>
            <TableRow>
              <TableHead>Sector</TableHead>
              <TableHead align="right">Exposure</TableHead>
              <TableHead align="right">Share</TableHead>
              <TableHead align="right" className="hidden sm:table-cell">
                Obligors
              </TableHead>
              <TableHead align="right">RBI cap</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent before:hidden">
                <TableCell colSpan={6} className="p-0">
                  <TableEmpty
                    title="No sector exposure."
                    hint="The current book has no sector-classified exposure rows."
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.sector}>
                  <TableCell primary>{r.sector}</TableCell>
                  <TableCell align="right" numeric>
                    {compactCr(r.grossCr)}
                  </TableCell>
                  <TableCell align="right" numeric>
                    {r.sharePct.toFixed(2)}%
                  </TableCell>
                  <TableCell align="right" numeric className="hidden sm:table-cell">
                    {r.partyCount.toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell align="right" numeric>
                    {r.rbiCapPct != null ? `${r.rbiCapPct}%` : "-"}
                  </TableCell>
                  <TableCell>
                    {r.breached ? (
                      <Badge variant="down">Breached</Badge>
                    ) : r.rbiCapPct != null ? (
                      <Badge variant="up">Within</Badge>
                    ) : (
                      <Badge variant="neutral">No cap</Badge>
                    )}
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

// ---------------------------------------------------------------------------
// Issuer concentration table.
// ---------------------------------------------------------------------------

function classBadge(c: IssuerConcentrationRow["classification"]): {
  variant: BadgeProps["variant"];
  label: string;
} {
  if (c === "high") return { variant: "down", label: "High" };
  if (c === "elevated") return { variant: "gold", label: "Elevated" };
  return { variant: "neutral", label: "Normal" };
}

function IssuerTable({ rows }: { rows: IssuerConcentrationRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-foreground/[0.055] p-1.5 ring-1 ring-hairline">
      <div className="overflow-hidden rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface ring-1 ring-inset ring-foreground/[0.08]">
        <Table density="comfortable">
          <TableHeader>
            <TableRow>
              <TableHead align="right" className="w-[2.5rem]">
                #
              </TableHead>
              <TableHead>Obligor</TableHead>
              <TableHead align="right">Exposure</TableHead>
              <TableHead align="right">Share</TableHead>
              <TableHead align="right" className="hidden md:table-cell">
                Cumulative
              </TableHead>
              <TableHead align="right" className="hidden lg:table-cell">
                Limit
              </TableHead>
              <TableHead align="right" className="hidden lg:table-cell">
                Util.
              </TableHead>
              <TableHead>Class</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent before:hidden">
                <TableCell colSpan={8} className="p-0">
                  <TableEmpty
                    title="No obligor exposure."
                    hint="The current exposure snapshot is empty."
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const cls = classBadge(r.classification);
                return (
                  <TableRow key={r.partyId}>
                    <TableCell align="right" numeric className="text-muted-foreground">
                      {r.rank}
                    </TableCell>
                    <TableCell primary>{r.name}</TableCell>
                    <TableCell align="right" numeric>
                      {compactCr(r.grossCr)}
                    </TableCell>
                    <TableCell align="right" numeric>
                      {r.sharePct.toFixed(2)}%
                    </TableCell>
                    <TableCell align="right" numeric className="hidden md:table-cell">
                      {r.cumulativePct.toFixed(2)}%
                    </TableCell>
                    <TableCell align="right" numeric className="hidden lg:table-cell">
                      {r.limitCr != null ? compactCr(r.limitCr) : "-"}
                    </TableCell>
                    <TableCell align="right" numeric className="hidden lg:table-cell">
                      {r.utilizationPct != null
                        ? `${r.utilizationPct.toFixed(1)}%`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cls.variant}>{cls.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rating concentration table.
// ---------------------------------------------------------------------------

function tierColor(tier: RatingConcentrationRow["tier"]): string {
  switch (tier) {
    case "emerald":
      return "var(--emerald)";
    case "gold":
      return "var(--gold)";
    case "info":
      return "var(--info)";
    case "down":
      return "var(--down)";
    default:
      return "var(--muted-foreground)";
  }
}

function RatingTable({ rows }: { rows: RatingConcentrationRow[] }) {
  const max = Math.max(...rows.map((r) => r.grossCr), 1);
  return (
    <div className="overflow-hidden rounded-2xl bg-foreground/[0.055] p-1.5 ring-1 ring-hairline">
      <div className="overflow-hidden rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface ring-1 ring-inset ring-foreground/[0.08]">
        <Table density="comfortable">
          <TableHeader>
            <TableRow>
              <TableHead>Rating band</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead align="right">Exposure</TableHead>
              <TableHead align="right">Share</TableHead>
              <TableHead align="right" className="hidden sm:table-cell">
                Obligors
              </TableHead>
              <TableHead>Distribution</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent before:hidden">
                <TableCell colSpan={6} className="p-0">
                  <TableEmpty
                    title="No rated exposure."
                    hint="No external ratings linked to the current book."
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.band}>
                  <TableCell primary>
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden
                        className="size-2 rounded-full"
                        style={{ background: tierColor(r.tier) }}
                      />
                      {r.band}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={tierBadgeVariant(r.tier)} className="capitalize">
                      {r.tier === "neutral" ? "n/a" : r.tier}
                    </Badge>
                  </TableCell>
                  <TableCell align="right" numeric>
                    {compactCr(r.grossCr)}
                  </TableCell>
                  <TableCell align="right" numeric>
                    {r.sharePct.toFixed(2)}%
                  </TableCell>
                  <TableCell align="right" numeric className="hidden sm:table-cell">
                    {r.partyCount.toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell>
                    <div className="relative h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-foreground/[0.06]">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          width: `${Math.max((r.grossCr / max) * 100, 1)}%`,
                          background: tierColor(r.tier),
                        }}
                      />
                    </div>
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

function tierBadgeVariant(tier: RatingConcentrationRow["tier"]): BadgeProps["variant"] {
  switch (tier) {
    case "emerald":
      return "up";
    case "gold":
      return "gold";
    case "info":
      return "info";
    case "down":
      return "down";
    default:
      return "neutral";
  }
}
