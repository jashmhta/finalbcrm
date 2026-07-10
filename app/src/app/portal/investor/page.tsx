import { requireUser } from "@/lib/rbac";
import { listInvestors } from "@/features/portal";
import { InvestorDirectoryView } from "./investor-directory-view";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";

// DB-backed directory - never prerender.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function InvestorPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const { rows, total, page: curPage, pageSize, totalPages, summary } =
    await listInvestors({ q, page, pageSize: PAGE_SIZE, user });

  return (
    <PageShell>
      <PageHeader
        title="Investors"
        description="The buy-side book - every investor party Binary has placed paper for, ranked by portfolio value. Select an investor to view their bond holdings, allocation history, KYC status and demat details. Read-only."
      />

      <InvestorDirectoryView
        rows={rows}
        total={total}
        page={curPage}
        pageSize={pageSize}
        totalPages={totalPages}
        q={q}
        summary={summary}
      />
    </PageShell>
  );
}
