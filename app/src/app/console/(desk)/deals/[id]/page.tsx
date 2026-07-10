import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser, can } from "@/lib/rbac";
import { getDealDetail } from "@/features/deals/queries";
import { stageLadderFor, nextStageFor } from "@/features/deals/stages";
import type { DealType } from "@/features/deals/catalog";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";
import { formatCrorePlain } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deal" };

function pretty(s: string | null | undefined): string {
  if (!s) return "—";
  return s.replace(/_/g, " ");
}

function fmtDate(v: string | Date | null | undefined): string {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default async function ConsoleDealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "read", "deal") && !can(user, "read_all", "deal")) {
    return (
      <CEmpty
        title="No access to deals"
        body="Your role lacks deal:read. Ask an admin to grant pipeline access."
        actionLabel="Home"
        actionHref="/console"
      />
    );
  }

  const { id } = await params;
  const detail = await getDealDetail(id, user);
  if (!detail) notFound();

  const ladder = stageLadderFor(detail.dealType as DealType);
  const next = nextStageFor(detail.dealType as DealType, detail.status);
  const stageIdx = ladder.indexOf(
    (detail.status ?? "lead") as (typeof ladder)[number],
  );
  const title =
    detail.dealName &&
    detail.dealCode &&
    detail.dealName !== detail.dealCode
      ? detail.dealName
      : (detail.dealName ?? detail.dealCode ?? detail.dealId.slice(0, 8));

  const leadParty = detail.parties.find((p) => p.isLead) ?? detail.parties[0];
  const totalCommitment = detail.parties.reduce(
    (acc, p) => acc + (p.commitmentAmount ? Number(p.commitmentAmount) : 0),
    0,
  );

  return (
    <div>
      <CPageHeader
        eyebrow={`Pipeline · ${pretty(detail.status)}`}
        title={title}
        description={`${pretty(detail.dealType)} · ${detail.brand}`}
        actions={
          <Link
            href="/console/deals"
            className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] bg-[var(--c-surface)] px-4 text-[13px] font-medium ring-1 ring-[var(--c-line-strong)]"
          >
            Back to board
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <CBadge tone="accent">{pretty(detail.status)}</CBadge>
        <CBadge tone="neutral">{detail.brand}</CBadge>
        {detail.dealCode ? (
          <CBadge tone="info">{detail.dealCode}</CBadge>
        ) : null}
        {detail.targetSize ? (
          <CBadge tone="ok">
            {formatCrorePlain(Number(detail.targetSize))}
          </CBadge>
        ) : null}
      </div>

      {/* Stage ladder */}
      <CCard className="mb-4 overflow-x-auto p-3">
        <ol className="flex min-w-max gap-1">
          {ladder.map((st, i) => {
            const done = stageIdx >= 0 && i <= stageIdx;
            const current = st === detail.status;
            return (
              <li
                key={st}
                className={`rounded-[var(--c-radius)] px-2.5 py-1.5 text-[11px] font-medium capitalize ${
                  current
                    ? "bg-[var(--c-accent)] text-[var(--c-on-accent)]"
                    : done
                      ? "bg-[var(--c-surface-2)] text-[var(--c-ink)]"
                      : "text-[var(--c-ink-3)]"
                }`}
              >
                {pretty(st)}
              </li>
            );
          })}
        </ol>
      </CCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <CCard className="lg:col-span-2 space-y-3">
          <h2 className="text-[13px] font-semibold text-[var(--c-ink)]">
            Mandate
          </h2>
          <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
            <Row k="Type" v={pretty(detail.dealType)} />
            <Row k="Status" v={pretty(detail.status)} />
            <Row
              k="Target size"
              v={
                detail.targetSize
                  ? formatCrorePlain(Number(detail.targetSize))
                  : "—"
              }
            />
            <Row
              k="Tenor"
              v={
                detail.targetTenorYears
                  ? `${detail.targetTenorYears} yrs`
                  : "—"
              }
            />
            <Row k="Target close" v={fmtDate(detail.targetCloseDate)} />
            <Row k="Currency" v={detail.currencyCode ?? "INR"} />
          </dl>

          <h2 className="pt-2 text-[13px] font-semibold text-[var(--c-ink)]">
            Parties ({detail.parties.length})
          </h2>
          {detail.parties.length === 0 ? (
            <p className="text-[13px] text-[var(--c-ink-3)]">
              No parties linked yet.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--c-line)]">
              {detail.parties.map((p) => (
                <li
                  key={`${p.partyId}-${p.role}`}
                  className="flex items-center justify-between gap-2 py-2 text-[13px]"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/console/parties/${p.partyId}`}
                      className="font-medium text-[var(--c-accent)] hover:underline"
                    >
                      {p.legalName}
                    </Link>
                    <p className="text-[11px] capitalize text-[var(--c-ink-3)]">
                      {pretty(p.role)}
                      {p.isLead ? " · lead" : ""}
                      {p.partyNature ? ` · ${pretty(p.partyNature)}` : ""}
                    </p>
                  </div>
                  {p.commitmentAmount ? (
                    <span className="shrink-0 font-mono text-[12px] text-[var(--c-ink-2)]">
                      {formatCrorePlain(Number(p.commitmentAmount))}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {totalCommitment > 0 ? (
            <p className="text-[12px] text-[var(--c-ink-3)]">
              Total commitment: {formatCrorePlain(totalCommitment)}
            </p>
          ) : null}
        </CCard>

        <div className="space-y-4">
          <CCard>
            <h2 className="mb-3 text-[13px] font-semibold text-[var(--c-ink)]">
              Next actions
            </h2>
            <ul className="space-y-2 text-[13px]">
              {next ? (
                <li className="text-[var(--c-ink-2)]">
                  Advance toward{" "}
                  <span className="font-medium capitalize text-[var(--c-ink)]">
                    {pretty(next)}
                  </span>
                </li>
              ) : (
                <li className="text-[var(--c-ink-3)]">
                  Terminal or off-pipeline stage
                </li>
              )}
              <li>
                <Link
                  className="text-[var(--c-accent)] hover:underline"
                  href="/console/tasks"
                >
                  Create follow-up task
                </Link>
              </li>
              <li>
                <Link
                  className="text-[var(--c-accent)] hover:underline"
                  href="/console/interactions"
                >
                  Log an interaction
                </Link>
              </li>
              <li>
                <Link
                  className="text-[var(--c-accent)] hover:underline"
                  href="/console/documents"
                >
                  Attach documents
                </Link>
              </li>
              {leadParty ? (
                <li>
                  <Link
                    className="text-[var(--c-accent)] hover:underline"
                    href={`/console/matching/${leadParty.partyId}`}
                  >
                    Run matching for issuer
                  </Link>
                </li>
              ) : (
                <li>
                  <Link
                    className="text-[var(--c-accent)] hover:underline"
                    href="/console/matching"
                  >
                    Open matching desk
                  </Link>
                </li>
              )}
              {leadParty ? (
                <li>
                  <Link
                    className="text-[var(--c-accent)] hover:underline"
                    href={`/console/parties/${leadParty.partyId}`}
                  >
                    Open lead party
                  </Link>
                </li>
              ) : null}
              <li>
                <Link
                  className="text-[var(--c-accent)] hover:underline"
                  href="/console/credit"
                >
                  Credit workspace
                </Link>
              </li>
            </ul>
          </CCard>

          <CCard>
            <h2 className="mb-2 text-[13px] font-semibold text-[var(--c-ink)]">
              Meta
            </h2>
            <dl className="space-y-2 text-[13px]">
              <Row k="Deal id" v={detail.dealId.slice(0, 8) + "…"} />
              <Row k="Updated" v={fmtDate(detail.updatedAt)} />
            </dl>
          </CCard>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--c-line)] pb-2 last:border-0">
      <dt className="text-[var(--c-ink-3)]">{k}</dt>
      <dd className="text-right font-medium text-[var(--c-ink)]">{v}</dd>
    </div>
  );
}
