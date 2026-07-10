import { PageHeader, PageShell } from "@/components/brand/page-shell";
// Integrations registry - the India regulatory & financial-data adapter
// catalog, reimagined as a CONNECTION control panel.
//
// Server component, force-dynamic (the registry is in-process but we keep
// dynamic rendering explicit so the build never tries to prerender the status
// page), gated on the authenticated user.
//
// VIEW-ONLY conceptual redesign: data wiring (listIntegrations from
// @/features/integrations/registry) is untouched. integrationStatusCounts
// remains exported + preserved in the registry; this view no longer calls it
// because the live Connected / Available / In-mock / Total counts are derived
// in the explorer from the lifted run state over the adapter list (a strict
// superset of the static counts). The page renders the editorial heading + a
// registry status band, then hands the serializable summaries to the
// <IntegrationsExplorer/> client control panel (live instrument cluster +
// filter toolbar + grouped connection cards). No query was extended for this
// screen - every new signal (data-flow, access-readiness, live connection
// state) is derived in the view.
//
// CRITICAL: the heading + status band render VISIBLE on mount - no whileInView
// opacity-0 gate on above-the-fold primary content (per the screenshot-
// visibility rule). The explorer's stat band + cards are likewise visible on
// mount (mount tweens, not whileInView).
import { requireUser } from "@/lib/rbac";
import { listIntegrationsCached } from "@/features/integrations/queries";
import { Card } from "@/components/brand/card";
import { Badge } from "@/components/brand/badge";

import { IntegrationsExplorer } from "./integrations-explorer";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  await requireUser();
  // Adapter list is env-derived + stable per deploy → cached 300s via
  // listIntegrationsCached. The page stays force-dynamic (requireUser reads the
  // session), but the adapter summary renders from the data cache on a hit.
  const integrations = await listIntegrationsCached();

  return (
    <PageShell>
      {/* Heading renders VISIBLE on mount - no whileInView opacity-0 gate on
          above-the-fold primary content. */}
      <PageHeader title="Integrations" description="India market and compliance adapters." />

      {/* Registry status band - a double-bezel Card framing the control panel.
          Visible on mount. */}
      <Card className="mb-8">
        <div className="flex flex-col gap-3 p-5 md:flex-row md:items-end md:justify-between md:p-6">
          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-emerald shadow-[0_0_8px] shadow-emerald/60"
              />
              Registry status
            </span>
            <p className="max-w-prose text-[13.5px] leading-[1.55] text-muted-foreground">
              Phase-1 open-architecture feeds (AA, KRA, CKYC, GSTIN/PAN,
              email/calendar, WhatsApp) are sequenced first; member-only feeds
              (BSE/NSE, CCIL, demat) are Phase-3 and scope-uncertain pending
              Binary&apos;s memberships. Run any adapter to inspect its sample
              payload; run all to light up the board.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="gold">Mock mode</Badge>
            <Badge variant="outline">No real credentials</Badge>
            <Badge variant="outline">India data residency</Badge>
            <Badge variant="outline">Vendor = DPDP processor</Badge>
          </div>
        </div>
      </Card>

      {/* The control panel - live instrument cluster + filter toolbar + grouped
          connection cards. Owns the lifted run lifecycle so the header counts
          and every card share one source of truth. */}
      <IntegrationsExplorer adapters={integrations} />
    </PageShell>
  );
}
