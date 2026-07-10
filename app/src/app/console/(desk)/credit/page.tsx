import Link from "next/link";

import { requireUser } from "@/lib/rbac";
import { listCreditAnalyses } from "@/features/credit/queries";
import { canAccessCreditModule } from "@/lib/org";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";

export const dynamic = "force-dynamic";
export const metadata = { title: "Credit" };

export default async function ConsoleCreditPage() {
  const user = await requireUser();
  // Desk gate only — do not open on implicit credit:read for coverage RMs.
  if (!canAccessCreditModule(user.roles)) {
    return (
      <CEmpty
        title="Credit module inactive"
        body="Credit analysis is limited to credit desk and supers unless enabled."
        actionLabel="Home"
        actionHref="/console"
      />
    );
  }

  const { rows, total } = await listCreditAnalyses({
    user,
    page: 1,
    pageSize: 40,
  });

  return (
    <div>
      <CPageHeader
        eyebrow="Risk"
        title="Credit analysis"
        description={`${total} analyses · internal BC bands and scorecards.`}
      />
      {rows.length === 0 ? (
        <CEmpty
          title="No credit analyses"
          body="Origination and surveillance cases appear here."
        />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link
              key={r.creditAnalysisId}
              href={`/console/credit/${r.creditAnalysisId}`}
              className="block"
            >
              <CCard className="p-3 transition-colors hover:bg-[var(--c-surface)]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--c-ink)]">
                      {r.legalName}
                    </p>
                    <p className="text-[12px] text-[var(--c-ink-3)]">
                      {r.analysisType} · {r.obligorType}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {r.internalRatingShort ? (
                      <CBadge tone="accent">{r.internalRatingShort}</CBadge>
                    ) : null}
                    {r.watchlistFlag ? <CBadge tone="bad">Watch</CBadge> : null}
                    {r.currentCreditScore != null ? (
                      <CBadge tone="info">{r.currentCreditScore}</CBadge>
                    ) : null}
                  </div>
                </div>
              </CCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
