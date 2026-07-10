"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import {
  ArrowRight,
  CaretRight,
  ChatCircle,
  Check,
  CheckCircle,
  Clock,
  IdentificationCard,
  ListChecks,
  ShieldCheck,
  ShieldWarning,
  SealCheck,
  Scales,
  TrendUp,
  UploadSimple,
  User,
  XCircle,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Eyebrow,
} from "@/components/brand";
import { SectionHeading } from "@/components/brand/text";
import {
  OnboardingDocIcon,
  OnboardingStageIcon,
} from "@/features/onboarding/onboarding-icons";
import {
  ONBOARDING_DOC_HINTS,
  ONBOARDING_DOC_LABELS,
  ONBOARDING_STAGE_FULL_LABELS,
  ONBOARDING_STAGE_LABELS,
  ONBOARDING_STAGE_ORDER,
  ONBOARDING_STAGE_SLA_DAYS,
  ONBOARDING_STAGE_SLA_LABEL,
  ONBOARDING_STAGE_TONE,
  allDocsVerified,
  docsUploaded,
  docsVerified,
  onboardingProgress,
  type OnboardingDocItem,
  type OnboardingDocKey,
  type OnboardingStage,
} from "@/features/onboarding/types";
import type {
  OnboardingDetail,
  RmOption,
} from "@/features/onboarding/queries";
import {
  advanceStage,
  approveCompliance,
  activateClient,
  markDocumentUploaded,
  rejectCompliance,
  rejectDocument,
  startKyc,
  updateAssignedRm,
  verifyDocument,
  type AdvanceStageState,
  type ActivateState,
  type ComplianceState,
  type DocUploadState,
  type DocVerifyState,
  type FieldState,
  type StartKycState,
} from "@/features/onboarding/actions";

/* ------------------------------------------------------------------ *
 * OnboardingDetailView - the case workspace.
 *
 * The 6-stage stepper + progress bar up top, then the stage action area
 * (advance / approve / activate), the 7-document checklist with upload +
 * verify + reject, the KYC link, the compliance sign-off, the SLA timeline,
 * and the RM assignment. All mutations post to server actions via small
 * per-action <form> wrappers (useActionState), revalidating the page.
 *
 * CRITICAL: primary content renders VISIBLE on mount - the stepper, the
 * checklist and the SLA timeline render without a whileInView opacity-0 gate.
 * Motion is reserved for the progress-bar fill + hover micro-interactions.
 * ------------------------------------------------------------------ */

export interface OnboardingDetailViewProps {
  detail: OnboardingDetail;
  rms: RmOption[];
}

export function OnboardingDetailView({
  detail,
  rms,
}: OnboardingDetailViewProps) {
  const m = detail.onboarding;
  const progress = onboardingProgress(m.stage, m.documents);
  const nextStage = nextStageOf(m.stage);

  return (
    <div className="flex flex-col gap-6">
      {/* Stepper + progress */}
      <Card>
        <CardBody className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <SectionHeading
              eyebrow="Onboarding funnel"
              title="Stage"
              titleClassName="text-[15px]"
            />
            <div className="flex items-center gap-2">
              <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
                {progress}%
              </span>
              <Badge variant={ONBOARDING_STAGE_TONE[m.stage]} dot={ONBOARDING_STAGE_TONE[m.stage] === "emerald"}>
                {ONBOARDING_STAGE_LABELS[m.stage]}
              </Badge>
            </div>
          </div>
          <ProgressBar value={progress} />
          <StageStepper current={m.stage} stageHistory={m.stageHistory} />
        </CardBody>
      </Card>

      {/* Stage action area */}
      <StageActionArea detail={detail} nextStage={nextStage} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left rail - document checklist + KYC + compliance */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <DocChecklist detail={detail} />
          <KycSection detail={detail} />
          <ComplianceSection detail={detail} />
        </div>

        {/* Right rail - SLA timeline + RM + contacts */}
        <div className="flex flex-col gap-6">
          <SlaTimeline detail={detail} />
          <RmAssignCard detail={detail} rms={rms} />
          <ContactsCard detail={detail} />
        </div>
      </div>

      {/* Interactions + tasks */}
      <div className="grid gap-6 md:grid-cols-2">
        <InteractionsCard detail={detail} />
        <TasksCard detail={detail} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * ProgressBar - the overall funnel progress.
 * ------------------------------------------------------------------ */
function ProgressBar({ value }: { value: number }) {
  const pct =
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(0, Math.min(100, Math.round(value)))
      : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Onboarding funnel progress"
      className="h-2 w-full overflow-hidden rounded-full bg-foreground/[0.08]"
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald to-gold transition-[width] duration-700 ease-soft"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * StageStepper - the 6-stage visual.
 * ------------------------------------------------------------------ */
function StageStepper({
  current,
  stageHistory,
}: {
  current: OnboardingStage;
  stageHistory: { stage: OnboardingStage; enteredAt: string }[];
}) {
  const currentIdx = ONBOARDING_STAGE_ORDER.indexOf(current);
  const enteredSet = new Set(stageHistory.map((h) => h.stage));
  return (
    <div className="flex w-full items-start justify-between gap-1 overflow-x-auto pb-1">
      {ONBOARDING_STAGE_ORDER.map((s, i) => {
        const status =
          i < currentIdx || (i === currentIdx && current !== "initiated" ? false : i === currentIdx)
            ? i < currentIdx
              ? "done"
              : "active"
            : enteredSet.has(s) && i <= currentIdx
              ? i === currentIdx
                ? "active"
                : "done"
              : "todo";
        return (
          <div
            key={s}
            className="flex min-w-[88px] flex-1 flex-col items-center gap-2 text-center"
          >
            <div className="flex w-full items-center">
              {i > 0 ? (
                <div
                  className={cn(
                    "h-px flex-1",
                    status === "done" || status === "active" ? "bg-emerald/50" : "bg-hairline",
                  )}
                />
              ) : (
                <div className="h-px flex-1" />
              )}
              <span
                className={cn(
                  "relative z-10 inline-flex size-9 shrink-0 items-center justify-center rounded-full ring-1 transition-all duration-300 ease-soft",
                  status === "done" && "bg-emerald text-on-emerald ring-emerald",
                  status === "active" &&
                    "bg-surface text-emerald ring-emerald/50 shadow-[0_0_0_4px] shadow-emerald/15",
                  status === "todo" && "bg-surface text-muted-foreground/60 ring-hairline",
                )}
              >
                {status === "done" ? (
                  <Check weight="bold" className="size-4" />
                ) : (
                  <OnboardingStageIcon stage={s} />
                )}
              </span>
              {i < ONBOARDING_STAGE_ORDER.length - 1 ? (
                <div
                  className={cn(
                    "h-px flex-1",
                    status === "done" ? "bg-emerald/50" : "bg-hairline",
                  )}
                />
              ) : (
                <div className="h-px flex-1" />
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span
                className={cn(
                  "text-[10.5px] font-medium uppercase tracking-[0.1em]",
                  status === "todo" ? "text-muted-foreground/60" : "text-foreground",
                )}
              >
                {ONBOARDING_STAGE_LABELS[s]}
              </span>
              <span className="font-mono text-[9.5px] tabular-nums text-muted-foreground/60">
                {ONBOARDING_STAGE_SLA_LABEL[s]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * StageActionArea - the primary CTA for the current stage.
 * ------------------------------------------------------------------ */
function StageActionArea({
  detail,
  nextStage,
}: {
  detail: OnboardingDetail;
  nextStage: OnboardingStage | null;
}) {
  const m = detail.onboarding;

  // Terminal - nothing to do.
  if (m.stage === "active") {
    return (
      <Card>
        <CardBody className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle weight="light" className="size-5 text-emerald" />
            <Eyebrow dot>Onboarded</Eyebrow>
          </div>
          <p className="text-[clamp(1.25rem,1rem+0.6vw,1.5rem)] font-light leading-tight tracking-[-0.01em] text-foreground">
            {detail.legalName} is an active client.
          </p>
          <p className="text-[13px] text-muted-foreground">
            Activated {fmtDate(m.complianceApprovedAt ?? m.updatedAt)} · the party
            is live across the CRM.
          </p>
        </CardBody>
      </Card>
    );
  }

  // kyc_verified - compliance sign-off (handled in ComplianceSection below, but
  // surface a pointer here).
  if (m.stage === "kyc_verified") {
    return (
      <Card>
        <CardBody className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Scales weight="light" className="size-5 text-gold" />
            <Eyebrow dot>Awaiting compliance</Eyebrow>
          </div>
          <p className="text-[14px] text-foreground">
            KYC is approved. The compliance officer reviews and signs off below to
            clear the case for activation.
          </p>
          {m.complianceRejectedAt ? (
            <div className="flex items-start gap-2 rounded-xl bg-down/[0.06] p-3 ring-1 ring-down/25">
              <XCircle weight="light" className="mt-0.5 size-4 shrink-0 text-down" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[12.5px] font-medium text-down">
                  Compliance rejected · {fmtDate(m.complianceRejectedAt)}
                </span>
                <span className="text-[12px] text-muted-foreground">
                  {m.complianceNote ?? "Re-submit after addressing the note."}
                </span>
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>
    );
  }

  // compliance_approved - activate.
  if (m.stage === "compliance_approved") {
    return (
      <Card>
        <CardBody className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <SealCheck weight="light" className="size-5 text-emerald" />
            <Eyebrow dot>Compliance cleared</Eyebrow>
          </div>
          <p className="text-[14px] text-foreground">
            Compliance has approved the case. Activate the client to flip the
            party to active and complete onboarding.
          </p>
          <ActivateButton partyId={detail.partyId} />
        </CardBody>
      </Card>
    );
  }

  // documents_collected - the gated advance to KYC. Show the gate state.
  if (m.stage === "documents_collected" && nextStage) {
    const docsOk = allDocsVerified(m.documents);
    const kycOk = detail.kyc?.status === "approved";
    const gateMet = docsOk && kycOk;
    return (
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck weight="light" className="size-5 text-gold" />
            <Eyebrow dot>Gate · advance to KYC</Eyebrow>
          </div>
          <p className="text-[14px] text-foreground">
            All seven documents must be verified and the linked KYC record
            approved before the case can advance.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <GateIndicator
              label="Documents verified"
              met={docsOk}
              detail={`${docsVerified(m.documents)}/${m.documents.length} verified`}
            />
            <GateIndicator
              label="KYC approved"
              met={kycOk}
              detail={
                detail.kyc
                  ? `KYC · ${detail.kyc.status ?? "-"}`
                  : "No KYC record linked"
              }
            />
          </div>
          {gateMet ? (
            <AdvanceStageButton partyId={detail.partyId} to={nextStage} />
          ) : (
            !detail.kyc ? (
              <StartKycButton partyId={detail.partyId} />
            ) : detail.kyc.status !== "approved" ? (
              <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                <ShieldWarning weight="light" className="size-4 text-gold" />
                Approve the KYC record in the Compliance module to clear the gate.
              </div>
            ) : null
          )}
        </CardBody>
      </Card>
    );
  }

  // initiated / profile_created - straightforward advance.
  if (nextStage) {
    return (
      <Card>
        <CardBody className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <TrendUp weight="light" className="size-5 text-emerald" />
            <Eyebrow dot>Next stage</Eyebrow>
          </div>
          <p className="text-[14px] text-foreground">
            Advance to{" "}
            <span className="font-medium">{ONBOARDING_STAGE_FULL_LABELS[nextStage]}</span>.
          </p>
          <AdvanceStageButton partyId={detail.partyId} to={nextStage} />
        </CardBody>
      </Card>
    );
  }

  return null;
}

function GateIndicator({
  label,
  met,
  detail,
}: {
  label: string;
  met: boolean;
  detail: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl p-3 ring-1",
        met ? "bg-emerald/[0.06] ring-emerald/25" : "bg-foreground/[0.02] ring-hairline/60",
      )}
    >
      <span
        className={cn(
          "inline-flex size-6 shrink-0 items-center justify-center rounded-full",
          met ? "bg-emerald/20 text-emerald" : "bg-foreground/[0.05] text-muted-foreground/60",
        )}
      >
        {met ? <Check weight="bold" className="size-3.5" /> : <Clock weight="light" className="size-3.5" />}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={cn("text-[12.5px] font-medium", met ? "text-emerald-deep" : "text-foreground/80")}>
          {label}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">{detail}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * DocChecklist - the 7 documents with upload + verify + reject.
 * ------------------------------------------------------------------ */
function DocChecklist({ detail }: { detail: OnboardingDetail }) {
  const m = detail.onboarding;
  const uploaded = docsUploaded(m.documents);
  const verified = docsVerified(m.documents);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <Eyebrow dot>Document checklist</Eyebrow>
            <CardTitle className="mt-1">Seven documents</CardTitle>
            <CardDescription>
              Incorporation, PAN, board resolution, signatory KYC, financials, BO
              declaration, consent - each tracked uploaded + verified.
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2 font-mono text-[11px] tabular-nums text-muted-foreground">
            <span className="text-foreground/80">{verified}</span>
            <span className="text-muted-foreground/40">/</span>
            <span>{m.documents.length}</span>
            <span className="text-muted-foreground/60">verified</span>
          </div>
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-2.5">
        {m.documents.map((d) => (
          <DocRow key={d.key} partyId={detail.partyId} doc={d} />
        ))}
        <div className="mt-1 flex items-center justify-between border-t border-hairline pt-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <UploadSimple weight="light" className="size-3" />
            {uploaded} uploaded
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle weight="light" className="size-3" />
            {verified} verified
          </span>
        </div>
      </CardBody>
    </Card>
  );
}

function DocRow({ partyId, doc }: { partyId: string; doc: OnboardingDocItem }) {
  const key = doc.key as OnboardingDocKey;
  const isVerified = doc.verification === "verified";
  const isRejected = doc.verification === "rejected";
  const isUploaded = doc.status === "uploaded";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl p-3.5 ring-1 transition-colors duration-200 ease-soft sm:flex-row sm:items-center sm:justify-between",
        isVerified
          ? "bg-emerald/[0.04] ring-emerald/20"
          : isRejected
            ? "bg-down/[0.04] ring-down/20"
            : isUploaded
              ? "bg-foreground/[0.02] ring-hairline/60"
              : "bg-foreground/[0.01] ring-hairline/40",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 text-muted-foreground/70 [&_svg]:size-5">
          <OnboardingDocIcon docKey={key} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-medium text-foreground">
              {ONBOARDING_DOC_LABELS[key]}
            </span>
            {isVerified ? (
              <Badge variant="emerald" dot>Verified</Badge>
            ) : isRejected ? (
              <Badge variant="down">Rejected</Badge>
            ) : isUploaded ? (
              <Badge variant="info">Pending verification</Badge>
            ) : (
              <Badge variant="outline">Not uploaded</Badge>
            )}
          </div>
          <span className="text-[11.5px] leading-relaxed text-muted-foreground/80">
            {ONBOARDING_DOC_HINTS[key]}
          </span>
          {isRejected && doc.rejectionReason ? (
            <span className="mt-0.5 text-[11.5px] text-down">{doc.rejectionReason}</span>
          ) : null}
          {doc.verifiedAt ? (
            <span className="mt-0.5 font-mono text-[10.5px] tabular-nums text-muted-foreground/60">
              verified {fmtDate(doc.verifiedAt)}
            </span>
          ) : null}
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {!isUploaded ? (
          <UploadDocButton partyId={partyId} docKey={key} />
        ) : !isVerified && !isRejected ? (
          <>
            <VerifyDocButton partyId={partyId} docKey={key} />
            <RejectDocButton partyId={partyId} docKey={key} />
          </>
        ) : isRejected ? (
          <UploadDocButton partyId={partyId} docKey={key} label="Re-upload" />
        ) : (
          <span className="inline-flex items-center gap-1 text-[11.5px] text-emerald">
            <CheckCircle weight="light" className="size-3.5" />
            Done
          </span>
        )}
        {doc.documentId ? (
          <Link
            href={`/documents?party=${partyId}`}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <IdentificationCard weight="light" className="size-3" />
            file
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * KycSection - the linked KYC record + raise action.
 * ------------------------------------------------------------------ */
function KycSection({ detail }: { detail: OnboardingDetail }) {
  const m = detail.onboarding;
  const kyc = detail.kyc;
  return (
    <Card>
      <CardHeader>
        <Eyebrow dot>PMLA · CDD / EDD</Eyebrow>
        <CardTitle className="mt-1">KYC verification</CardTitle>
        <CardDescription>
          KYC must be approved before the case can advance past documents.
        </CardDescription>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        {kyc ? (
          <div className="flex flex-col gap-3 rounded-xl bg-foreground/[0.02] p-4 ring-1 ring-hairline/60">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck weight="light" className="size-5 text-emerald" />
                <span className="text-[13.5px] font-medium text-foreground">
                  KYC record linked
                </span>
              </div>
              <Badge
                variant={
                  kyc.status === "approved"
                    ? "emerald"
                    : kyc.status === "rejected"
                      ? "down"
                      : kyc.status === "under_eds_check"
                        ? "gold"
                        : "info"
                }
                dot={kyc.status === "approved"}
              >
                {kyc.status ?? "-"}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] sm:grid-cols-3">
              <Kv label="Type" value={kyc.kycType ?? "-"} />
              <Kv label="Risk" value={kyc.riskRating ?? "-"} />
              <Kv label="Valid until" value={fmtDate(kyc.validUntil)} />
            </div>
            <Button
              asChild
              variant="secondary-hairline"
              size="sm"
              trailingIcon={<ArrowRight weight="light" className="size-4" />}
              className="w-full sm:w-auto"
            >
              <Link href={`/compliance/kyc/${kyc.kycRecordId}`}>
                Open KYC in Compliance
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl bg-foreground/[0.02] p-4 ring-1 ring-dashed ring-hairline/60">
            <div className="flex items-center gap-2">
              <ShieldWarning weight="light" className="size-5 text-gold" />
              <span className="text-[13.5px] font-medium text-foreground">
                No KYC record linked
              </span>
            </div>
            <p className="text-[12.5px] text-muted-foreground">
              Raise a CDD record to begin verification. The compliance officer
              approves it in the Compliance module.
            </p>
            <StartKycButton partyId={detail.partyId} />
          </div>
        )}
        {m.kycRecordId ? (
          <p className="font-mono text-[10.5px] tabular-nums text-muted-foreground/60">
            kyc_record · {m.kycRecordId.slice(0, 8)}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * ComplianceSection - the officer's sign-off (approve / reject).
 * ------------------------------------------------------------------ */
function ComplianceSection({ detail }: { detail: OnboardingDetail }) {
  const m = detail.onboarding;
  if (m.stage !== "kyc_verified") {
    // Show a static summary of the compliance state once past it.
    if (m.complianceApprovedAt) {
      return (
        <Card>
          <CardHeader>
            <Eyebrow dot>Compliance sign-off</Eyebrow>
            <CardTitle className="mt-1">Approved</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-emerald">
              <SealCheck weight="light" className="size-5" />
              <span className="text-[13.5px] font-medium">
                Approved {fmtDate(m.complianceApprovedAt)}
              </span>
            </div>
            {m.complianceNote ? (
              <p className="text-[12.5px] text-muted-foreground">{m.complianceNote}</p>
            ) : null}
          </CardBody>
        </Card>
      );
    }
    return null;
  }
  return (
    <Card>
      <CardHeader>
        <Eyebrow dot>Compliance sign-off</Eyebrow>
        <CardTitle className="mt-1">Approve or reject</CardTitle>
        <CardDescription>
          The compliance officer reviews identity, ownership and source of funds,
          then clears the case for activation.
        </CardDescription>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        {m.complianceRejectedAt ? (
          <div className="flex items-start gap-2 rounded-xl bg-down/[0.06] p-3 ring-1 ring-down/25">
            <XCircle weight="light" className="mt-0.5 size-4 shrink-0 text-down" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[12.5px] font-medium text-down">
                Prior rejection · {fmtDate(m.complianceRejectedAt)}
              </span>
              <span className="text-[12px] text-muted-foreground">
                {m.complianceNote ?? "-"}
              </span>
            </div>
          </div>
        ) : null}
        <ApproveComplianceButton partyId={detail.partyId} />
        <RejectComplianceButton partyId={detail.partyId} />
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * SlaTimeline - the per-stage SLA history.
 * ------------------------------------------------------------------ */
function SlaTimeline({ detail }: { detail: OnboardingDetail }) {
  const m = detail.onboarding;
  const history = m.stageHistory;
  return (
    <Card className="h-full">
      <CardHeader>
        <Eyebrow dot>SLA timeline</Eyebrow>
        <CardTitle className="mt-1">Stage clocks</CardTitle>
        <CardDescription>
          Each stage&rsquo;s target + entry date. Overdue stages flag red.
        </CardDescription>
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        {history.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No stage history yet.</p>
        ) : (
          history.map((h, i) => {
            const next = history[i + 1];
            const targetDays = ONBOARDING_STAGE_SLA_DAYS[h.stage] ?? 0;
            const enteredMs = new Date(h.enteredAt).getTime();
            // Duration in stage - only computable for a COMPLETED stage (one
            // with a successor). The current stage's SLA is read from the
            // server-computed detail.sla, so no Date.now() is needed in render
            // (purity: avoid impure calls during render).
            const durationDays = next
              ? Math.round((new Date(next.enteredAt).getTime() - enteredMs) / 86_400_000)
              : null;
            const isCurrent = !next;
            const overdue =
              isCurrent &&
              targetDays > 0 &&
              detail.sla.status === "overdue";
            const tone = ONBOARDING_STAGE_TONE[h.stage];
            return (
              <div key={`${h.stage}-${i}`} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "inline-flex size-7 items-center justify-center rounded-full ring-1",
                      isCurrent
                        ? "bg-surface text-emerald ring-emerald/50 shadow-[0_0_0_3px] shadow-emerald/15"
                        : "bg-emerald/10 text-emerald ring-emerald/30",
                    )}
                  >
                    <OnboardingStageIcon stage={h.stage} />
                  </span>
                  {i < history.length - 1 ? (
                    <span className="mt-1 h-full w-px flex-1 bg-hairline" />
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-foreground">
                      {ONBOARDING_STAGE_FULL_LABELS[h.stage]}
                    </span>
                    <Badge variant={tone}>{ONBOARDING_STAGE_SLA_LABEL[h.stage]}</Badge>
                  </div>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    entered {fmtDate(h.enteredAt)}
                  </span>
                  {isCurrent ? (
                    <span
                      className={cn(
                        "font-mono text-[11px] tabular-nums",
                        overdue ? "text-down" : detail.sla.status === "due_soon" ? "text-gold" : "text-muted-foreground",
                      )}
                    >
                      {overdue
                        ? `${Math.abs(detail.sla.daysRemaining)}d overdue`
                        : detail.sla.status === "none"
                          ? "complete"
                          : `${detail.sla.daysRemaining}d left`}
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
                      {durationDays != null ? `${durationDays}d in stage` : "-"}
                      {durationDays != null && targetDays > 0 && durationDays > targetDays ? (
                        <span className="text-down"> · {durationDays - targetDays}d over</span>
                      ) : null}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * RmAssignCard - assign / reassign the RM.
 * ------------------------------------------------------------------ */
function RmAssignCard({
  detail,
  rms,
}: {
  detail: OnboardingDetail;
  rms: RmOption[];
}) {
  return (
    <Card>
      <CardHeader>
        <Eyebrow dot>Assignment</Eyebrow>
        <CardTitle className="mt-1">Relationship manager</CardTitle>
      </CardHeader>
      <CardBody>
        <RmAssignForm detail={detail} rms={rms} />
      </CardBody>
    </Card>
  );
}

function RmAssignForm({ detail, rms }: { detail: OnboardingDetail; rms: RmOption[] }) {
  const [state, action, pending] = useActionState<FieldState, FormData>(
    updateAssignedRm,
    undefined,
  );
  const [rmId, setRmId] = React.useState(detail.onboarding.assignedRm ?? "");
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="partyId" value={detail.partyId} />
      <div className="relative inline-flex items-center">
        <select
          name="assignedRm"
          aria-label="Assigned Relationship Manager"
          value={rmId}
          onChange={(e) => setRmId(e.target.value)}
          className={cn(
            "h-10 w-full appearance-none rounded-xl bg-foreground/[0.03] px-3.5 pr-9 text-[13.5px] text-foreground",
            "ring-1 ring-hairline/70 transition-all duration-200 ease-soft",
            "focus:bg-foreground/[0.05] focus:ring-hairline focus:outline-none",
          )}
        >
          <option value="">Unassigned</option>
          {rms.map((r) => (
            <option key={r.userId} value={r.userId}>
              {r.name}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 text-muted-foreground [&_svg]:size-3">
          <CaretRight weight="light" className="rotate-90" />
        </span>
      </div>
      {state?.error ? (
        <p className="text-[12px] text-down">{state.error}</p>
      ) : null}
      <Button
        type="submit"
        variant="secondary-hairline"
        size="sm"
        disabled={pending}
        className="w-full"
      >
        {pending ? "Saving…" : "Save assignment"}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * ContactsCard / InteractionsCard / TasksCard - the relationship context.
 * ------------------------------------------------------------------ */
function ContactsCard({ detail }: { detail: OnboardingDetail }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <Eyebrow dot>Signatory + contacts</Eyebrow>
        <CardTitle className="mt-1">People</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-2.5">
        {detail.onboarding.contactName ? (
          <div className="flex flex-col gap-1 rounded-xl bg-foreground/[0.02] p-3 ring-1 ring-hairline/60">
            <div className="flex items-center gap-2">
              <User weight="light" className="size-4 text-muted-foreground/70" />
              <span className="text-[13px] font-medium text-foreground">
                {detail.onboarding.contactName}
              </span>
              <Badge variant="info">Signatory</Badge>
            </div>
            {detail.onboarding.contactEmail ? (
              <span className="text-[11.5px] text-muted-foreground">{detail.onboarding.contactEmail}</span>
            ) : null}
            {detail.onboarding.contactTitle ? (
              <span className="text-[11.5px] text-muted-foreground/80">{detail.onboarding.contactTitle}</span>
            ) : null}
          </div>
        ) : null}
        {detail.contacts.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">
            No party contacts linked yet.
          </p>
        ) : (
          detail.contacts.slice(0, 5).map((c) => (
            <div key={c.contactId} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[12.5px] text-foreground/90">{c.fullName}</span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {c.role?.replace(/_/g, " ") ?? "contact"}
                  {c.designation ? ` · ${c.designation}` : ""}
                </span>
              </div>
              {c.isPrimary ? <Badge variant="emerald" dot>Primary</Badge> : null}
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}

function InteractionsCard({ detail }: { detail: OnboardingDetail }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <Eyebrow dot>Touchpoints</Eyebrow>
            <CardTitle className="mt-1">Interactions</CardTitle>
          </div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowRight weight="light" className="size-4" />}
          >
            <Link href={`/interactions?party=${detail.partyId}`}>All</Link>
          </Button>
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-2.5">
        {detail.interactions.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">No interactions logged.</p>
        ) : (
          detail.interactions.slice(0, 6).map((i) => (
            <div key={i.interactionId} className="flex items-start gap-2.5">
              <span className="mt-0.5 text-muted-foreground/70 [&_svg]:size-4">
                <ChatCircle weight="light" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[12.5px] text-foreground/90">{i.subject}</span>
                <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                  {i.channel?.replace(/_/g, " ")} · {fmtDate(i.occurredAt)}
                </span>
              </div>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}

function TasksCard({ detail }: { detail: OnboardingDetail }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <Eyebrow dot>Follow-ups</Eyebrow>
            <CardTitle className="mt-1">Tasks</CardTitle>
          </div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowRight weight="light" className="size-4" />}
          >
            <Link href={`/tasks?party=${detail.partyId}`}>All</Link>
          </Button>
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-2.5">
        {detail.tasks.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">No tasks anchored to this party.</p>
        ) : (
          detail.tasks.slice(0, 6).map((t) => (
            <div key={t.taskId} className="flex items-start gap-2.5">
              <span className="mt-0.5 text-muted-foreground/70 [&_svg]:size-4">
                <ListChecks weight="light" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[12.5px] text-foreground/90">{t.title}</span>
                <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                  {t.status?.replace(/_/g, " ")}
                  {t.dueDate ? ` · due ${fmtDate(t.dueDate)}` : ""}
                </span>
              </div>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Action buttons - each a small client form with useActionState.
 * ------------------------------------------------------------------ */

function AdvanceStageButton({
  partyId,
  to,
}: {
  partyId: string;
  to: OnboardingStage;
}) {
  const [state, action, pending] = useActionState<AdvanceStageState, FormData>(
    advanceStage,
    undefined,
  );
  return (
    <form action={action} className="inline-flex">
      <input type="hidden" name="partyId" value={partyId} />
      <input type="hidden" name="to" value={to} />
      <Button
        type="submit"
        variant="primary-emerald"
        size="md"
        disabled={pending}
        trailingIcon={<ArrowRight weight="light" className="size-4" />}
        className="w-full sm:w-auto"
      >
        {pending ? "Advancing…" : `Advance to ${ONBOARDING_STAGE_LABELS[to]}`}
      </Button>
      {state?.error ? (
        <p className="ml-3 self-center text-[12px] text-down">{state.error}</p>
      ) : null}
    </form>
  );
}

function ActivateButton({ partyId }: { partyId: string }) {
  const [state, action, pending] = useActionState<ActivateState, FormData>(
    activateClient,
    undefined,
  );
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="partyId" value={partyId} />
      <Button
        type="submit"
        variant="primary-gold"
        size="md"
        disabled={pending}
        trailingIcon={<SealCheck weight="light" className="size-4" />}
        className="w-full sm:w-auto"
      >
        {pending ? "Activating…" : "Activate client"}
      </Button>
      {state?.error ? (
        <p className="text-[12px] text-down">{state.error}</p>
      ) : null}
    </form>
  );
}

function StartKycButton({ partyId }: { partyId: string }) {
  const [state, action, pending] = useActionState<StartKycState, FormData>(
    startKyc,
    undefined,
  );
  return (
    <form action={action} className="inline-flex flex-wrap items-center gap-3">
      <input type="hidden" name="partyId" value={partyId} />
      <Button
        type="submit"
        variant="secondary-hairline"
        size="md"
        disabled={pending}
        leadingIcon={<ShieldCheck weight="light" className="size-4" />}
        className="w-full sm:w-auto"
      >
        {pending ? "Raising…" : "Raise KYC record"}
      </Button>
      {state?.error ? (
        <p className="text-[12px] text-down">{state.error}</p>
      ) : null}
    </form>
  );
}

function UploadDocButton({
  partyId,
  docKey,
  label = "Upload",
}: {
  partyId: string;
  docKey: OnboardingDocKey;
  label?: string;
}) {
  const [state, action, pending] = useActionState<DocUploadState, FormData>(
    markDocumentUploaded,
    undefined,
  );
  return (
    <form action={action} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="partyId" value={partyId} />
      <input type="hidden" name="docKey" value={docKey} />
      <Button
        type="submit"
        variant="secondary-hairline"
        size="sm"
        disabled={pending}
        leadingIcon={<UploadSimple weight="light" className="size-3.5" />}
      >
        {pending ? "Filing…" : label}
      </Button>
      {state?.error ? (
        <p className="text-[11px] text-down">{state.error}</p>
      ) : null}
    </form>
  );
}

function VerifyDocButton({
  partyId,
  docKey,
}: {
  partyId: string;
  docKey: OnboardingDocKey;
}) {
  const [state, action, pending] = useActionState<DocVerifyState, FormData>(
    verifyDocument,
    undefined,
  );
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="partyId" value={partyId} />
      <input type="hidden" name="docKey" value={docKey} />
      <Button
        type="submit"
        variant="primary-emerald"
        size="sm"
        disabled={pending}
        leadingIcon={<Check weight="light" className="size-3.5" />}
      >
        {pending ? "Verifying…" : "Verify"}
      </Button>
      {state?.error ? (
        <p className="text-[11px] text-down">{state.error}</p>
      ) : null}
    </form>
  );
}

function RejectDocButton({
  partyId,
  docKey,
}: {
  partyId: string;
  docKey: OnboardingDocKey;
}) {
  const [state, action, pending] = useActionState<DocVerifyState, FormData>(
    rejectDocument,
    undefined,
  );
  const [reason, setReason] = React.useState("");
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="partyId" value={partyId} />
      <input type="hidden" name="docKey" value={docKey} />
      <input
        name="reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason…"
        aria-label="Rejection reason"
        required
        maxLength={500}
        className={cn(
          "h-8 w-[140px] rounded-full bg-foreground/[0.03] px-3 text-[12px] text-foreground",
          "ring-1 ring-hairline/70 transition-all duration-200 ease-soft",
          "focus:ring-hairline focus:outline-none placeholder:text-muted-foreground/60",
        )}
      />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending || reason.trim().length === 0}
        leadingIcon={<XCircle weight="light" className="size-3.5" />}
        className="text-down hover:text-down"
      >
        {pending ? "…" : "Reject"}
      </Button>
      {state?.error ? (
        <p className="text-[11px] text-down">{state.error}</p>
      ) : null}
    </form>
  );
}

function ApproveComplianceButton({ partyId }: { partyId: string }) {
  const [state, action, pending] = useActionState<ComplianceState, FormData>(
    approveCompliance,
    undefined,
  );
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="partyId" value={partyId} />
      <Button
        type="submit"
        variant="primary-emerald"
        size="md"
        disabled={pending}
        leadingIcon={<SealCheck weight="light" className="size-4" />}
        className="w-full sm:w-auto"
      >
        {pending ? "Approving…" : "Approve compliance"}
      </Button>
      {state?.error ? (
        <p className="text-[12px] text-down">{state.error}</p>
      ) : null}
    </form>
  );
}

function RejectComplianceButton({ partyId }: { partyId: string }) {
  const [state, action, pending] = useActionState<ComplianceState, FormData>(
    rejectCompliance,
    undefined,
  );
  const [reason, setReason] = React.useState("");
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="partyId" value={partyId} />
      <textarea
        name="reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Rejection reason - visible to the relationship manager for re-submission…"
        aria-label="Compliance rejection reason"
        required
        maxLength={2000}
        rows={2}
        className={cn(
          "w-full appearance-none rounded-xl bg-foreground/[0.03] px-3.5 py-2.5 text-[13px] text-foreground",
          "ring-1 ring-hairline/70 transition-all duration-200 ease-soft",
          "focus:ring-hairline focus:outline-none placeholder:text-muted-foreground/60 resize-none",
        )}
      />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending || reason.trim().length === 0}
        leadingIcon={<XCircle weight="light" className="size-4" />}
        className="w-full text-down hover:text-down"
      >
        {pending ? "Rejecting…" : "Reject compliance"}
      </Button>
      {state?.error ? (
        <p className="text-[12px] text-down">{state.error}</p>
      ) : null}
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function nextStageOf(stage: OnboardingStage): OnboardingStage | null {
  const idx = ONBOARDING_STAGE_ORDER.indexOf(stage);
  if (idx < 0 || idx >= ONBOARDING_STAGE_ORDER.length - 1) return null;
  return ONBOARDING_STAGE_ORDER[idx + 1]!;
}

function fmtDate(v: string | Date | null): string {
  if (!v) return "-";
  const d = typeof v === "string" ? new Date(v) : v;
  if (!Number.isFinite(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
        {label}
      </span>
      <span className="text-[12.5px] text-foreground/90">{value}</span>
    </div>
  );
}