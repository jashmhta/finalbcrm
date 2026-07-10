"use client";

// DPDP consent + DSR action forms - wires the existing compliance server
// actions (captureConsent / withdrawConsent / createDsr / transitionDsrStatus)
// into the consent workspace so the desk can capture consent, withdraw it,
// open a data-subject request, and advance a DSR through its workflow.
//
// Each form posts via useActionState to a "use server" action in
// @/features/compliance/actions; on success the action revalidates
// /compliance/consent so the page re-renders with the new state.
//
// Import discipline: actions come from the actions module (NOT the feature
// barrel, which re-exports queries → postgres → would break the client bundle);
// pure helpers + types come from ./consent (no DB imports). partyId / contactId
// are entered as UUIDs (matching the document/task dialog pattern); a later
// pass can swap them for searchable selectors once a party picker lands.

import * as React from "react";
import { useActionState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Plus,
  X,
  ArrowRight,
  CircleNotch,
  ArrowFatDown,
  XCircle,
  Warning,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/brand/button";
import { Eyebrow } from "@/components/brand/text";
import {
  captureConsent,
  withdrawConsent,
  createDsr,
  transitionDsrStatus,
  type CaptureConsentState,
  type WithdrawConsentState,
  type CreateDsrState,
  type TransitionDsrState,
} from "@/features/compliance/actions";
import {
  DSR_TRANSITIONS,
  type ConsentMethod,
  type ConsentPurpose,
  type DsrStatus,
  type DsrType,
} from "@/features/compliance/consent";

const fieldClass = cn(
  "h-11 w-full appearance-none rounded-xl bg-foreground/[0.03] px-3.5 text-[13.5px] text-foreground",
  "ring-1 ring-hairline/70 transition-all duration-200 ease-soft",
  "focus:bg-foreground/[0.05] focus:ring-hairline focus:outline-none",
  "placeholder:text-muted-foreground/70",
);

const labelClass =
  "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground";

const PURPOSES: readonly ConsentPurpose[] = [
  "marketing",
  "advisory_engagement",
  "kyc_processing",
  "credit_analysis",
  "data_sharing_with_rating_agency",
  "data_sharing_with_investors",
  "regulatory_reporting",
  "portfolio_management",
  "secondary_trading_contact",
];

const METHODS: readonly ConsentMethod[] = [
  "digital_sign",
  "checkbox_email",
  "physical_signed",
  "verbal_recorded",
];

const DSR_TYPES: readonly DsrType[] = [
  "access",
  "erasure",
  "rectification",
  "restriction",
  "portability",
  "withdraw_consent",
];

function pretty(s: string): string {
  return s.replace(/_/g, " ");
}

/* ================================================================== *
 * CaptureConsentDialog - "Capture consent" button + dialog.
 * ================================================================== */
export function CaptureConsentDialog() {
  const [state, action, pending] = useActionState<CaptureConsentState, FormData>(
    captureConsent,
    undefined,
  );
  const [open, setOpen] = React.useState(false);
  const [purpose, setPurpose] = React.useState<string>(PURPOSES[0]!);
  const [method, setMethod] = React.useState<string>(METHODS[0]!);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="primary-gold"
            size="sm"
            leadingIcon={<Plus weight="light" className="size-3.5" />}
            className="h-11 md:h-8"
          >
            Capture consent
          </Button>
        }
      />
      <DialogContent
        className={cn(
          "max-h-[90vh] max-w-[560px] gap-0 overflow-y-auto rounded-[1.5rem] border-0 bg-transparent p-0 ring-0",
          "sm:max-w-[560px]",
        )}
      >
        <div className="rounded-[1.5rem] bg-white/[0.02] p-1.5 ring-1 ring-hairline shadow-floating">
          <div className="bezel-hi overflow-hidden rounded-[calc(1.5rem-0.375rem)] bg-surface">
            <form action={action} className="flex flex-col gap-6 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <Eyebrow dot>DPDP consent</Eyebrow>
                  <DialogTitle className="text-[1.5rem] font-light tracking-[-0.02em] leading-tight text-foreground">
                    Capture consent
                  </DialogTitle>
                  <DialogDescription className="text-[13px] text-muted-foreground">
                    Record a purpose-bound consent. Retention is computed from the purpose.
                  </DialogDescription>
                </div>
                <DialogClose
                  render={
                    <button
                      type="button"
                      aria-label="Close"
                      className={cn(
                        "inline-flex size-8 items-center justify-center rounded-full",
                        "text-muted-foreground ring-1 ring-hairline transition-all duration-200 ease-soft",
                        "hover:bg-foreground/5 hover:text-foreground active:scale-[0.96]",
                      )}
                    />
                  }
                >
                  <X weight="light" className="size-4" />
                </DialogClose>
              </div>

              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Party ID" htmlFor="partyId" hint="uuid">
                    <BezelInput id="partyId" name="partyId" placeholder="party uuid" />
                  </Field>
                  <Field label="Contact ID" htmlFor="contactId" hint="uuid">
                    <BezelInput id="contactId" name="contactId" placeholder="contact uuid" />
                  </Field>
                </div>
                <p className="text-[11.5px] text-muted-foreground">
                  At least one of party / contact is required.
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Purpose" htmlFor="purpose">
                    <BezelSelect
                      id="purpose"
                      name="purpose"
                      value={purpose}
                      onChange={setPurpose}
                      options={PURPOSES as readonly string[]}
                    />
                  </Field>
                  <Field label="Method" htmlFor="consentMethod">
                    <BezelSelect
                      id="consentMethod"
                      name="consentMethod"
                      value={method}
                      onChange={setMethod}
                      options={METHODS as readonly string[]}
                    />
                  </Field>
                </div>

                <Field label="Purpose description" htmlFor="purposeDescription" hint="optional">
                  <BezelInput
                    id="purposeDescription"
                    name="purposeDescription"
                    placeholder="e.g. Marketing - quarterly strategy notes"
                  />
                </Field>
              </div>

              {state?.error ? (
                <p
                  role="alert"
                  className="rounded-xl bg-down/10 px-3.5 py-2.5 text-[12.5px] font-medium text-down ring-1 ring-down/25"
                >
                  {state.error}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2.5 border-t border-hairline pt-5">
                <DialogClose
                  render={
                    <Button variant="ghost" size="md" type="button">
                      Cancel
                    </Button>
                  }
                />
                <Button
                  type="submit"
                  variant="primary-gold"
                  size="md"
                  disabled={pending}
                  leadingIcon={
                    pending ? (
                      <CircleNotch weight="light" className="size-4 animate-spin" />
                    ) : undefined
                  }
                  trailingIcon={
                    pending ? undefined : <ArrowRight weight="light" className="size-4" />
                  }
                >
                  {pending ? "Capturing…" : "Capture"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== *
 * WithdrawConsentButton - inline form on each active consent row.
 * ================================================================== */
export function WithdrawConsentButton({
  consentRecordId,
}: {
  consentRecordId: string;
}) {
  const [state, action, pending] = useActionState<WithdrawConsentState, FormData>(
    withdrawConsent,
    undefined,
  );
  const [armed, setArmed] = React.useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        disabled={pending}
        className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium text-muted-foreground ring-1 ring-hairline/60 transition-colors hover:bg-down/10 hover:text-down"
        title="Withdraw consent"
      >
        <XCircle weight="light" className="size-3.5" />
        Withdraw
      </button>
    );
  }

  return (
    <form action={action} className="inline-flex items-center gap-1.5">
      <input type="hidden" name="consentRecordId" value={consentRecordId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-7 items-center gap-1 rounded-full bg-down/10 px-2.5 text-[11px] font-medium text-down ring-1 ring-down/30 transition-colors hover:bg-down/20"
      >
        {pending ? "Withdrawing…" : "Confirm"}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="inline-flex h-7 items-center rounded-full px-2 text-[11px] text-muted-foreground ring-1 ring-hairline/60 hover:text-foreground"
      >
        Cancel
      </button>
      {state?.error ? (
        <span className="text-[11px] text-down">{state.error}</span>
      ) : null}
    </form>
  );
}

/* ================================================================== *
 * CreateDsrDialog - "New request" button + dialog for opening a DSR.
 * ================================================================== */
export function CreateDsrDialog() {
  const [state, action, pending] = useActionState<CreateDsrState, FormData>(
    createDsr,
    undefined,
  );
  const [open, setOpen] = React.useState(false);
  const [requestType, setRequestType] = React.useState<string>(DSR_TYPES[0]!);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="primary-gold"
            size="sm"
            leadingIcon={<Plus weight="light" className="size-3.5" />}
            className="h-11 md:h-8"
          >
            New request
          </Button>
        }
      />
      <DialogContent
        className={cn(
          "max-h-[90vh] max-w-[560px] gap-0 overflow-y-auto rounded-[1.5rem] border-0 bg-transparent p-0 ring-0",
          "sm:max-w-[560px]",
        )}
      >
        <div className="rounded-[1.5rem] bg-white/[0.02] p-1.5 ring-1 ring-hairline shadow-floating">
          <div className="bezel-hi overflow-hidden rounded-[calc(1.5rem-0.375rem)] bg-surface">
            <form action={action} className="flex flex-col gap-6 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <Eyebrow dot>Principal rights</Eyebrow>
                  <DialogTitle className="text-[1.5rem] font-light tracking-[-0.02em] leading-tight text-foreground">
                    New data-subject request
                  </DialogTitle>
                  <DialogDescription className="text-[13px] text-muted-foreground">
                    Open a DPDP principal-rights request. The SLA due date is computed from the request type.
                  </DialogDescription>
                </div>
                <DialogClose
                  render={
                    <button
                      type="button"
                      aria-label="Close"
                      className={cn(
                        "inline-flex size-8 items-center justify-center rounded-full",
                        "text-muted-foreground ring-1 ring-hairline transition-all duration-200 ease-soft",
                        "hover:bg-foreground/5 hover:text-foreground active:scale-[0.96]",
                      )}
                    />
                  }
                >
                  <X weight="light" className="size-4" />
                </DialogClose>
              </div>

              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Party ID" htmlFor="dsrPartyId" hint="uuid">
                    <BezelInput id="dsrPartyId" name="partyId" placeholder="party uuid" />
                  </Field>
                  <Field label="Contact ID" htmlFor="dsrContactId" hint="uuid">
                    <BezelInput id="dsrContactId" name="contactId" placeholder="contact uuid" />
                  </Field>
                </div>
                <p className="text-[11.5px] text-muted-foreground">
                  At least one of party / contact is required.
                </p>

                <Field label="Request type" htmlFor="requestType">
                  <BezelSelect
                    id="requestType"
                    name="requestType"
                    value={requestType}
                    onChange={setRequestType}
                    options={DSR_TYPES as readonly string[]}
                  />
                </Field>

                <Field label="Notes" htmlFor="dsrNotes" hint="optional">
                  <textarea
                    id="dsrNotes"
                    name="notes"
                    rows={3}
                    maxLength={2000}
                    placeholder="Context - the principal's ask, scope, channel…"
                    className={cn(
                      fieldClass,
                      "h-auto min-h-[88px] resize-y leading-relaxed",
                    )}
                  />
                </Field>
              </div>

              {state?.error ? (
                <p
                  role="alert"
                  className="rounded-xl bg-down/10 px-3.5 py-2.5 text-[12.5px] font-medium text-down ring-1 ring-down/25"
                >
                  {state.error}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2.5 border-t border-hairline pt-5">
                <DialogClose
                  render={
                    <Button variant="ghost" size="md" type="button">
                      Cancel
                    </Button>
                  }
                />
                <Button
                  type="submit"
                  variant="primary-gold"
                  size="md"
                  disabled={pending}
                  leadingIcon={
                    pending ? (
                      <CircleNotch weight="light" className="size-4 animate-spin" />
                    ) : undefined
                  }
                  trailingIcon={
                    pending ? undefined : <ArrowRight weight="light" className="size-4" />
                  }
                >
                  {pending ? "Opening…" : "Open request"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== *
 * TransitionDsrControls - a select + submit on each DSR card to advance
 * its status along the allowed workflow.
 * ================================================================== */
export function TransitionDsrControls({
  dsrId,
  current,
}: {
  dsrId: string;
  current: DsrStatus;
}) {
  const [state, action, pending] = useActionState<TransitionDsrState, FormData>(
    transitionDsrStatus,
    undefined,
  );
  const allowed = DSR_TRANSITIONS[current] ?? [];

  const [next, setNext] = React.useState<string>(allowed[0] ?? "");
  // Keep the select in sync if the current status changes (revalidation).
  const [lastCurrent, setLastCurrent] = React.useState<string>(current);
  if (current !== lastCurrent) {
    setLastCurrent(current);
    setNext(allowed[0] ?? "");
  }

  if (allowed.length === 0) return null;

  return (
    <form action={action} className="mt-2 flex items-center gap-2 border-t border-hairline pt-3">
      <input type="hidden" name="dsrId" value={dsrId} />
      <div className="group/field relative inline-flex items-center rounded-full bg-foreground/[0.03] p-px ring-1 ring-hairline/70 transition-all duration-200 ease-soft focus-within:ring-hairline">
        <div className="relative flex items-center rounded-full bg-surface">
          <select
            aria-label="Advance DSR status"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={cn(
              "h-8 w-full appearance-none rounded-full bg-transparent pl-3 pr-7 text-[12px] font-medium text-foreground",
              "focus:outline-none",
            )}
          >
            {allowed.map((s) => (
              <option key={s} value={s}>
                {pretty(s)}
              </option>
            ))}
          </select>
          <ArrowFatDown
            aria-hidden
            weight="light"
            className="pointer-events-none absolute right-2.5 size-3 text-muted-foreground"
          />
        </div>
        <input type="hidden" name="toStatus" value={next} />
      </div>
      <Button type="submit" size="sm" variant="primary-gold" disabled={pending}>
        {pending ? "Advancing…" : "Advance"}
      </Button>
      {state?.error ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-down">
          <Warning weight="light" className="size-3" />
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

/* ================================================================== *
 * Local primitives - Field / BezelInput / BezelSelect (double-bezel).
 * ================================================================== */
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

function BezelInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="group/field rounded-xl bg-foreground/[0.02] p-px ring-1 ring-hairline/70 transition-all duration-200 ease-soft focus-within:ring-hairline">
      <input
        {...props}
        className={cn(
          "h-10 w-full rounded-[calc(0.75rem-1px)] bg-surface px-3.5 text-[13.5px] text-foreground",
          "placeholder:text-muted-foreground/60 focus:outline-none",
          className,
        )}
      />
    </div>
  );
}

function BezelSelect({
  id,
  name,
  value,
  onChange,
  options,
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <div className="group/field rounded-xl bg-foreground/[0.02] p-px ring-1 ring-hairline/70 transition-all duration-200 ease-soft focus-within:ring-hairline">
      <div className="relative flex items-center rounded-[calc(0.75rem-1px)] bg-surface">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-10 w-full appearance-none rounded-[calc(0.75rem-1px)] bg-transparent px-3.5 pr-8 text-[13.5px] text-foreground",
            "focus:outline-none",
          )}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {pretty(o)}
            </option>
          ))}
        </select>
        <ArrowFatDown
          aria-hidden
          weight="light"
          className="pointer-events-none absolute right-3 size-3 text-muted-foreground"
        />
      </div>
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}