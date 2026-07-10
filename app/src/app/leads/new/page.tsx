import Link from "next/link";
import { requireUser } from "@/lib/rbac";
import { listRms } from "@/features/leads/queries";
import { listParties } from "@/features/parties/queries";
import { Reveal } from "@/components/brand";
import { NewLeadForm } from "./new-lead-form";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";

// New lead capture. DB-backed RM + existing-relationship lists - never
// prerender. force-dynamic so no query runs at build.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "New lead · Binary Capital CRM",
};

export default async function NewLeadPage() {
  const user = await requireUser();

  // RMs (assignable) + existing relationships (for the link-an-existing-client
  // mode). Capped page size - the dropdown is a quick picker, not the ledger.
  const [rms, { rows: parties }] = await Promise.all([
    listRms(),
    listParties({ page: 1, pageSize: 300, user }),
  ]);

  return (
    <PageShell>
      <Reveal y={10} duration={0.55} noBlur>
        <PageHeader
        title="New lead"
        description="Capture a prospect entering the qualification funnel. Pick the service line, estimate the ticket, and assign a relationship manager - BANT qualification happens on the lead's workspace."
      />
      </Reveal>

      <Reveal y={14} delay={0.05}>
        <div className="max-w-2xl">
          <NewLeadForm
            rms={rms.map((r) => ({ userId: r.userId, name: r.name }))}
            parties={parties
              .filter((p) => p.status !== "onboarding" || p.partyNature === "organization")
              .map((p) => ({ partyId: p.partyId, legalName: p.legalName }))}
          />
        </div>
      </Reveal>
    </PageShell>
  );
}
