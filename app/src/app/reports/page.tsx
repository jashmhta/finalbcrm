import { PageShell, PageHeader } from "@/components/brand/page-shell";
import { requireUser } from "@/lib/rbac";
import { getReportsHubKpis } from "@/features/reports/queries";
import { Reveal, SectionHeading } from "@/components/brand";
import { ReportsHubView } from "./_components/reports-hub-view";

// DB-backed hub KPIs - never prerender. force-dynamic is explicit so the
// build never tries to execute the aggregate queries at build time.
export const dynamic = "force-dynamic";

export default async function ReportsHubPage() {
  const user = await requireUser();
  const kpis = await getReportsHubKpis(user);

  return (
    <PageShell>
      {/* Heading renders VISIBLE on mount - no whileInView opacity-0 gate on
          above-the-fold primary content (per the screenshot-visibility rule). */}
      <PageHeader title="Reports" description="Pipeline, credit, compliance, and revenue." />

      <ReportsHubView kpis={kpis} />
    </PageShell>
  );
}
