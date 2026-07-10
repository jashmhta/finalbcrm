import { PageHeader, PageShell } from "@/components/brand/page-shell";
import { requireUser } from "@/lib/rbac";
import { listCreditAnalyses } from "@/features/credit/queries";
import { Reveal } from "@/components/brand";
import { CreditListView } from "./credit-list-view";

// DB-backed list - never prerender. searchParams opt into dynamic rendering
// anyway, but force-dynamic is explicit so the build never tries to execute
// the query at build time.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function CreditListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const { rows, total, page: curPage, pageSize } = await listCreditAnalyses({
    q,
    user,
    page,
    pageSize: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <PageShell>
      <PageHeader title="Credit" description="Analyses, scorecards, and rating work." />

      <CreditListView
        rows={rows}
        total={total}
        page={curPage}
        pageSize={pageSize}
        totalPages={totalPages}
        q={q}
      />
    </PageShell>
  );
}
