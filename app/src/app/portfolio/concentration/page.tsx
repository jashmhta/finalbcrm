import { requireUser } from "@/lib/rbac";
import { Reveal, SectionHeading, StatCard } from "@/components/brand";
import {
  getSectorConcentration,
  getIssuerConcentration,
  getRatingConcentration,
  getConcentrationAlerts,
  RBI_SINGLE_BORROWER_CAP_PCT,
  RBI_GROUP_CAP_PCT,
} from "@/features/portfolio";
import { ConcentrationView } from "../_components/concentration-view";

// DB-backed aggregates - never prerender.
export const dynamic = "force-dynamic";

export default async function ConcentrationPage() {
  const user = await requireUser();

  const [sectors, issuers, ratings, alerts] = await Promise.all([
    getSectorConcentration(user),
    getIssuerConcentration(25, user),
    getRatingConcentration(user),
    getConcentrationAlerts(user),
  ]);

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <SectionHeading
        eyebrow="Concentration"
        title="Concentration analysis"
        description={`Single-name, sector, and rating concentration against the RBI prudential exposure framework - single-borrower ${RBI_SINGLE_BORROWER_CAP_PCT}% / group ${RBI_GROUP_CAP_PCT}%, plus sectoral caps. The Herfindahl-Hirschman Index and CR3 read the book's diversification at a glance.`}
        className="!flex-row"
        display
      />

      <Reveal y={10} duration={0.55} noBlur>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Top-1 obligor"
            value={alerts.top1IssuerSharePct}
            preset="percent1"
            tone={alerts.top1IssuerSharePct > RBI_SINGLE_BORROWER_CAP_PCT ? "down" : "default"}
          />
          <StatCard
            label="CR3 (top-3 share)"
            value={alerts.top3IssuerSharePct}
            preset="percent1"
          />
          <StatCard
            label="Herfindahl (HHI)"
            value={alerts.hhi}
            preset="int"
            tone={alerts.hhi > 2500 ? "down" : alerts.hhi > 1500 ? "gold" : "up"}
          />
          <StatCard
            label="Sectoral breaches"
            value={alerts.sectorBreachCount}
            preset="int"
            tone={alerts.sectorBreachCount > 0 ? "down" : "default"}
          />
        </div>
      </Reveal>

      <ConcentrationView
        sectors={sectors}
        issuers={issuers}
        ratings={ratings}
      />
    </div>
  );
}
