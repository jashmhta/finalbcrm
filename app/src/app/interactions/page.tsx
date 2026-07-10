import { PageHeader, PageShell } from "@/components/brand/page-shell";
import { requireUser } from "@/lib/rbac";
import { listInteractions } from "@/features/interactions/queries";
import { Reveal } from "@/components/brand";
import { InteractionsListView } from "./interactions-list-view";

// DB-backed timeline - never prerender. force-dynamic is explicit so the build
// never tries to execute the query at build time.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function InteractionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mnpi?: string; page?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const mnpiOnly = sp.mnpi === "1";

  const { rows, total, page: curPage, pageSize } = await listInteractions({
    mnpiOnly,
    filters: { q },
    user,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <PageShell>
      <PageHeader title="Interactions" description="Meetings, calls, email, and WhatsApp logs." />

      <InteractionsListView
        rows={rows}
        total={total}
        page={curPage}
        pageSize={pageSize}
        totalPages={totalPages}
        q={q}
        mnpiOnly={mnpiOnly}
      />
    </PageShell>
  );
}
