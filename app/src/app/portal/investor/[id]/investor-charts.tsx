"use client";

/**
 * InvestorCharts - the client-side chart surfaces for the investor detail
 * page. Extracted into a "use client" module because the recharts wrappers
 * (PortalDonutChart / PortalVBarChart / PortalHBarChart) take a `compactValue`
 * FORMATTER function, and functions cannot be passed from a Server Component
 * to a Client Component (the RSC boundary). This module owns the `cr` formatter
 * on the client side; the server page hands in only serializable breakdown
 * arrays.
 *
 * Two exports:
 *   <InvestorComposition bySector byRating byTenor /> - the 3-chart grid
 *     (donut by sector, vertical bar by rating, vertical bar by tenor).
 *   <InvestorTopIssuers byIssuer /> - the horizontal bar of top counterparties.
 *
 * Primary content renders VISIBLE on mount (the lazy recharts chunk streams in
 * after first paint; a skeleton reserves layout meanwhile - see portal-charts).
 */
import * as React from "react";
import { Buildings } from "@phosphor-icons/react";

// Import the lazy chart wrappers from the CLIENT-ONLY submodule (NOT the
// @/features/portal barrel) so the server `queries` module - which imports the
// `postgres` driver via `@/db` - is never pulled into the client bundle. The
// BreakdownPoint type is imported type-only from the queries submodule (erased
// at compile, evaluates no module scope).
import {
  PortalDonutChart,
  PortalHBarChart,
  PortalVBarChart,
} from "@/features/portal/portal-charts";
import type { BreakdownPoint } from "@/features/portal/queries";
import { ChartCard } from "@/components/brand/chart-theme";
import { EmptyState, compactINR } from "@/components/brand";

// Cr formatter - values are in crore; compactINR takes rupees, so multiply by 1e7.
const cr = (n: number) => compactINR(n * 1e7);

export function InvestorComposition({
  bySector,
  byRating,
  byTenor,
}: {
  bySector: BreakdownPoint[];
  byRating: BreakdownPoint[];
  byTenor: BreakdownPoint[];
}) {
  return (
    <div className="grid grid-cols-1 gap-5 md:gap-6 lg:grid-cols-3">
      <ChartCard
        title="By sector"
        description="Portfolio value by issuer sector family."
      >
        <div className="px-3 pb-4 pt-3">
          <PortalDonutChart
            data={bySector.map((p) => ({ label: p.label, value: p.value }))}
            height={280}
            compactValue={cr}
            centerLabel="Portfolio"
          />
        </div>
      </ChartCard>
      <ChartCard
        title="By rating"
        description="Portfolio value by long-term rating band."
      >
        <div className="px-3 pb-4 pt-3">
          <PortalVBarChart
            data={byRating.map((p) => ({
              label: p.label,
              value: p.value,
              hint: `${p.sharePct}%`,
            }))}
            height={280}
            valueLabel="Holding"
            color="var(--gold)"
            compactValue={cr}
          />
        </div>
      </ChartCard>
      <ChartCard
        title="By tenor"
        description="Portfolio value by residual maturity bucket."
      >
        <div className="px-3 pb-4 pt-3">
          <PortalVBarChart
            data={byTenor.map((p) => ({
              label: p.label,
              value: p.value,
              hint: `${p.sharePct}%`,
            }))}
            height={280}
            valueLabel="Holding"
            color="var(--emerald)"
            compactValue={cr}
          />
        </div>
      </ChartCard>
    </div>
  );
}

export function InvestorTopIssuers({
  byIssuer,
}: {
  byIssuer: BreakdownPoint[];
}) {
  if (byIssuer.length === 0) {
    return (
      <ChartCard
        title="Top issuers"
        description="Portfolio concentration by name - the investor's top counterparties."
      >
        <EmptyState
          icon={<Buildings weight="light" />}
          title="No issuer breakdown."
          hint="Issuer names are not linked to these holdings."
        />
      </ChartCard>
    );
  }
  return (
    <ChartCard
      title="Top issuers"
      description="Portfolio concentration by name - the investor's top counterparties."
    >
      <div className="px-3 pb-4 pt-3">
        <PortalHBarChart
          data={byIssuer.map((p) => ({
            label: p.label,
            value: p.value,
            hint: `${p.sharePct}%`,
          }))}
          height={Math.max(220, byIssuer.length * 34)}
          valueLabel="Holding"
          compactValue={cr}
        />
      </div>
    </ChartCard>
  );
}
