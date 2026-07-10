import Link from "next/link";

import { requireUser, can } from "@/lib/rbac";
import { getLeadsPipeline } from "@/features/leads/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { ListSearch } from "@/console/patterns/list-search";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";
import { formatCrorePlain } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads" };

const CARD_CAP = 12;

export default async function ConsoleLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const allowed =
    can(user, "read", "lead") ||
    can(user, "read", "party") ||
    can(user, "create", "lead");
  if (!allowed) {
    return (
      <CEmpty
        title="No access to leads"
        body="Your role lacks lead pipeline access."
        actionLabel="Home"
        actionHref="/console"
      />
    );
  }

  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  // Default: focus active funnel (hide won/lost clutter). ?all=1 shows full board.
  const activeOnly = sp.all !== "1";
  const groups = await getLeadsPipeline(user, { q, activeOnly });
  const total = groups.reduce((n, g) => n + g.leads.length, 0);
  const weighted = groups.reduce(
    (n, g) =>
      n +
      g.leads.reduce(
        (s, r) =>
          s +
          (Number(r.lead.estSizeCr) || 0) *
            ((Number(r.lead.probability) || 0) / 100),
        0,
      ),
    0,
  );
  const hot = groups.reduce(
    (n, g) =>
      n + g.leads.filter((r) => (r.lead.probability ?? 0) >= 60).length,
    0,
  );

  return (
    <div>
      <CPageHeader
        eyebrow="Pipeline"
        title="Leads"
        description={
          activeOnly
            ? "Active funnel only — search, then open a card. Toggle full board for won/lost."
            : "Full funnel including terminal stages."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={
                activeOnly
                  ? q
                    ? `/console/leads?all=1&q=${encodeURIComponent(q)}`
                    : "/console/leads?all=1"
                  : q
                    ? `/console/leads?q=${encodeURIComponent(q)}`
                    : "/console/leads"
              }
              className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] bg-[var(--c-surface)] px-4 text-[13px] font-medium ring-1 ring-[var(--c-line-strong)]"
            >
              {activeOnly ? "Show won/lost" : "Focus active"}
            </Link>
            {can(user, "create", "lead") || can(user, "create", "party") ? (
              <Link
                href="/console/leads/new"
                className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] bg-[var(--c-accent)] px-4 text-[13px] font-medium text-[var(--c-on-accent)]"
              >
                New lead
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniKpi label="In view" value={String(total)} />
        <MiniKpi label="Hot (≥60%)" value={String(hot)} />
        <MiniKpi
          label="Weighted pipeline"
          value={formatCrorePlain(weighted)}
        />
        <MiniKpi
          label="View"
          value={activeOnly ? "Active" : "Full board"}
        />
      </div>

      <ListSearch
        action="/console/leads"
        q={q}
        placeholder="Search company, contact, deal type…"
        preserve={activeOnly ? undefined : { all: "1" }}
      />

      {total === 0 ? (
        <CEmpty
          title={q ? "No leads match" : "No leads yet"}
          body={
            q
              ? "Try a shorter name or clear the search."
              : "Capture a prospect to start the Capital or Bonds funnel."
          }
          actionLabel={q ? "Clear search" : "New lead"}
          actionHref={q ? "/console/leads" : "/console/leads/new"}
        />
      ) : (
        <div className="c-kanban -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
          {groups.map((g) => {
            const shown = g.leads.slice(0, CARD_CAP);
            const extra = g.leads.length - shown.length;
            return (
              <section
                key={g.stage}
                className="c-kanban__col w-[min(78vw,260px)] shrink-0 snap-start rounded-[var(--c-radius-lg)] bg-[var(--c-surface-2)]/60 p-2 ring-1 ring-[var(--c-line)] md:w-[260px]"
              >
                <header className="mb-2 flex items-center justify-between px-1">
                  <h2 className="text-[12px] font-semibold capitalize text-[var(--c-ink)]">
                    {g.stage}
                  </h2>
                  <CBadge tone="neutral">{g.leads.length}</CBadge>
                </header>
                <ul className="flex max-h-none flex-col gap-2 md:max-h-[68vh] md:overflow-y-auto">
                  {shown.length === 0 ? (
                    <li className="px-2 py-6 text-center text-[12px] text-[var(--c-ink-3)]">
                      Empty
                    </li>
                  ) : (
                    shown.map((row) => {
                      const prob = row.lead.probability ?? 0;
                      return (
                        <li key={row.partyId}>
                          <Link href={`/console/leads/${row.partyId}`}>
                            <CCard className="p-3 shadow-none transition-colors hover:bg-[var(--c-surface)]">
                              <div className="flex items-start justify-between gap-2">
                                <p className="line-clamp-2 text-[13px] font-semibold text-[var(--c-ink)]">
                                  {row.legalName}
                                </p>
                                {prob >= 60 ? (
                                  <CBadge tone="ok">{prob}%</CBadge>
                                ) : prob > 0 ? (
                                  <CBadge tone="neutral">{prob}%</CBadge>
                                ) : null}
                              </div>
                              <p className="mt-1 text-[12px] text-[var(--c-ink-2)]">
                                {(row.lead.dealType ?? "deal").replace(
                                  /_/g,
                                  " ",
                                )}
                                {row.lead.estSizeCr != null
                                  ? ` · ${formatCrorePlain(row.lead.estSizeCr)}`
                                  : ""}
                              </p>
                              {row.lead.contactName ? (
                                <p className="mt-1 truncate text-[11px] text-[var(--c-ink-3)]">
                                  {row.lead.contactName}
                                </p>
                              ) : null}
                            </CCard>
                          </Link>
                        </li>
                      );
                    })
                  )}
                  {extra > 0 ? (
                    <li className="px-2 py-2 text-center text-[11px] text-[var(--c-ink-3)]">
                      +{extra} more — refine search
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
