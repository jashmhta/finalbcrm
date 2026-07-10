"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import {
  ArrowRight,
  Trophy,
  XCircle,
  Trash,
  Notepad,
  Sparkle,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Button, Badge } from "@/components/brand";
import {
  convertToOpportunity,
  winLead,
  loseLead,
  deleteLead,
  addLeadNote,
  type ConvertState,
  type WinState,
  type LoseState,
  type DeleteState,
  type NoteState,
} from "@/features/leads/actions";
// Constants + types from `./types` directly - NOT the feature barrel (which
// re-exports ./queries → postgres → breaks the "use client" bundle).
import {
  LEAD_LOSS_REASONS,
  LEAD_LOSS_REASON_LABELS,
  type LeadLossReason,
} from "@/features/leads/types";

const fieldClass = cn(
  "h-10 w-full appearance-none rounded-xl bg-foreground/[0.03] px-3.5 text-[13px] text-foreground",
  "ring-1 ring-hairline/70 transition-all duration-200 ease-soft",
  "focus:bg-foreground/[0.05] focus:ring-hairline focus:outline-none",
  "placeholder:text-muted-foreground/70",
);

const labelClass =
  "text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground";

/* ------------------------------------------------------------------ *
 * ConvertToOpportunity - promotes a qualified lead to an opportunity.
 *  Gated on full BANT (the server action re-checks). Shows an inline panel
 *  to tune probability / expected close / RM at the moment of conversion.
 * ------------------------------------------------------------------ */
export function ConvertToOpportunity({
  partyId,
  qualified,
  isClosed,
  isOpportunity,
  rms,
}: {
  partyId: string;
  qualified: boolean;
  isClosed: boolean;
  isOpportunity: boolean;
  rms: { userId: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<ConvertState, FormData>(
    convertToOpportunity,
    undefined,
  );
  const [open, setOpen] = React.useState(false);

  if (isClosed) return null;
  if (isOpportunity) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-gold/[0.07] px-3.5 py-2.5 text-[12.5px] text-gold ring-1 ring-gold/25">
        <Sparkle weight="light" className="size-4" />
        Active opportunity - pursue to a won mandate.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="primary-gold"
          size="md"
          className="h-11 w-full sm:w-auto md:h-9.5"
          disabled={!qualified || pending}
          onClick={() => setOpen((v) => !v)}
          trailingIcon={<ArrowRight weight="light" className="size-4" />}
        >
          {pending ? "Converting…" : "Convert to opportunity"}
        </Button>
        {!qualified ? (
          <span className="text-[12px] text-muted-foreground">
            Complete all four BANT criteria to enable conversion.
          </span>
        ) : null}
      </div>

      {open && qualified ? (
        <form
          action={action}
          className="mt-1 flex flex-col gap-3 rounded-xl bg-surface p-4 ring-1 ring-inset ring-foreground/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
        >
          <input type="hidden" name="partyId" value={partyId} />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="probability" className={labelClass}>
                Win probability %
              </label>
              <input
                id="probability"
                name="probability"
                type="number"
                min={0}
                max={100}
                step="5"
                defaultValue={50}
                className={cn(fieldClass, "font-mono tabular-nums")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="expectedClose" className={labelClass}>
                Expected close
              </label>
              <input
                id="expectedClose"
                name="expectedClose"
                type="date"
                className={cn(fieldClass, "font-mono tabular-nums")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="assignedRm" className={labelClass}>
                Assigned Relationship Manager
              </label>
              <select
                id="assignedRm"
                name="assignedRm"
                defaultValue=""
                className={cn(fieldClass, "pr-9")}
              >
                <option value="">Keep current</option>
                {rms.map((r) => (
                  <option key={r.userId} value={r.userId}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary-gold"
              size="md"
              disabled={pending}
              trailingIcon={<ArrowRight weight="light" className="size-4" />}
            >
              {pending ? "Converting…" : "Confirm conversion"}
            </Button>
          </div>
          {state?.error ? (
            <p className="text-[12.5px] text-down">{state.error}</p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * WinLeadButton - convert a won lead into a real mandated deal row.
 *  Shown once the lead is an opportunity (or qualified). Creates a deal and
 *  links back via convertedDealId.
 * ------------------------------------------------------------------ */
export function WinLeadButton({
  partyId,
  eligible,
  alreadyWon,
}: {
  partyId: string;
  eligible: boolean;
  alreadyWon: boolean;
}) {
  const [state, action, pending] = useActionState<WinState, FormData>(
    winLead,
    undefined,
  );
  if (alreadyWon) return null;
  return (
    <form action={action}>
      <input type="hidden" name="partyId" value={partyId} />
      <Button
        type="submit"
        variant="primary-gold"
        size="md"
        className="h-11 w-full sm:w-auto md:h-9.5"
        disabled={!eligible || pending}
        leadingIcon={<Trophy weight="light" className="size-4" />}
      >
        {pending ? "Creating deal…" : "Win - create mandate"}
      </Button>
      {state?.error ? (
        <p className="mt-2 text-[12.5px] text-down">{state.error}</p>
      ) : state?.ok && state.dealId ? (
        <p className="mt-2 text-[12.5px] text-emerald">
          Mandate created.{" "}
          <Link href={`/deals/${state.dealId}`} className="underline">
            Open deal →
          </Link>
        </p>
      ) : null}
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * LoseLeadButton - close a lead as lost with a reason.
 * ------------------------------------------------------------------ */
export function LoseLeadButton({
  partyId,
  eligible,
}: {
  partyId: string;
  eligible: boolean;
}) {
  const [state, action, pending] = useActionState<LoseState, FormData>(
    loseLead,
    undefined,
  );
  const [open, setOpen] = React.useState(false);
  if (!eligible) return null;

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="secondary-hairline"
        size="md"
        className="h-11 w-full sm:w-auto md:h-9.5"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        leadingIcon={<XCircle weight="light" className="size-4" />}
      >
        Close as lost
      </Button>
      {open ? (
        <form
          action={action}
          className="mt-1 flex flex-col gap-3 rounded-xl bg-surface p-4 ring-1 ring-inset ring-foreground/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
        >
          <input type="hidden" name="partyId" value={partyId} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="lossReason" className={labelClass}>
              Loss reason
            </label>
            <select
              id="lossReason"
              name="lossReason"
              required
              defaultValue={LEAD_LOSS_REASONS[0] as LeadLossReason}
              className={cn(fieldClass, "pr-9")}
            >
              {LEAD_LOSS_REASONS.map((r) => (
                <option key={r} value={r}>
                  {LEAD_LOSS_REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="secondary-hairline"
              size="md"
              disabled={pending}
              leadingIcon={<XCircle weight="light" className="size-4" />}
            >
              {pending ? "Closing…" : "Confirm - close lost"}
            </Button>
          </div>
          {state?.error ? (
            <p className="text-[12.5px] text-down">{state.error}</p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * DeleteLeadButton - stop tracking a lead (clears lead_meta; party remains).
 *  Destructive - tucked behind a confirm toggle.
 * ------------------------------------------------------------------ */
export function DeleteLeadButton({ partyId }: { partyId: string }) {
  const [state, action, pending] = useActionState<DeleteState, FormData>(
    deleteLead,
    undefined,
  );
  const [armed, setArmed] = React.useState(false);

  return (
    <div className="flex flex-col gap-2">
      {armed ? (
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="partyId" value={partyId} />
          <span className="text-[12px] text-muted-foreground">
            Removes lead tracking - the party row stays on the ledger.
          </span>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={pending}
            leadingIcon={<Trash weight="light" className="size-3.5" />}
            className="text-down hover:text-down"
          >
            {pending ? "Removing…" : "Confirm remove"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setArmed(false)}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setArmed(true)}
          leadingIcon={<Trash weight="light" className="size-3.5" />}
          className="text-muted-foreground hover:text-down"
        >
          Stop tracking
        </Button>
      )}
      {state?.error ? (
        <p className="text-[12.5px] text-down">{state.error}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * AddNoteForm - log an interaction (note) anchored to the lead's party.
 * ------------------------------------------------------------------ */
export function AddNoteForm({ partyId }: { partyId: string }) {
  const [state, action, pending] = useActionState<NoteState, FormData>(
    addLeadNote,
    undefined,
  );
  const [body, setBody] = React.useState("");

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="partyId" value={partyId} />
      <div className="relative">
        <Notepad
          weight="light"
          className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground/60"
        />
        <textarea
          name="body"
          required
          rows={3}
          maxLength={20000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Log a note - the sourcing conversation, a follow-up, a commitment…"
          aria-label="Note body"
          className={cn(
            fieldClass,
            "h-auto min-h-[80px] resize-y pl-9 leading-relaxed",
          )}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        {state?.ok ? (
          <span className="text-[12px] text-emerald">Note logged.</span>
        ) : state?.error ? (
          <span className="text-[12px] text-down">{state.error}</span>
        ) : (
          <span className="text-[12px] text-muted-foreground">
            Logged as an outbound interaction on the lead&apos;s party.
          </span>
        )}
        <Button
          type="submit"
          variant="secondary-hairline"
          size="sm"
          disabled={pending || body.trim().length === 0}
        >
          {pending ? "Logging…" : "Log note"}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * StageBadgeStub - a tiny badge for the closed-lost reason display.
 * ------------------------------------------------------------------ */
export function LossReasonBadge({ reason }: { reason: string }) {
  return (
    <Badge variant="down" icon={<XCircle weight="light" className="size-3" />}>
      {LEAD_LOSS_REASON_LABELS[reason as LeadLossReason] ?? reason}
    </Badge>
  );
}