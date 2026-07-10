import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser, can } from "@/lib/rbac";
import { getMatchMatrix } from "@/features/matching/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";
import { SendToDealForm } from "./send-form";

export const dynamic = "force-dynamic";

export default async function ConsoleMatchMatrixPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const allowed =
    can(user, "read", "matching") ||
    can(user, "read", "deal") ||
    can(user, "run", "matching");
  if (!allowed) {
    return (
      <CEmpty
        title="No matching access"
        body="You need matching or deal read permission."
        actionLabel="Home"
        actionHref="/console"
      />
    );
  }

  const { id } = await params;
  const matrix = await getMatchMatrix(id, user);
  if (!matrix) notFound();

  const top = matrix.matches.slice(0, 40);
  const canSend =
    can(user, "create", "deal") || can(user, "run", "matching");

  return (
    <div>
      <CPageHeader
        eyebrow="Investor match"
        title={matrix.issuer.legalName}
        description={
          matrix.issuer.dealName
            ? `${matrix.issuer.dealName} · pool ${matrix.investorPool}`
            : `Ranked ${top.length} of ${matrix.investorPool} investors`
        }
        actions={
          <Link
            href="/console/matching"
            className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] px-4 text-[13px] ring-1 ring-[var(--c-line-strong)]"
          >
            All issuers
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {matrix.issuer.ratingValue ? (
          <CBadge tone="accent">{matrix.issuer.ratingValue}</CBadge>
        ) : null}
        {matrix.issuer.sectorLabel ? (
          <CBadge tone="neutral">{matrix.issuer.sectorLabel}</CBadge>
        ) : null}
        {matrix.issuer.tenorYears != null ? (
          <CBadge tone="info">{matrix.issuer.tenorYears}y tenor</CBadge>
        ) : null}
        {matrix.issuer.targetSizeCrores != null ? (
          <CBadge tone="info">
            ₹{matrix.issuer.targetSizeCrores} Cr target
          </CBadge>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <CCard className="c-table-scroll overflow-x-auto p-0 md:p-0 lg:col-span-3">
          <table className="c-table w-full min-w-[520px] max-w-none text-left text-[12px]">
            <thead className="sticky top-0 bg-[var(--c-surface)]">
              <tr className="border-b border-[var(--c-line)] text-[11px] uppercase tracking-wide text-[var(--c-ink-3)]">
                <th className="px-3 py-2.5 font-medium">Investor</th>
                <th className="px-3 py-2.5 font-medium text-right">Score</th>
                {matrix.criteria.slice(0, 4).map((c) => (
                  <th key={c.key} className="px-2 py-2.5 font-medium">
                    {c.tag}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top.map((m) => (
                <tr
                  key={m.investor.partyId}
                  className="border-b border-[var(--c-line)] last:border-0"
                >
                  <td className="px-3 py-2.5 font-medium text-[var(--c-ink)]">
                    {m.investor.legalName}
                    {m.warmIntro?.strength && m.warmIntro.strength !== "none" ? (
                      <span className="ml-1 text-[10px] text-[var(--c-accent)]">
                        warm
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">
                    {Math.round(m.score)}
                  </td>
                  {matrix.criteria.slice(0, 4).map((c) => {
                    const cr = m.criteria.find((x) => x.key === c.key);
                    return (
                      <td key={c.key} className="px-2 py-2.5 text-[var(--c-ink-2)]">
                        {cr ? Math.round(cr.score * 100) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CCard>

        <CCard className="lg:col-span-2">
          <h2 className="mb-3 text-[14px] font-semibold">Send to deal</h2>
          {canSend ? (
            <SendToDealForm
              issuerId={matrix.issuer.partyId}
              defaultDealName={
                matrix.issuer.dealName ??
                `${matrix.issuer.legalName} placement`
              }
              defaultSize={matrix.issuer.targetSizeCrores ?? 100}
              defaultTenor={matrix.issuer.tenorYears ?? 5}
              topInvestors={top.slice(0, 12).map((m) => ({
                partyId: m.investor.partyId,
                legalName: m.investor.legalName,
                score: m.score,
              }))}
              existingDealId={matrix.issuer.dealId}
            />
          ) : (
            <p className="text-[13px] text-[var(--c-ink-3)]">
              You need deal:create or matching:run to place investors.
            </p>
          )}
        </CCard>
      </div>
    </div>
  );
}
