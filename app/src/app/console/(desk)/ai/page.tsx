import Link from "next/link";

import { requireUser } from "@/lib/rbac";
import { getNextActions, NEXT_ACTION_KIND_LABEL } from "@/features/ai";
import { listCreditAnalyses } from "@/features/credit/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";
import { toConsoleHref } from "@/console/lib/console-href";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI" };

export default async function ConsoleAiPage() {
  const user = await requireUser();
  const [nba, credit] = await Promise.all([
    getNextActions(user.appUserId, { limit: 8 }),
    listCreditAnalyses({ user, page: 1, pageSize: 5 }),
  ]);

  return (
    <div>
      <CPageHeader
        eyebrow="Insights"
        title="AI assistants"
        description="Deterministic next-best actions and credit context — no external LLM required."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <CCard>
          <h2 className="mb-3 text-[14px] font-semibold text-[var(--c-ink)]">
            Next best actions
          </h2>
          {nba.actions.length === 0 ? (
            <CEmpty
              title="Queue clear"
              body="No overdue tasks, stuck deals, committee items, or KYC expiries in your scope."
              actionLabel="Tasks"
              actionHref="/console/tasks"
            />
          ) : (
            <ul className="divide-y divide-[var(--c-line)]">
              {nba.actions.map((a) => (
                <li key={`${a.kind}-${a.href}-${a.occurredAt}`} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={toConsoleHref(a.href)}
                        className="text-[13px] font-semibold text-[var(--c-accent)] hover:underline"
                      >
                        {a.title}
                      </Link>
                      <p className="mt-0.5 text-[12px] text-[var(--c-ink-2)]">
                        {a.description}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--c-ink-3)]">
                        {NEXT_ACTION_KIND_LABEL[a.kind]} · {a.relative}
                      </p>
                    </div>
                    <CBadge
                      tone={
                        a.priority === "critical"
                          ? "bad"
                          : a.priority === "warning"
                            ? "warn"
                            : a.priority === "positive"
                              ? "ok"
                              : "info"
                      }
                    >
                      {a.priority}
                    </CBadge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CCard>

        <CCard>
          <h2 className="mb-3 text-[14px] font-semibold text-[var(--c-ink)]">
            Credit context
          </h2>
          <p className="mb-3 text-[12px] text-[var(--c-ink-2)]">
            Open an analysis for a structured scorecard memo (deterministic
            generator).
          </p>
          {credit.rows.length === 0 ? (
            <p className="text-[13px] text-[var(--c-ink-3)]">
              No credit analyses in scope.{" "}
              <Link className="text-[var(--c-accent)]" href="/console/credit">
                Credit module
              </Link>
            </p>
          ) : (
            <ul className="space-y-2">
              {credit.rows.map((r) => (
                <li key={r.creditAnalysisId}>
                  <Link
                    href={`/console/credit/${r.creditAnalysisId}`}
                    className="flex items-center justify-between gap-2 rounded-[var(--c-radius)] px-2 py-2 ring-1 ring-[var(--c-line)] hover:bg-[var(--c-surface-2)]"
                  >
                    <span className="truncate text-[13px] font-medium">
                      {r.legalName}
                    </span>
                    {r.internalRatingShort ? (
                      <CBadge tone="accent">{r.internalRatingShort}</CBadge>
                    ) : (
                      <CBadge tone="neutral">{r.analysisType ?? "analysis"}</CBadge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-3 text-[13px]">
            <Link className="text-[var(--c-accent)]" href="/console/parties">
              Party book
            </Link>
            <Link className="text-[var(--c-accent)]" href="/console/interactions">
              Interactions
            </Link>
            <Link className="text-[var(--c-accent)]" href="/console/credit">
              All credit
            </Link>
          </div>
        </CCard>
      </div>
    </div>
  );
}
