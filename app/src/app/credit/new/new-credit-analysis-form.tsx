"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Buildings,
  SealCheck,
  Tag,
  Hash,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Button,
  Eyebrow,
  Badge,
} from "@/components/brand";
import { createCreditAnalysis, type CreateCreditAnalysisState } from "@/features/credit/actions";

const OBLIGOR_TYPES = [
  "corporate",
  "spv",
  "project",
  "sovereign",
  "state_psu",
  "nbfc",
  "bank",
] as const;

const ANALYSIS_TYPES = [
  "origination",
  "annual_surveillance",
  "event_driven",
  "watchlist_trigger",
  "rating_presentation_support",
] as const;

const OBLIGOR_HINT: Record<string, string> = {
  corporate: "A rated corporate obligor - full spreading + scorecard.",
  spv: "Special-purpose vehicle - project cash flows, ring-fenced.",
  project: "Project finance - Debt Service Coverage Ratio-led, milestone-linked.",
  sovereign: "Sovereign / quasi-sovereign - macro + political overlay.",
  state_psu: "State PSU - implicit support + standalone blend.",
  nbfc: "NBFC - asset-liability, gearing, asset quality.",
  bank: "Bank - capital, asset quality, earnings, liquidity.",
};

const ANALYSIS_HINT: Record<string, string> = {
  origination: "First-time internal rating for a new exposure.",
  annual_surveillance: "Refresh of an existing issuer's file.",
  event_driven: "Triggered by a material event (M&A, refi, downgrade).",
  watchlist_trigger: "Opened off a watchlist breach.",
  rating_presentation_support: "Pre-positioning for an agency review.",
};

const fieldClass = cn(
  "h-11 w-full appearance-none rounded-xl bg-foreground/[0.03] px-3.5 text-[14px] text-foreground",
  "ring-1 ring-hairline/70 transition-all duration-200 ease-soft",
  "focus:bg-foreground/[0.05] focus:ring-hairline focus:outline-none",
  "placeholder:text-muted-foreground/70",
);

const labelClass = "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground";

/**
 * Client form for starting a credit analysis. Native <select> elements keep
 * the markup accessible; the form posts to the createCreditAnalysis server
 * action via useActionState, which redirects to the new analysis on success.
 *
 * "Name the analysis": the credit_analysis table has no free-text name column
 * (schema frozen), so the file is identified by its issuer + analysis type.
 * The live "Filed as" preview assembles that identity from the selections and
 * shows the analyst exactly how the draft will be labelled in the ledger
 * before they commit - the naming UX without a fake persisted field. The
 * preview is view-layer/display-only; the server action's signature is
 * untouched.
 */
export function NewCreditAnalysisForm({
  parties,
}: {
  parties: { partyId: string; legalName: string }[];
}) {
  const [state, action, pending] = useActionState<
    CreateCreditAnalysisState,
    FormData
  >(createCreditAnalysis, undefined);

  const [partyId, setPartyId] = React.useState<string>("");
  const [obligorType, setObligorType] = React.useState<string>("corporate");
  const [analysisType, setAnalysisType] = React.useState<string>("origination");

  const issuerName =
    parties.find((p) => p.partyId === partyId)?.legalName ?? null;

  const analysisLabel = analysisType.replace(/_/g, " ");
  const filedAs =
    issuerName != null
      ? `${issuerName} · ${analysisLabel}`
      : partyId
        ? `${partyId.slice(0, 8)} · ${analysisLabel}`
        : null;

  return (
    <Card>
      <CardHeader>
        <Eyebrow dot>Draft credit file</Eyebrow>
        <CardTitle className="mt-1">Start an analysis</CardTitle>
        <CardDescription>
          Pick an issuer and obligor type to open a draft credit file. Add
          financial statements and run the scorecard from the analysis
          workspace.
        </CardDescription>
      </CardHeader>
      <CardBody>
        {/* Live "Filed as" preview - the naming surface. Assembles the
            analysis's identity from the selections so the analyst sees the
            exact label the draft will carry before they commit. */}
        <div
          className="mb-6 flex flex-col gap-2 rounded-xl bg-surface p-4 ring-1 ring-inset ring-foreground/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Tag weight="light" className="size-3.5" />
            <span className="text-[10.5px] font-medium uppercase tracking-[0.14em]">
              Filed as
            </span>
          </div>
          {filedAs ? (
            <span className="text-[clamp(1.25rem,1rem+0.8vw,1.6rem)] font-light leading-tight tracking-[-0.01em] text-foreground break-words">
              {filedAs}
            </span>
          ) : (
            <span className="text-[13px] italic text-muted-foreground">
              Select an issuer to name this analysis…
            </span>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {issuerName ? (
              <Badge variant="emerald" icon={<Buildings weight="light" />} dot>
                {obligorType.replace(/_/g, " ")}
              </Badge>
            ) : null}
            <Badge variant="outline" icon={<SealCheck weight="light" />}>
              {analysisLabel}
            </Badge>
          </div>
        </div>

        <form action={action} className="flex flex-col gap-5">
          {/* Issuer select - the primary naming lever. */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="partyId" className={labelClass}>
              Issuer / obligor
            </label>
            <FieldSelect
              id="partyId"
              name="partyId"
              required
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
            >
              <option value="" disabled>
                Select a party…
              </option>
              {parties.map((p) => (
                <option key={p.partyId} value={p.partyId}>
                  {p.legalName}
                </option>
              ))}
            </FieldSelect>
            {parties.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">
                No parties available - create one first.
              </p>
            ) : issuerName ? (
              <p className="text-[12px] text-muted-foreground">
                {OBLIGOR_HINT[obligorType] ?? ""}
              </p>
            ) : (
              <p className="text-[12px] text-muted-foreground">
                {parties.length} part{parties.length === 1 ? "y" : "ies"} on the ledger.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="obligorType" className={labelClass}>
                Initial obligor type
              </label>
              <FieldSelect
                id="obligorType"
                name="obligorType"
                required
                value={obligorType}
                onChange={(e) => setObligorType(e.target.value)}
              >
                {OBLIGOR_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </FieldSelect>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="analysisType" className={labelClass}>
                Analysis type
              </label>
              <FieldSelect
                id="analysisType"
                name="analysisType"
                value={analysisType}
                onChange={(e) => setAnalysisType(e.target.value)}
              >
                {ANALYSIS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </FieldSelect>
            </div>
          </div>

          {analysisType ? (
            <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
              <Hash weight="light" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" />
              {ANALYSIS_HINT[analysisType] ?? ""}
            </p>
          ) : null}

          {state?.error ? (
            <p className="text-[13px] text-down">{state.error}</p>
          ) : null}

          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              asChild
              variant="secondary-hairline"
              size="md"
              // w-full on mobile so the stacked Cancel/Create span the form
              // width (a bigger thumb target); sm:w-auto restores inline width
              // on desktop. h-11 meets the 44px touch floor on phones.
              className="w-full h-11 sm:w-auto md:h-9.5"
              leadingIcon={<ArrowLeft weight="light" className="size-4" />}
            >
              <Link href="/credit">Cancel</Link>
            </Button>
            <Button
              type="submit"
              variant="primary-gold"
              size="md"
              className="w-full h-11 sm:w-auto md:h-9.5"
              disabled={pending || parties.length === 0 || !partyId}
              trailingIcon={<ArrowRight weight="light" className="size-4" />}
            >
              {pending ? "Creating…" : "Create analysis"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

/** Native <select> styled with the double-bezel hairline + chevron. */
function FieldSelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
) {
  return (
    <div className="relative inline-flex items-center">
      <select {...props} className={cn(fieldClass, "pr-9")} />
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className="pointer-events-none absolute right-3 size-3 text-muted-foreground"
      >
        <path
          d="M2 4l4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}