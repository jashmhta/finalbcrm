import Link from "next/link";

import { requireUser, can } from "@/lib/rbac";
import { getOnboardingPipeline } from "@/features/onboarding/queries";
import {
  ONBOARDING_STAGE_HINTS,
  ONBOARDING_STAGE_LABELS,
  type OnboardingStage,
} from "@/features/onboarding/types";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";

export const dynamic = "force-dynamic";
export const metadata = { title: "Onboarding" };

const STAGE_ORDER: OnboardingStage[] = [
  "initiated",
  "profile_created",
  "documents_collected",
  "kyc_verified",
  "compliance_approved",
  "active",
];

function stageProgress(stage: string): number {
  const i = STAGE_ORDER.indexOf(stage as OnboardingStage);
  if (i < 0) return 0;
  return Math.round(((i + 1) / STAGE_ORDER.length) * 100);
}

function docsProgress(docs: { status?: string; verification?: string }[] | undefined) {
  if (!docs?.length) return { done: 0, total: 0, pct: 0 };
  const total = docs.length;
  const done = docs.filter(
    (d) => d.verification === "verified" || d.status === "uploaded",
  ).length;
  return { done, total, pct: Math.round((done / total) * 100) };
}

export default async function ConsoleOnboardingPage() {
  const user = await requireUser();
  const allowed =
    can(user, "read", "onboarding") ||
    can(user, "read", "party") ||
    can(user, "read", "kyc");
  if (!allowed) {
    return (
      <CEmpty
        title="No onboarding access"
        body="You need onboarding or party read access."
        actionLabel="Home"
        actionHref="/console"
      />
    );
  }

  const groups = await getOnboardingPipeline(user);
  const total = groups.reduce((n, g) => n + g.cases.length, 0);
  const overdue = groups.reduce(
    (n, g) => n + g.cases.filter((c) => c.sla.status === "overdue").length,
    0,
  );
  const dueSoon = groups.reduce(
    (n, g) => n + g.cases.filter((c) => c.sla.status === "due_soon").length,
    0,
  );
  const activeStage = groups.find((g) => g.stage === "active")?.cases.length ?? 0;

  return (
    <div>
      <CPageHeader
        eyebrow="Client activation"
        title="Onboarding"
        description="SEBI/PMLA checklist → KYC → compliance → live client."
        actions={
          can(user, "create", "party") ? (
            <Link
              href="/console/parties?new=1"
              className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] bg-[var(--c-accent)] px-4 text-[13px] font-medium text-[var(--c-on-accent)]"
            >
              Start from party
            </Link>
          ) : null
        }
      />

      {total === 0 ? (
        <CEmpty
          title="No onboarding cases"
          body="Cases appear when a prospect starts the activation funnel. Create a party or open an existing counterparty to begin."
          actionLabel="Client book"
          actionHref="/console/parties"
        />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Open cases" value={String(total)} />
            <Kpi label="Overdue SLA" value={String(overdue)} tone={overdue ? "bad" : "ok"} />
            <Kpi label="Due soon" value={String(dueSoon)} tone={dueSoon ? "warn" : "ok"} />
            <Kpi label="Activated" value={String(activeStage)} tone="ok" />
          </div>

          {/* Funnel overview strip */}
          <div className="mb-5 flex gap-1 overflow-x-auto pb-1">
            {groups.map((g, idx) => {
              const pct = total ? Math.round((g.cases.length / total) * 100) : 0;
              return (
                <div
                  key={g.stage}
                  className="min-w-[100px] flex-1 rounded-[var(--c-radius)] bg-[var(--c-surface)] px-3 py-2 ring-1 ring-[var(--c-line)]"
                >
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--c-ink-3)]">
                    {idx + 1}.{" "}
                    {ONBOARDING_STAGE_LABELS[g.stage as OnboardingStage] ??
                      g.stage.replace(/_/g, " ")}
                  </p>
                  <p className="text-[18px] font-semibold tabular-nums text-[var(--c-ink)]">
                    {g.cases.length}
                  </p>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--c-surface-2)]">
                    <div
                      className="h-full rounded-full bg-[var(--c-accent)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 overflow-x-auto pb-4">
            {groups.map((g) => (
              <section
                key={g.stage}
                className="w-[280px] shrink-0 rounded-[var(--c-radius-lg)] bg-[var(--c-surface-2)]/60 p-2 ring-1 ring-[var(--c-line)]"
              >
                <header className="mb-2 space-y-1 px-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[12px] font-semibold capitalize text-[var(--c-ink)]">
                      {ONBOARDING_STAGE_LABELS[g.stage as OnboardingStage] ??
                        g.stage.replace(/_/g, " ")}
                    </h2>
                    <CBadge tone="neutral">{g.cases.length}</CBadge>
                  </div>
                  <p className="text-[10px] leading-snug text-[var(--c-ink-3)]">
                    {ONBOARDING_STAGE_HINTS[g.stage as OnboardingStage] ?? ""}
                  </p>
                </header>
                <ul className="flex max-h-[68vh] flex-col gap-2 overflow-y-auto">
                  {g.cases.length === 0 ? (
                    <li className="rounded-[var(--c-radius)] border border-dashed border-[var(--c-line)] px-3 py-6 text-center text-[11px] text-[var(--c-ink-3)]">
                      Empty stage
                    </li>
                  ) : (
                    g.cases.map((c) => {
                      const prog = stageProgress(c.onboarding.stage);
                      const docs = docsProgress(c.onboarding.documents);
                      return (
                        <li key={c.partyId}>
                          <Link href={`/console/onboarding/${c.partyId}`}>
                            <CCard className="p-3 shadow-none transition-colors hover:bg-[var(--c-surface)]">
                              <p className="line-clamp-2 text-[13px] font-semibold text-[var(--c-ink)]">
                                {c.legalName}
                              </p>
                              <p className="mt-1 text-[11px] text-[var(--c-ink-3)]">
                                {c.onboarding.clientType?.replace(/_/g, " ") ??
                                  "client"}
                                {c.kyc?.status ? ` · KYC ${c.kyc.status}` : ""}
                              </p>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--c-surface-2)]">
                                <div
                                  className="h-full rounded-full bg-[var(--c-accent)] transition-all"
                                  style={{ width: `${prog}%` }}
                                />
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <CBadge
                                  tone={
                                    c.sla.status === "overdue"
                                      ? "bad"
                                      : c.sla.status === "due_soon"
                                        ? "warn"
                                        : c.sla.status === "on_track"
                                          ? "ok"
                                          : "neutral"
                                  }
                                >
                                  SLA {c.sla.status.replace(/_/g, " ")}
                                </CBadge>
                                {docs.total > 0 ? (
                                  <CBadge tone="info">
                                    Docs {docs.done}/{docs.total}
                                  </CBadge>
                                ) : null}
                              </div>
                            </CCard>
                          </Link>
                        </li>
                      );
                    })
                  )}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "bad" | "neutral";
}) {
  const color =
    tone === "bad"
      ? "text-[var(--c-bad)]"
      : tone === "warn"
        ? "text-[var(--c-warn)]"
        : tone === "ok"
          ? "text-[var(--c-ok)]"
          : "text-[var(--c-ink)]";
  return (
    <CCard className="p-3 md:p-4">
      <p className="text-[11px] font-medium text-[var(--c-ink-3)]">{label}</p>
      <p className={`mt-1 text-[22px] font-semibold tabular-nums ${color}`}>
        {value}
      </p>
    </CCard>
  );
}
