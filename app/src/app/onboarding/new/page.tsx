import { requireUser } from "@/lib/rbac";
import { listRms } from "@/features/onboarding";
import { OnboardingWizard } from "./onboarding-wizard";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";

// The onboarding capture wizard. DB-backed (RM list) - never prerender.
export const dynamic = "force-dynamic";

export default async function NewOnboardingPage() {
  await requireUser();
  const rms = await listRms();

  return (
    <PageShell>
      <PageHeader
        title="Onboard a new client"
        description="Walk a prospect through company details, the authorized signatory, the document checklist and a review - the case opens at the Profile stage with the documents you have in hand filed for verification."
      />
      <OnboardingWizard rms={rms} />
    </PageShell>
  );
}
