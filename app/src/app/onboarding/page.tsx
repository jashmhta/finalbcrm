import { PageHeader, PageShell } from "@/components/brand/page-shell";
import { requireUser } from "@/lib/rbac";
import {
  getOnboardingPipeline,
  getOnboardingAnalytics,
  listRms,
} from "@/features/onboarding";
import { OnboardingBoardView } from "./onboarding-board-view";

// The Client Onboarding pipeline board. DB-backed - never prerender.
// force-dynamic so no query runs at build time.
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();
  const [groups, analytics, rms] = await Promise.all([
    getOnboardingPipeline(user),
    getOnboardingAnalytics(user),
    listRms(),
  ]);

  return (
    <PageShell>
      {/* Header renders visible on mount - no whileInView gate on the
          above-the-fold title (headless captures must show it). */}
      <PageHeader title="Onboarding" description="Client and investor onboarding checklists." />
      <OnboardingBoardView groups={groups} analytics={analytics} rms={rms} />
    </PageShell>
  );
}
