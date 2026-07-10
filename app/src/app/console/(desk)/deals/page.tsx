import Link from "next/link";

import { requireUser, can } from "@/lib/rbac";
import { getDealPipeline } from "@/features/deals/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { ListSearch } from "@/console/patterns/list-search";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";
import { formatCrorePlain } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pipeline" };

/** Primary execution stages — hide empty terminal noise by default. */
const PRIMARY_STAGES = [
  "lead",
  "mandated",
  "in_dd",
  "structuring",
  "rating_marketing",
  "pricing",
  "allocation",
  "settled",
] as const;

const ALL_STAGES = [
  ...PRIMARY_STAGES,
  "closed",
  "on_hold",
  "dropped",
] as const;

const CARD_CAP = 10;

export default async function ConsoleDealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  if (!can(user, "read", "deal")) {
    return (
      <CEmpty
        title="No access to deals"
        body="Your role lacks deal:read. Ask an admin to grant pipeline access."
        actionLabel="Home"
        actionHref="/console"
      />
    );
  }

  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const showAll = sp.all === "1";

  const { groups, total } = await getDealPipeline({
    user,
    perStage: 40,
    filters: q ? { q } : {},
  });
  const byStatus = new Map(groups.map((g) => [g.status, g.deals]));
  const stageList = showAll ? ALL_STAGES : PRIMARY_STAGES;

  const openExposure = groups
    .filter((g) => !["closed", "dropped"].includes(g.status ?? ""))
    .reduce(
      (n, g) =>
        n +
        g.deals.reduce((s, d) => s + (d.targetSize ? Number(d.targetSize) : 0), 0),
      0,
    );
  const mandated =
    (byStatus.get("mandated")?.length ?? 0) +
    (byStatus.get("in_dd")?.length ?? 0) +
    (byStatus.get("pricing")?.length ?? 0);

  const shownCount = stageList.reduce(
    (n, s) => n + (byStatus.get(s)?.length ?? 0),
    0,
  );

  return (
    <div>
      <CPageHeader
        eyebrow="Pipeline"
        title="Mandates"
        description="Live book-running board — search by code, name, or issuer."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={
                showAll
                  ? q
                    ? `/console/deals?q=${encodeURIComponent(q)}`
                    : "/console/deals"
                  : q
                    ? `/console/deals?all=1&q=${encodeURIComponent(q)}`
                    : "/console/deals?all=1"
              }
              className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] bg-[var(--c-surface)] px-4 text-[13px] font-medium ring-1 ring-[var(--c-line-strong)]"
            >
              {showAll ? "Hide closed/dropped" : "Show all stages"}
            </Link>
            <Link
              href="/console/leads"
              className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] bg-[var(--c-accent)] px-4 text-[13px] font-medium text-[var(--c-on-accent)]"
            >
              From leads
            </Link>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniKpi
          label="In pipeline"
          value={total.toLocaleString("en-IN")}
        />
        <MiniKpi label="Active stages" value={String(shownCount)} />
        <MiniKpi label="Live execution" value={String(mandated)} />
        <MiniKpi
          label="Open target"
          value={formatCrorePlain(openExposure)}
        />
      </div>

      <ListSearch
        action="/console/deals"
        q={q}
        placeholder="Search mandate code, name, issuer…"
        preserve={showAll ? { all: "1" } : undefined}
      />

      {total === 0 ? (
        <CEmpty
          title="No deals in pipeline"
          body="Mandates appear when leads convert or desks create book-running deals."
          actionLabel="Open leads"
          actionHref="/console/leads"
        />
      ) : (
        <div className="c-kanban -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
          {stageList.map((status) => {
            const deals = byStatus.get(status) ?? [];
            // Skip empty non-primary noise unless searching
            if (
              deals.length === 0 &&
              !q &&
              !["lead", "mandated", "in_dd", "pricing", "allocation"].includes(
                status,
              )
            ) {
              return null;
            }
            const shown = deals.slice(0, CARD_CAP);
            const extra = deals.length - shown.length;
            return (
              <section
                key={status}
                className="c-kanban__col w-[min(78vw,280px)] shrink-0 snap-start rounded-[var(--c-radius-lg)] bg-[var(--c-surface-2)]/60 p-2 ring-1 ring-[var(--c-line)] md:w-[280px]"
              >
                <header className="mb-2 flex items-center justify-between px-1">
                  <h2 className="text-[12px] font-semibold capitalize text-[var(--c-ink)]">
                    {status.replace(/_/g, " ")}
                  </h2>
                  <CBadge tone="neutral">{deals.length}</CBadge>
                </header>
                <ul className="flex max-h-none flex-col gap-2 md:max-h-[68vh] md:overflow-y-auto">
                  {shown.length === 0 ? (
                    <li className="px-2 py-6 text-center text-[12px] text-[var(--c-ink-3)]">
                      Empty
                    </li>
                  ) : (
                    shown.map((d) => (
                      <li key={d.dealId}>
                        <Link
                          href={`/console/deals/${d.dealId}`}
                          className="block rounded-[var(--c-radius-lg)] outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--c-accent)]"
                        >
                          <CCard className="p-3 shadow-none transition-colors hover:bg-[var(--c-surface)]">
                            <p className="text-[11px] font-mono text-[var(--c-ink-3)]">
                              {d.dealCode ?? d.dealId.slice(0, 8)}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[13px] font-semibold text-[var(--c-ink)]">
                              {d.dealName ?? "Untitled mandate"}
                            </p>
                            <p className="mt-1 text-[12px] text-[var(--c-ink-2)]">
                              {d.dealType.replace(/_/g, " ")}
                              {d.targetSize
                                ? ` · ${formatCrorePlain(Number(d.targetSize))}`
                                : ""}
                            </p>
                            {d.parties[0] ? (
                              <p className="mt-1 truncate text-[11px] text-[var(--c-ink-3)]">
                                {d.parties[0].legalName}
                              </p>
                            ) : null}
                          </CCard>
                        </Link>
                      </li>
                    ))
                  )}
                  {extra > 0 ? (
                    <li className="px-2 py-2 text-center text-[11px] text-[var(--c-ink-3)]">
                      +{extra} more — use search
                    </li>
                  ) : null}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <CCard className="p-3">
      <p className="text-[11px] text-[var(--c-ink-3)]">{label}</p>
      <p className="mt-0.5 text-[16px] font-semibold tabular-nums text-[var(--c-ink)]">
        {value}
      </p>
    </CCard>
  );
}
