import Link from "next/link";
import { requireUser } from "@/lib/rbac";
import { listParties } from "@/features/parties/queries";
import { Reveal } from "@/components/brand";
import { NewCreditAnalysisForm } from "./new-credit-analysis-form";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";

export const dynamic = "force-dynamic";

export default async function NewCreditAnalysisPage() {
  const user = await requireUser();
  const { rows } = await listParties({ page: 1, pageSize: 200, user });

  return (
    <PageShell>
      <Reveal y={10} duration={0.55} noBlur>
        <PageHeader
        title="New credit analysis"
        description="Pick an issuer and obligor type to open a draft credit file. Add financial statements and run the scorecard from the analysis workspace."
      />
      </Reveal>

      <Reveal y={14} delay={0.05}>
        <div className="max-w-xl">
          <NewCreditAnalysisForm
            parties={rows.map((r) => ({
              partyId: r.partyId,
              legalName: r.legalName,
            }))}
          />
        </div>
      </Reveal>
    </PageShell>
  );
}
