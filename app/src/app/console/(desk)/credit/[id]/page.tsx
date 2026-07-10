import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/rbac";
import { canAccessCreditModule } from "@/lib/org";
import { getCreditAnalysisDetail } from "@/features/credit/queries";
import { getCreditSummary } from "@/features/ai";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";

export const dynamic = "force-dynamic";
export const metadata = { title: "Credit analysis" };

export default async function ConsoleCreditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  // Desk gate only — not implicit credit:read for general RMs.
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

  const { id } = await params;
  const detail = await getCreditAnalysisDetail(id, user);
  if (!detail) notFound();

  const a = detail.analysis;
  const summary = await getCreditSummary(id, user);

  return (
    <div>
      <CPageHeader
        eyebrow={`Credit · ${a.analysisType ?? "analysis"}`}
        title={detail.party?.legalName ?? "Obligor"}
        description={
          a.internalRatingShort
            ? `Internal ${a.internalRatingShort}`
            : "Internal credit case"
        }
        actions={
          <Link
            href="/console/credit"
            className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] px-4 text-[13px] ring-1 ring-[var(--c-line-strong)]"
          >
            Back to list
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {a.internalRatingShort ? (
          <CBadge tone="accent">{a.internalRatingShort}</CBadge>
        ) : null}
        {a.watchlistFlag ? <CBadge tone="bad">Watchlist</CBadge> : null}
        {a.currentCreditScore != null ? (
          <CBadge tone="info">Score {String(a.currentCreditScore)}</CBadge>
        ) : null}
        <CBadge tone="neutral">{a.obligorType}</CBadge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <CCard className="lg:col-span-2 space-y-3">
          <h2 className="text-[13px] font-semibold">AI credit memo</h2>
          {summary ? (
            <div className="space-y-3 text-[13px] leading-relaxed text-[var(--c-ink-2)]">
              <p>{summary.issuer}</p>
              <p>{summary.financials}</p>
              <p>{summary.assessment}</p>
              {summary.recommendation ? (
                <p className="font-medium text-[var(--c-ink)]">
                  {summary.recommendation}
                  {summary.ratingLine ? ` · ${summary.ratingLine}` : ""}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-[13px] text-[var(--c-ink-3)]">
              Summary unavailable for this analysis.
            </p>
          )}

          <h2 className="pt-2 text-[13px] font-semibold">Score components</h2>
          {detail.scores.length === 0 ? (
            <p className="text-[13px] text-[var(--c-ink-3)]">No score rows yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--c-line)] text-[13px]">
              {detail.scores.map((s) => (
                <li
                  key={s.creditScoreId ?? s.componentCode}
                  className="flex justify-between gap-2 py-1.5"
                >
                  <span className="text-[var(--c-ink-2)]">{s.componentCode}</span>
                  <span className="font-mono">{s.componentScore ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </CCard>

        <div className="space-y-4">
          <CCard>
            <h2 className="mb-3 text-[13px] font-semibold">Next actions</h2>
            <ul className="space-y-2 text-[13px]">
              <li>
                <Link
                  className="text-[var(--c-accent)]"
                  href={`/console/parties/${a.partyId}`}
                >
                  Open party
                </Link>
              </li>
              <li>
                <Link className="text-[var(--c-accent)]" href="/console/documents">
                  Documents
                </Link>
              </li>
              <li>
                <Link className="text-[var(--c-accent)]" href="/console/modeling">
                  Related models
                </Link>
              </li>
              <li>
                <Link className="text-[var(--c-accent)]" href="/console/ai">
                  AI hub
                </Link>
              </li>
            </ul>
          </CCard>
          <CCard>
            <h2 className="mb-2 text-[13px] font-semibold">Meta</h2>
            <dl className="space-y-2 text-[13px]">
              <Row k="Type" v={a.analysisType ?? "—"} />
              <Row k="Rating" v={a.internalRatingShort ?? "—"} />
              <Row k="Lifecycle" v={detail.lifecycleStatus} />
              <Row
                k="Action"
                v={a.internalRatingAction?.replace(/_/g, " ") ?? "—"}
              />
            </dl>
          </CCard>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 border-b border-[var(--c-line)] pb-2 last:border-0">
      <dt className="text-[var(--c-ink-3)]">{k}</dt>
      <dd className="font-medium text-[var(--c-ink)]">{v}</dd>
    </div>
  );
}
