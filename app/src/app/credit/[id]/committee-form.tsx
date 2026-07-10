"use client";

import * as React from "react";
import { useActionState } from "react";
import { CheckCircle, Warning, ArrowRight } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/brand";
import {
  advanceCommitteeState,
  type AdvanceCommitteeState,
} from "@/features/credit/actions";

const ACTIONS = [
  "assign",
  "maintain",
  "upgrade",
  "downgrade",
  "watch_negative",
  "watch_positive",
] as const;

const fieldClass = cn(
  // h-11 (44px) meets the touch target floor for form fields on phones.
  "h-11 w-full appearance-none rounded-xl bg-foreground/[0.03] px-3.5 text-[13.5px] text-foreground",
  "ring-1 ring-hairline/70 transition-all duration-200 ease-soft",
  "focus:bg-foreground/[0.05] focus:ring-hairline focus:outline-none",
);

const labelClass = "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground";

/**
 * Committee-workflow stub form (spec §9). Captures the next state as
 * internal_rating_action + recommendation (+ watchlist toggle) on the
 * credit_analysis row. CommitteeMeeting / CommitteeDecision tables are a
 * future schema addition (see report).
 */
export function CommitteeForm({
  analysisId,
  currentAction,
  currentRecommendation,
  watchlist,
}: {
  analysisId: string;
  currentAction: string | null;
  currentRecommendation: string | null;
  watchlist: boolean | null;
}) {
  const [state, action, pending] = useActionState<
    AdvanceCommitteeState,
    FormData
  >(advanceCommitteeState, undefined);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="creditAnalysisId" value={analysisId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="internalRatingAction" className={labelClass}>
          Committee action / state
        </label>
        <FieldSelect
          id="internalRatingAction"
          name="internalRatingAction"
          defaultValue={currentAction ?? "assign"}
        >
          {ACTIONS.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </FieldSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="recommendation" className={labelClass}>
          Recommendation / conditions
        </label>
        <textarea
          id="recommendation"
          name="recommendation"
          rows={4}
          defaultValue={currentRecommendation ?? ""}
          className={cn(
            "w-full rounded-xl bg-foreground/[0.03] p-3.5 text-[13.5px] text-foreground",
            "ring-1 ring-hairline/70 transition-all duration-200 ease-soft",
            "focus:bg-foreground/[0.05] focus:ring-hairline focus:outline-none",
            "placeholder:text-muted-foreground/70",
          )}
          placeholder="e.g. Approve with conditions: maintain Net Debt/EBITDA < 3.5x; quarterly financials within 45 days."
        />
      </div>
      <label className="inline-flex items-center gap-2.5 text-[13.5px] text-foreground/85">
        <input
          type="checkbox"
          name="watchlistFlag"
          value="on"
          defaultChecked={watchlist === true}
          className="size-4 rounded ring-1 ring-hairline accent-gold"
        />
        Add to watchlist
      </label>

      {state && "error" in state && state.error ? (
        <p className="inline-flex items-center gap-1.5 text-[13px] text-down">
          <Warning weight="light" className="size-4" />
          {state.error}
        </p>
      ) : null}
      {state && "ok" in state && state.ok ? (
        <p className="inline-flex items-center gap-1.5 text-[13px] text-gold">
          <CheckCircle weight="light" className="size-4" />
          Committee state updated.
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="submit"
          variant="primary-gold"
          size="md"
          // w-full on mobile so the primary CTA spans the form width (a bigger
          // thumb target); sm:w-auto restores inline width on desktop. h-11
          // meets the 44px touch floor on phones.
          className="w-full h-11 sm:w-auto md:h-9.5"
          disabled={pending}
          trailingIcon={<ArrowRight weight="light" className="size-4" />}
        >
          {pending ? "Saving…" : "Update committee state"}
        </Button>
      </div>
    </form>
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
