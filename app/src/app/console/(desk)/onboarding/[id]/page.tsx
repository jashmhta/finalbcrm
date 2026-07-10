import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCircle,
  Circle,
  WarningCircle,
} from "@phosphor-icons/react/ssr";

import { requireUser } from "@/lib/rbac";
import { getOnboardingDetail } from "@/features/onboarding/queries";
import {
  ONBOARDING_STAGE_FULL_LABELS,
  ONBOARDING_STAGE_ORDER,
  type OnboardingStage,
} from "@/features/onboarding/types";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { ContactActions } from "@/console/primitives/contact-actions";
import { OnboardingActions } from "./actions-ui";

export const dynamic = "force-dynamic";

const DOC_LABELS: Record<string, string> = {
  incorporation_certificate: "Certificate of incorporation",
  pan_card: "PAN card",
  board_resolution: "Board resolution",
  authorised_signatory_kyc: "Authorised signatory KYC",
  financial_statements: "Financial statements",
  beneficial_ownership_declaration: "Beneficial ownership",
  consent_form: "Consent form (DPDP)",
};

export default async function ConsoleOnboardingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const detail = await getOnboardingDetail(id, user);
  if (!detail) notFound();

  const docs = detail.onboarding.documents ?? [];
  const stage = detail.onboarding.stage as OnboardingStage;
  const stageIdx = ONBOARDING_STAGE_ORDER.indexOf(stage);
  const verified = docs.filter((d) => d.verification === "verified").length;
  const uploaded = docs.filter((d) => d.status === "uploaded").length;

  return (
    <div>
      <CPageHeader
        eyebrow="Onboarding"
        title={detail.legalName}
        description={`Stage: ${ONBOARDING_STAGE_FULL_LABELS[stage] ?? stage.replace(/_/g, " ")}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ContactActions
              phone={detail.onboarding.contactPhone}
              email={detail.onboarding.contactEmail}
              partyName={detail.legalName}
              showEmpty
            />
            <Link
              href={`/console/parties/${id}`}
              className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] px-4 text-[13px] ring-1 ring-[var(--c-line-strong)]"
            >
              Party 360
            </Link>
            <Link
              href="/console/onboarding"
              className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] px-4 text-[13px] ring-1 ring-[var(--c-line-strong)]"
            >
              Board
            </Link>
          </div>
        }
      />

      {/* Stage stepper */}
      <CCard className="mb-4 overflow-x-auto p-3 md:p-4">
        <ol className="flex min-w-[640px] items-center gap-0">
          {ONBOARDING_STAGE_ORDER.map((s, i) => {
            const done = stageIdx > i || stage === "active";
            const current = s === stage;
            return (
              <li key={s} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1 px-1 text-center">
                  <span
                    className={
                      current
                        ? "flex size-8 items-center justify-center rounded-full bg-[var(--c-accent)] text-[12px] font-bold text-[var(--c-on-accent)]"
                        : done
                          ? "flex size-8 items-center justify-center rounded-full bg-[var(--c-ok)]/15 text-[var(--c-ok)] ring-1 ring-[var(--c-ok)]/40"
                          : "flex size-8 items-center justify-center rounded-full bg-[var(--c-surface-2)] text-[12px] text-[var(--c-ink-3)] ring-1 ring-[var(--c-line)]"
                    }
                  >
                    {done && !current ? (
                      <CheckCircle size={18} weight="fill" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span
                    className={
                      current
                        ? "text-[10px] font-semibold text-[var(--c-accent)]"
                        : "text-[10px] text-[var(--c-ink-3)]"
                    }
                  >
                    {ONBOARDING_STAGE_FULL_LABELS[s].split(" ")[0]}
                  </span>
                </div>
                {i < ONBOARDING_STAGE_ORDER.length - 1 ? (
                  <div
                    className={
                      stageIdx > i
                        ? "mx-0.5 h-0.5 flex-1 bg-[var(--c-ok)]/50"
                        : "mx-0.5 h-0.5 flex-1 bg-[var(--c-line)]"
                    }
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </CCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <CCard className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <CBadge tone="accent">
                {ONBOARDING_STAGE_FULL_LABELS[stage] ?? stage}
              </CBadge>
              <CBadge
                tone={
                  detail.sla.status === "overdue"
                    ? "bad"
                    : detail.sla.status === "due_soon"
                      ? "warn"
                      : detail.sla.status === "on_track"
                        ? "ok"
                        : "neutral"
                }
              >
                SLA {detail.sla.status.replace(/_/g, " ")}
              </CBadge>
              {detail.kyc ? (
                <CBadge tone="info">KYC {detail.kyc.status}</CBadge>
              ) : (
                <CBadge tone="warn">No KYC linked</CBadge>
              )}
              <CBadge tone="neutral">
                Docs {verified}/{docs.length || 7} verified
              </CBadge>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-[11px] text-[var(--c-ink-3)]">
                <span>Checklist progress</span>
                <span>
                  {uploaded} uploaded · {verified} verified
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--c-surface-2)]">
                <div
                  className="h-full rounded-full bg-[var(--c-accent)]"
                  style={{
                    width: `${docs.length ? Math.round((verified / docs.length) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>

            <h2 className="text-[13px] font-semibold">Document checklist</h2>
            <ul className="divide-y divide-[var(--c-line)] text-[13px]">
              {docs.length === 0 ? (
                <li className="py-3 text-[var(--c-ink-3)]">
                  Checklist will appear once the case is initiated.
                </li>
              ) : (
                docs.map((d) => {
                  const ok = d.verification === "verified";
                  const up = d.status === "uploaded";
                  const bad = d.verification === "rejected";
                  return (
                    <li
                      key={d.key}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <span className="flex items-center gap-2">
                        {ok ? (
                          <CheckCircle
                            size={18}
                            weight="fill"
                            className="shrink-0 text-[var(--c-ok)]"
                          />
                        ) : bad ? (
                          <WarningCircle
                            size={18}
                            weight="fill"
                            className="shrink-0 text-[var(--c-bad)]"
                          />
                        ) : (
                          <Circle
                            size={18}
                            className="shrink-0 text-[var(--c-ink-3)]"
                          />
                        )}
                        <span>
                          {DOC_LABELS[d.key] ?? d.key.replace(/_/g, " ")}
                        </span>
                      </span>
                      <CBadge
                        tone={
                          ok ? "ok" : bad ? "bad" : up ? "warn" : "neutral"
                        }
                      >
                        {ok
                          ? "Verified"
                          : bad
                            ? "Rejected"
                            : up
                              ? "Uploaded"
                              : "Pending"}
                      </CBadge>
                    </li>
                  );
                })
              )}
            </ul>
          </CCard>

          {/* Signatory + identifiers */}
          <CCard>
            <h2 className="mb-3 text-[13px] font-semibold">
              Authorised signatory & identity
            </h2>
            <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
              <Field
                label="Signatory"
                value={
                  detail.onboarding.contactName
                    ? `${detail.onboarding.contactName}${detail.onboarding.contactTitle ? ` · ${detail.onboarding.contactTitle}` : ""}`
                    : "—"
                }
              />
              <Field
                label="Client type"
                value={
                  detail.onboarding.clientType?.replace(/_/g, " ") ?? "—"
                }
              />
              <Field label="PAN" value={detail.onboarding.pan ?? "—"} mono />
              <Field label="CIN" value={detail.onboarding.cin ?? "—"} mono />
              <Field
                label="GSTIN"
                value={detail.onboarding.gstin ?? "—"}
                mono
              />
              <Field
                label="Location"
                value={
                  [detail.onboarding.city, detail.onboarding.state]
                    .filter(Boolean)
                    .join(", ") || "—"
                }
              />
            </dl>
            <div className="mt-4">
              <ContactActions
                phone={detail.onboarding.contactPhone}
                email={detail.onboarding.contactEmail}
                partyName={detail.legalName}
                showEmpty
              />
            </div>
          </CCard>
        </div>

        <div className="space-y-4">
          <CCard>
            <h2 className="mb-3 text-[13px] font-semibold">Advance stage</h2>
            <p className="mb-3 text-[12px] leading-relaxed text-[var(--c-ink-3)]">
              Gates enforce document verification and KYC approval before
              compliance sign-off. Activation flips the party to live.
            </p>
            <OnboardingActions
              partyId={detail.partyId}
              stage={detail.onboarding.stage}
            />
          </CCard>

          {detail.sla ? (
            <CCard>
              <h2 className="mb-2 text-[13px] font-semibold">SLA clock</h2>
              <p className="text-[12px] text-[var(--c-ink-2)]">
                Status:{" "}
                <strong className="text-[var(--c-ink)]">
                  {detail.sla.status.replace(/_/g, " ")}
                </strong>
              </p>
              {detail.sla.targetDays > 0 ? (
                <p className="mt-1 text-[12px] text-[var(--c-ink-3)]">
                  {detail.sla.daysRemaining >= 0
                    ? `${detail.sla.daysRemaining} days remaining`
                    : `${Math.abs(detail.sla.daysRemaining)} days overdue`}{" "}
                  · target {detail.sla.targetDays}d
                </p>
              ) : null}
            </CCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] text-[var(--c-ink-3)]">{label}</dt>
      <dd
        className={
          mono
            ? "mt-0.5 font-mono text-[12px] font-medium text-[var(--c-ink)]"
            : "mt-0.5 font-medium text-[var(--c-ink)]"
        }
      >
        {value}
      </dd>
    </div>
  );
}
