import { requireUser, can } from "@/lib/rbac";
import {
  getPortfolioOverview,
  getConcentrationAlerts,
} from "@/features/portfolio/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard, CKpi } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";
import { formatCrorePlain } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Portfolio" };

export default async function ConsolePortfolioPage() {
  const user = await requireUser();
  if (!can(user, "read", "portfolio") && !can(user, "read", "deal")) {
    return (
      <CEmpty
        title="No portfolio access"
        body="You need portfolio or deal read access."
        actionLabel="Home"
        actionHref="/console"
      />
    );
  }

  const [overview, alertSummary] = await Promise.all([
    getPortfolioOverview(user),
    getConcentrationAlerts(user),
  ]);

  return (
    <div>
      <CPageHeader
        eyebrow="Risk"
        title="Portfolio"
        description="Exposure, concentration, and limit signals for the book."
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <CKpi
          label="Gross exposure"
          value={formatCrorePlain(overview.totalGrossCr)}
        />
        <CKpi
          label="Net exposure"
          value={formatCrorePlain(overview.totalNetCr)}
        />
        <CKpi label="Positions" value={String(overview.positionCount)} />
        <CKpi
          label="Limit breaches"
          value={String(alertSummary.limitBreachCount)}
        />
      </div>
      <CCard>
        <h2 className="mb-3 text-[13px] font-semibold">Concentration alerts</h2>
        {alertSummary.alerts.length === 0 ? (
          <p className="text-[13px] text-[var(--c-ink-3)]">
            No concentration breaches.
          </p>
        ) : (
          <ul className="space-y-2">
            {alertSummary.alerts.slice(0, 20).map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-2 border-b border-[var(--c-line)] pb-2 text-[13px]"
              >
                <CBadge
                  tone={
                    a.severity === "high"
                      ? "bad"
                      : a.severity === "elevated"
                        ? "warn"
                        : "info"
                  }
                >
                  {a.severity}
                </CBadge>
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-[12px] text-[var(--c-ink-3)]">
                    {a.detail} · {a.value}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CCard>
    </div>
  );
}
