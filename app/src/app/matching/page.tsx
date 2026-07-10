import { PageHeader, PageShell } from "@/components/brand/page-shell";
import { requireUser } from "@/lib/rbac";
import {
  getInvestorMatches,
  getMatchableIssuers,
  type MatchResult,
  type IssuerSummary,
} from "@/features/matching/queries";
import { MatchingWorkspace } from "./matching-workspace";

// The Investor Matching Engine workspace. DB-backed issuer list + ranked
// investor matches - never prerender. force-dynamic so no query runs at build.
export const dynamic = "force-dynamic";

export default async function MatchingPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; q?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;

  const issuers = await getMatchableIssuers(user);

  // Selection syncs via ?id=. Default to the first issuer so the right pane is
  // populated on first paint. The client also exposes a searchable issuer
  // selector; the URL is the source of truth.
  const requestedId = sp.id?.trim() || undefined;
  const selectedId =
    (requestedId && issuers.some((i) => i.partyId === requestedId)
      ? requestedId
      : requestedId ?? issuers[0]?.partyId) ?? null;

  // Cap the matches streamed to the workspace - the client renders the top 24
  // + a "View all in matrix" link, so sending the full 4100-investor ranking
  // (≈10 MB) only bloats the transfer and the client-side filter pass. The
  // matrix page (/matching/[id]) still requests the unranked-capped full list
  // via getMatchMatrix. 200 keeps every filter toggle useful (the top slice is
  // where the strong/warm fits live) while cutting the payload ~25×.
  const result: MatchResult | null = selectedId
    ? await getInvestorMatches(selectedId, 200, user)
    : null;

  return (
    <PageShell>
      <PageHeader title="Matching" description="Issuer-to-investor placement shortlists." />
      <MatchingWorkspace
        issuers={issuers}
        selectedId={selectedId}
        result={result}
        initialQuery={q}
      />
    </PageShell>
  );
}
