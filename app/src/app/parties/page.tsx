import { PageHeader, PageShell } from "@/components/brand/page-shell";
import { requireUser } from "@/lib/rbac";
import { getPartyPreview, listParties, type PartyListFilters } from "@/features/parties/queries";
import { Reveal } from "@/components/brand";
import { PartiesExplorer } from "./parties-list-view";

// DB-backed list + preview - never prerender. searchParams opt into dynamic
// rendering anyway, but force-dynamic is explicit so the build never tries to
// execute the queries at build time.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    id?: string;
    type?: string;
    risk?: string;
    turnover?: string;
    sector?: string;
    rating?: string;
    agency?: string;
    ratingYear?: string;
    investorType?: string;
    portfolioSize?: string;
    riskAppetite?: string;
    highYield?: string;
    assignedUserId?: string;
  }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const requestedId = sp.id?.trim() || undefined;
  const filters: PartyListFilters = {
    type: sp.type?.trim() || undefined,
    risk: sp.risk?.trim() || undefined,
    turnover: sp.turnover?.trim() || undefined,
    sector: sp.sector?.trim() || undefined,
    rating: sp.rating?.trim() || undefined,
    agency: sp.agency?.trim() || undefined,
    ratingYear: sp.ratingYear ? Number(sp.ratingYear) || undefined : undefined,
    investorType: sp.investorType?.trim() || undefined,
    portfolioSize: sp.portfolioSize?.trim() || undefined,
    riskAppetite: sp.riskAppetite?.trim() || undefined,
    highYield:
      sp.highYield === "true" ? true : sp.highYield === "false" ? false : undefined,
    assignedUserId: sp.assignedUserId?.trim() || undefined,
  };

  const { rows, total, page: curPage, pageSize, summary } = await listParties({
    q,
    page,
    pageSize: PAGE_SIZE,
    filters,
    user,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Selection syncs via ?id=. Default to the first row so the preview pane is
  // populated on first paint (no empty inspector above a non-empty list). If the
  // requested id isn't on the current page, still try to load its preview - the
  // pane shows it while the list falls back to the first-row highlight.
  const selectedId =
    (requestedId && rows.some((r) => r.partyId === requestedId)
      ? requestedId
      : requestedId ?? rows[0]?.partyId) ?? null;

  const preview = selectedId ? await getPartyPreview(selectedId, user) : null;

  return (
    <PageShell>
      {/*
          `display` renders the title in Fraunces - the editorial page opener. */}
      <PageHeader title="Parties" description="Issuers, investors, and intermediaries in your book." />

      <PartiesExplorer
        rows={rows}
        total={total}
        page={curPage}
        pageSize={pageSize}
        totalPages={totalPages}
        q={q}
        filters={filters}
        summary={summary}
        selectedId={selectedId}
        preview={preview}
      />
    </PageShell>
  );
}
