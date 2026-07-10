import Link from "next/link";

import { requireUser, can } from "@/lib/rbac";
import { listInvestors } from "@/features/portal/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CEmpty } from "@/console/primitives/empty";

export const dynamic = "force-dynamic";
export const metadata = { title: "Investors" };

export default async function ConsoleInvestorPortalPage() {
  const user = await requireUser();
  if (!can(user, "read", "party") && !can(user, "manage", "user")) {
    return (
      <CEmpty
        title="No portal access"
        body="Party read is required for investor directory."
        actionLabel="Home"
        actionHref="/console"
      />
    );
  }

  const { rows, total } = await listInvestors({ user, page: 1, pageSize: 40 });

  return (
    <div>
      <CPageHeader
        eyebrow="Portal"
        title="Investors"
        description={`${total} institutional investors for placement desks.`}
      />
      {rows.length === 0 ? (
        <CEmpty title="No investors" body="Typed investors appear when assigned investor role." />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {rows.map((r) => (
            <Link key={r.partyId} href={`/console/parties/${r.partyId}`}>
              <CCard className="p-3 transition-colors hover:bg-[var(--c-surface)]">
                <p className="text-[13px] font-semibold text-[var(--c-ink)]">
                  {r.legalName}
                </p>
                <p className="mt-1 text-[11px] text-[var(--c-accent)]">
                  Open party →
                </p>
              </CCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
