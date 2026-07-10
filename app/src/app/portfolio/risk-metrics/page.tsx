import { requireUser } from "@/lib/rbac";
import { Reveal, SectionHeading } from "@/components/brand";
import { getRiskMetrics } from "@/features/portfolio";
import { RiskMetricsView } from "../_components/risk-metrics-view";

// DB-backed risk aggregation - never prerender.
export const dynamic = "force-dynamic";

export default async function RiskMetricsPage() {
  const user = await requireUser();
  const metrics = await getRiskMetrics(user);

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <SectionHeading
        eyebrow="Risk metrics"
        title="Duration, DV01 &amp; VaR"
        description="A simplified portfolio risk view - value-weighted modified duration + convexity, the rupee DV01 per 1bp parallel shift, and a 1-day 99% parametric Value-at-Risk from a duration × yield-shock model. The full key-rate-duration / OAS / historical-sim VaR lives in the risk system alongside."
        className="!flex-row"
        display
      />

      <Reveal y={10} duration={0.55} noBlur>
        <RiskMetricsView metrics={metrics} />
      </Reveal>
    </div>
  );
}
