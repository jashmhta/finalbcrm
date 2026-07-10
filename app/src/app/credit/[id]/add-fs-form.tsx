"use client";

import * as React from "react";
import { useActionState } from "react";
import { Plus, CheckCircle, Warning } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  Button,
  Eyebrow,
} from "@/components/brand";
import { addFinancialStatement, type AddFsState } from "@/features/credit/actions";

const PERIOD_TYPES = ["annual", "half_year", "quarter", "month"] as const;
const STATEMENT_TYPES = [
  "balance_sheet",
  "profit_loss",
  "cash_flow",
  "standalone",
  "consolidated",
] as const;
const UNITS = ["absolute", "lakhs", "crores", "millions"] as const;
const FS_SOURCES = [
  "audited",
  "limited_review",
  "management_provisional",
  "rating_agency_filing",
] as const;
const LINK_ROLES = ["primary_basis", "supporting", "prior_period", "peer"] as const;

const fieldClass = cn(
  // h-11 (44px) meets the touch target floor for form fields on phones.
  "h-11 w-full appearance-none rounded-xl bg-foreground/[0.03] px-3.5 text-[13.5px] text-foreground",
  "ring-1 ring-hairline/70 transition-all duration-200 ease-soft",
  "focus:bg-foreground/[0.05] focus:ring-hairline focus:outline-none",
  "placeholder:text-muted-foreground/70",
);

const inputClass = cn(
  fieldClass,
  "h-11 pr-3.5",
);

const labelClass = "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground";

const SAMPLE_LINE_ITEMS = `{
  "revenue": 1200,
  "cogs": 800,
  "ebit": 180,
  "depreciation_amortization": 40,
  "interest_expense": 60,
  "pbt": 120,
  "tax": 30,
  "pat": 90,
  "total_debt": 500,
  "cash_and_equivalents": 50,
  "current_assets": 300,
  "current_liabilities": 200,
  "inventory": 80,
  "trade_receivables": 150,
  "trade_payables": 100,
  "total_assets": 900,
  "net_worth": 350,
  "tangible_net_worth": 330,
  "cfo": 130,
  "cfo_before_wc_changes": 160,
  "capex": 70
}`;

/**
 * Form to attach a financial statement (one period) to a credit analysis.
 * Line items are entered as a JSON object keyed by the canonical line-item
 * codes (see ratios.ts). On success the server action revalidates the page.
 * Fields get the double-bezel hairline treatment; the JSON editor uses Geist
 * Mono so the keys align.
 */
export function AddFinancialStatementForm({ analysisId }: { analysisId: string }) {
  const [state, action, pending] = useActionState<AddFsState, FormData>(
    addFinancialStatement,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="creditAnalysisId" value={analysisId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="periodEndDate" className={labelClass}>
            Period end date
          </label>
          <input
            id="periodEndDate"
            name="periodEndDate"
            type="date"
            required
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="periodStartDate" className={labelClass}>
            Period start (opt.)
          </label>
          <input
            id="periodStartDate"
            name="periodStartDate"
            type="date"
            className={inputClass}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="periodType" className={labelClass}>
            Period type
          </label>
          <FieldSelect id="periodType" name="periodType" defaultValue="annual">
            {PERIOD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </FieldSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="statementType" className={labelClass}>
            Statement type
          </label>
          <FieldSelect
            id="statementType"
            name="statementType"
            defaultValue="consolidated"
          >
            {STATEMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </FieldSelect>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="units" className={labelClass}>
            Units
          </label>
          <FieldSelect id="units" name="units" defaultValue="crores">
            {UNITS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </FieldSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="source" className={labelClass}>
            Source
          </label>
          <FieldSelect id="source" name="source" defaultValue="audited">
            {FS_SOURCES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </FieldSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="linkRole" className={labelClass}>
            Link role
          </label>
          <FieldSelect
            id="linkRole"
            name="linkRole"
            defaultValue="primary_basis"
          >
            {LINK_ROLES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </FieldSelect>
        </div>
      </div>
      <label className="inline-flex items-center gap-2.5 text-[13.5px] text-foreground/85">
        <input
          type="checkbox"
          name="isConsolidated"
          value="on"
          defaultChecked
          className="size-4 rounded ring-1 ring-hairline accent-gold"
        />
        Consolidated
      </label>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="lineItemsJson" className={labelClass}>
            Line items (JSON)
          </label>
          <Eyebrow>canonical codes</Eyebrow>
        </div>
        <textarea
          id="lineItemsJson"
          name="lineItemsJson"
          required
          rows={10}
          defaultValue={SAMPLE_LINE_ITEMS}
          className={cn(
            "nums w-full rounded-xl bg-foreground/[0.03] p-3.5 text-[12.5px] text-foreground",
            "ring-1 ring-hairline/70 transition-all duration-200 ease-soft",
            "focus:bg-foreground/[0.05] focus:ring-hairline focus:outline-none",
          )}
        />
        <p className="text-[12px] text-muted-foreground">
          Keys are canonical line-item codes (revenue, ebit, total_debt, …).
          Values in the selected units.
        </p>
      </div>

      {state && "error" in state && state.error ? (
        <p className="inline-flex items-center gap-1.5 text-[13px] text-down">
          <Warning weight="light" className="size-4" />
          {state.error}
        </p>
      ) : null}
      {state && "ok" in state && state.ok ? (
        <p className="inline-flex items-center gap-1.5 text-[13px] text-gold">
          <CheckCircle weight="light" className="size-4" />
          Financial statement added.
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
          trailingIcon={<Plus weight="light" className="size-4" />}
        >
          {pending ? "Adding…" : "Add statement"}
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
