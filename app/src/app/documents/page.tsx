import { PageHeader, PageShell } from "@/components/brand/page-shell";
import { requireUser } from "@/lib/rbac";
import { listDocuments } from "@/features/documents/queries";
import { Reveal } from "@/components/brand";
import { DocumentsListView } from "./documents-list-view";

// DB-backed document index - never prerender.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export const TYPE_FILTERS = [
  "all",
  "engagement_letter",
  "mandate_letter",
  "term_sheet",
  "offering_circular",
  "information_memorandum",
  "kyc_pack",
  "financial_statement",
  "credit_memo",
  "legal_dd_report",
  "site_report",
  "consent_form",
  "other",
] as const;

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    q?: string;
    mnpi?: string;
    page?: string;
  }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const typeKey = sp.type ?? "all";
  const mnpiOnly = sp.mnpi === "1";

  const documentType =
    typeKey !== "all" && (TYPE_FILTERS as readonly string[]).includes(typeKey)
      ? typeKey
      : undefined;

  const { rows, total, page: curPage, pageSize } = await listDocuments({
    documentType,
    mnpiOnly,
    q,
    user,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <PageShell>
      <PageHeader title="Documents" description="NDAs, term sheets, KYC packs, and filings." />

      <DocumentsListView
        rows={rows}
        total={total}
        page={curPage}
        pageSize={pageSize}
        totalPages={totalPages}
        q={q}
        typeKey={typeKey}
        mnpiOnly={mnpiOnly}
        typeFilters={TYPE_FILTERS}
      />
    </PageShell>
  );
}
