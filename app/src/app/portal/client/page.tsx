import { requireUser } from "@/lib/rbac";
import { listClients } from "@/features/portal";
import { ClientDirectoryView } from "./client-directory-view";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";

// DB-backed directory - never prerender.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function ClientPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const { rows, total, page: curPage, pageSize, totalPages, summary } =
    await listClients({ q, page, pageSize: PAGE_SIZE, user });

  return (
    <PageShell>
      <PageHeader
        title="Clients"
        description="The issuer book - every client Binary is advising or placing paper for, ranked by total raised. Select a client to view their deals, documents, KYC history and onboarding status. Read-only."
      />

      <ClientDirectoryView
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
