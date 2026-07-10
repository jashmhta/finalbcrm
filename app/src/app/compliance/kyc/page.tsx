import { PageHeader, PageShell } from "@/components/brand/page-shell";
import { requireUser } from "@/lib/rbac";
import { listKycRecords } from "@/features/compliance/queries";
import { KycBoardView } from "./kyc-board-view";

// DB-backed board - never prerender. searchParams opt into dynamic rendering
// anyway, but force-dynamic is explicit so the build never tries to execute
// the query at build time.
export const dynamic = "force-dynamic";

// The board reads the whole queue (not a 25-row page) so every lifecycle
// column is populated. A generous cap covers the seeded ~150 records; if the
// ledger grows past it the view surfaces an honest "showing first N of M"
// note rather than silently truncating a column. q / risk / status stay
// URL-driven so a filtered view is shareable; the server re-runs the query.
const BOARD_PAGE_SIZE = 300;

export default async function KycListPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    risk?: string;
    page?: string;
  }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const status = sp.status || undefined;
  const risk = sp.risk || undefined;

  const { rows, total } = await listKycRecords({
    q,
    status,
    risk,
    user,
    page: 1,
    pageSize: BOARD_PAGE_SIZE,
  });

  return (
    <PageShell>
      {/* Section heading renders VISIBLE on mount (no whileInView opacity-0
          gate) - the board itself animates on mount in the client view. */}
      <PageHeader title="KYC" description="PMLA KYC status, expiry, and review." />

      <KycBoardView rows={rows} total={total} q={q} risk={risk} />
    </PageShell>
  );
}
