import { PageShell, PageHeader } from "@/components/brand/page-shell";
import { requireUser } from "@/lib/rbac";
import { getNextActions } from "@/features/ai/nextAction";
import { getRecentInteractionSummaries } from "@/features/ai/interactionSummary";
import { getClientInsights } from "@/features/ai/clientInsights";
import { Reveal, SectionHeading } from "@/components/brand";
import { AiHubView } from "./ai-hub-view";

// AI insights hub - DB-backed, never prerender. force-dynamic is explicit so
// the build never tries to run the aggregate queries at build time.
export const dynamic = "force-dynamic";

export default async function AiHubPage() {
  const user = await requireUser();

  // The three AI panels - all server-generated, serializable across the RSC
  // boundary into the client view. No function props cross server→client.
  const [nextActions, recentSummaries, clientInsights] = await Promise.all([
    getNextActions(user.appUserId, { limit: 5 }),
    getRecentInteractionSummaries(6, user),
    getClientInsights({ limit: 8, user }),
  ]);

  return (
    <PageShell>
      {/* Heading renders VISIBLE on mount - no whileInView opacity-0 gate on
          above-the-fold primary content (per the screenshot-visibility rule). */}
      <PageHeader title="AI Insights" description="Deterministic credit and relationship summaries." />

      <AiHubView
          actions={nextActions.actions}
          recentSummaries={recentSummaries}
          clientInsights={clientInsights}
          userName={user.name ?? user.email ?? undefined}
        />
    </PageShell>
  );
}
