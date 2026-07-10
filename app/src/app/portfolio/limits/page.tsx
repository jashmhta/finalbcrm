import { requireUser, can } from "@/lib/rbac";
import { compactCr } from "@/features/reports/export";
import { Reveal, SectionHeading, StatCard } from "@/components/brand";
import { getLimits } from "@/features/portfolio";
import { LimitsView } from "../_components/limits-view";

// DB-backed limit set - never prerender. searchParams opt into dynamic
// rendering anyway, but force-dynamic is explicit so the build never tries to
// execute the query at build time.
export const dynamic = "force-dynamic";

export default async function LimitsPage({
  searchParams,
}: {
  searchParams: Promise<{
    limitType?: string;
    status?: string;
    q?: string;
  }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const limitType =
    sp.limitType && sp.limitType !== "all" ? sp.limitType : undefined;
  const status =
    sp.status === "breach" || sp.status === "stale" || sp.status === "ok"
      ? sp.status
      : undefined;
  const q = sp.q?.trim() || undefined;

  const { rows, summary } = await getLimits({ limitType, status, q }, user);
  const canEdit = can(user, "approve", "credit_limit");

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <SectionHeading
        eyebrow="Limits"
        title="Counterparty limit management"
        description="Approved credit limits by type - issuer underwriting, single-name, group, sector - with current utilization, available headroom, and breach flags. Limits with the credit_limit:approve grant (or the admin role) are editable inline; every edit writes an audit_log row."
        className="!flex-row"
        display
      />

      <Reveal y={10} duration={0.55} noBlur>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Approved limits"
            value={summary.overall.totalLimitCr}
            display={compactCr(summary.overall.totalLimitCr)}
            tone="gold"
          />
          <StatCard
            label="Utilized"
            value={summary.overall.totalUtilizedCr}
            display={compactCr(summary.overall.totalUtilizedCr)}
          />
          <StatCard
            label="Available headroom"
            value={summary.overall.totalAvailableCr}
            display={compactCr(summary.overall.totalAvailableCr)}
            tone="up"
          />
          <StatCard
            label="Breached lines"
            value={summary.overall.breachCount}
            preset="int"
            tone={summary.overall.breachCount > 0 ? "down" : "default"}
          />
        </div>
      </Reveal>

      <LimitsView
        rows={rows}
        summary={summary}
        canEdit={canEdit}
        limitType={limitType}
        status={status}
        q={q}
      />
    </div>
  );
}
