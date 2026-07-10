"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  PencilSimple,
  X,
  CircleNotch,
  ArrowRight,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Button, Eyebrow } from "@/components/brand";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { compactCr } from "@/features/reports/export";
import type { LimitRow } from "@/features/portfolio";
import { updateLimit, type UpdateLimitState } from "@/features/portfolio/actions";

/**
 * Edit-limit dialog - the inline editor for a single counterparty credit
 * limit. A PencilSimple icon button on the row opens a double-bezel dialog
 * with the limit amount, utilized, and review-due fields. The form submits to
 * the `updateLimit` server action via useActionState; on success the dialog
 * closes and the page revalidates (the action revalidates /portfolio/limits +
 * the dashboard).
 *
 * The dialog is gated by the `canEdit` flag computed server-side (credit_limit:
 * approve or admin); the action re-checks on submit so a forged request from a
 * user without the permission is rejected server-side. The form pre-fills
 * from the current row and resets whenever the dialog re-opens.
 */
export function EditLimitDialog({ row }: { row: LimitRow }) {
  const [state, action, pending] = useActionState<UpdateLimitState, FormData>(
    updateLimit,
    undefined,
  );
  const [open, setOpen] = React.useState(false);

  // Local controlled field state - pre-filled from the row, reset whenever
  // the dialog opens so re-opening after a prior edit shows the live value.
  const [limitAmount, setLimitAmount] = React.useState<string>(
    row.limitAmountCr.toString(),
  );
  const [utilized, setUtilized] = React.useState<string>(
    row.utilizedCr.toString(),
  );
  const [reviewDue, setReviewDue] = React.useState<string>(
    row.reviewDueDate ?? "",
  );

  React.useEffect(() => {
    if (open) {
      setLimitAmount(row.limitAmountCr.toString());
      setUtilized(row.utilizedCr.toString());
      setReviewDue(row.reviewDueDate ?? "");
    }
  }, [open, row]);

  React.useEffect(() => {
    if (state?.ok && open) setOpen(false);
  }, [state, open]);

  const limitNum = Number(limitAmount);
  const utilizedNum = Number(utilized);
  const newAvailable = Number.isFinite(limitNum) ? limitNum - utilizedNum : NaN;
  const newUtilPct =
    Number.isFinite(limitNum) && limitNum > 0 ? (utilizedNum / limitNum) * 100 : 0;
  const willBreach = Number.isFinite(limitNum) && utilizedNum > limitNum;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={`Edit limit for ${row.partyName}`}
            className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground ring-1 ring-hairline transition-all duration-200 ease-soft hover:bg-foreground/5 hover:text-foreground active:scale-[0.96]"
          >
            <PencilSimple weight="light" className="size-4" />
          </button>
        }
      />
      <DialogContent
        className={cn(
          "max-h-[90vh] max-w-[520px] gap-0 overflow-y-auto rounded-[1.5rem] border-0 bg-transparent p-0 ring-0",
        )}
      >
        <div className="rounded-[1.5rem] bg-foreground/[0.03] p-1.5 ring-1 ring-hairline shadow-floating">
          <div className="bezel-hi overflow-hidden rounded-[calc(1.5rem-0.375rem)] bg-surface">
            <form action={action} className="flex flex-col gap-5 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <Eyebrow dot>Edit limit</Eyebrow>
                  <DialogTitle className="text-[1.4rem] font-light leading-tight tracking-[-0.02em] text-foreground">
                    {row.partyName}
                  </DialogTitle>
                  <DialogDescription className="text-[13px] text-muted-foreground">
                    {row.limitTypeLabel} · {row.currency}. Update the approved amount, utilization, or review date. The change is audit-logged.
                  </DialogDescription>
                </div>
                <DialogClose
                  render={
                    <button
                      type="button"
                      aria-label="Close"
                      className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground ring-1 ring-hairline transition-all duration-200 ease-soft hover:bg-foreground/5 hover:text-foreground active:scale-[0.96]"
                    />
                  }
                >
                  <X weight="light" className="size-4" />
                </DialogClose>
              </div>

              <input type="hidden" name="creditLimitId" value={row.creditLimitId} />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Limit amount" htmlFor="limitAmount" required hint="₹ Cr">
                  <BezelNumberInput
                    id="limitAmount"
                    name="limitAmount"
                    value={limitAmount}
                    onChange={setLimitAmount}
                    step="0.01"
                    min="0"
                  />
                </Field>
                <Field label="Utilized" htmlFor="utilized" required hint="₹ Cr">
                  <BezelNumberInput
                    id="utilized"
                    name="utilized"
                    value={utilized}
                    onChange={setUtilized}
                    step="0.01"
                    min="0"
                  />
                </Field>
              </div>

              <Field label="Review due" htmlFor="reviewDue" hint="optional">
                <div className="group/field rounded-xl bg-foreground/[0.02] p-px ring-1 ring-hairline/70 transition-all duration-200 ease-soft focus-within:ring-hairline">
                  <input
                    id="reviewDue"
                    name="reviewDue"
                    type="date"
                    value={reviewDue}
                    onChange={(e) => setReviewDue(e.target.value)}
                    className={cn(
                      "h-10 w-full rounded-[calc(0.75rem-1px)] bg-surface px-3.5 text-[13.5px] text-foreground",
                      "placeholder:text-muted-foreground/60 focus:outline-none",
                    )}
                  />
                </div>
              </Field>

              {/* Live recompute preview. */}
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-foreground/[0.025] p-3 ring-1 ring-hairline/50">
                <PreviewStat
                  label="Available"
                  value={Number.isFinite(newAvailable) ? compactCr(newAvailable) : "-"}
                  tone={newAvailable < 0 ? "down" : "default"}
                />
                <PreviewStat
                  label="Utilization"
                  value={Number.isFinite(newUtilPct) ? `${newUtilPct.toFixed(1)}%` : "-"}
                  tone={willBreach ? "down" : newUtilPct > 80 ? "gold" : "default"}
                />
                <PreviewStat
                  label="Status"
                  value={willBreach ? "Breached" : "Within"}
                  tone={willBreach ? "down" : "up"}
                />
              </div>

              {state?.error ? (
                <p className="rounded-lg bg-down/[0.08] px-3 py-2 text-[12.5px] text-down ring-1 ring-down/22">
                  {state.error}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <DialogClose
                  render={
                    <Button type="button" variant="secondary-hairline" size="md">
                      Cancel
                    </Button>
                  }
                />
                <Button
                  type="submit"
                  variant="primary-gold"
                  size="md"
                  disabled={pending}
                  trailingIcon={
                    pending ? (
                      <CircleNotch weight="light" className="size-3.5 animate-spin" />
                    ) : (
                      <ArrowRight weight="light" className="size-3.5" />
                    )
                  }
                >
                  {pending ? "Saving…" : "Save limit"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Local helpers - double-bezel field + preview stat (mirror the admin view's
// BezelInput / Field so the form matches the Card enclosure system).
// ---------------------------------------------------------------------------

function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
      >
        {label}
        {required ? <span className="text-gold">*</span> : null}
        {hint ? (
          <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground/70">
            {hint}
          </span>
        ) : null}
      </label>
      {children}
    </div>
  );
}

function BezelNumberInput({
  id,
  name,
  value,
  onChange,
  step,
  min,
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  min?: string;
}) {
  return (
    <div className="group/field rounded-xl bg-foreground/[0.02] p-px ring-1 ring-hairline/70 transition-all duration-200 ease-soft focus-within:ring-hairline">
      <input
        id={id}
        name={name}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "nums h-10 w-full rounded-[calc(0.75rem-1px)] bg-surface px-3.5 text-[13.5px] tabular-nums text-foreground",
          "placeholder:text-muted-foreground/60 focus:outline-none",
        )}
      />
    </div>
  );
}

function PreviewStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "up" | "down" | "gold";
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "nums text-[14px] font-medium tabular-nums",
          tone === "down"
            ? "text-down"
            : tone === "up"
              ? "text-up"
              : tone === "gold"
                ? "text-gold"
                : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}