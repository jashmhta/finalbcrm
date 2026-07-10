"use client";

// KYC lifecycle action forms - wires the existing compliance server actions
// (transitionKycStatus / setKycRiskRating / addBeneficialOwner) into the KYC
// detail page so the desk can actually advance a record through its lifecycle,
// re-rate risk, and attach beneficial owners without leaving the page.
//
// Each form posts via useActionState to a "use server" action in
// @/features/compliance/actions; on success the action revalidates
// /compliance/kyc/[id] so the page re-renders with the new status / risk / BO.
// Import discipline: actions come from the actions module (NOT the feature
// barrel, which re-exports queries → postgres → would break the client bundle);
// pure helpers + types come from ./kyc (no DB imports).

import * as React from "react";
import { useActionState } from "react";
import {
  ShieldCheck,
  ShieldWarning,
  XCircle,
  CheckCircle,
  Warning,
  Plus,
  ArrowRight,
  ArrowFatDown,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/brand/button";
import { Eyebrow } from "@/components/brand/text";
import { Badge } from "@/components/brand/badge";
import {
  transitionKycStatus,
  setKycRiskRating,
  addBeneficialOwner,
  type TransitionKycState,
  type SetKycRiskState,
  type AddBoState,
} from "@/features/compliance/actions";
import {
  allowedTransitions,
  type KycRisk,
  type KycStatus,
} from "@/features/compliance/kyc";

const fieldClass = cn(
  "h-10 w-full appearance-none rounded-xl bg-foreground/[0.03] px-3.5 text-[13px] text-foreground",
  "ring-1 ring-hairline/70 transition-all duration-200 ease-soft",
  "focus:bg-foreground/[0.05] focus:ring-hairline focus:outline-none",
  "placeholder:text-muted-foreground/70",
);

const labelClass =
  "text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground";

// Human label + tone per target status (the action button's appearance).
const TARGET_META: Record<
  KycStatus,
  { label: string; tone: "emerald" | "down" | "gold" | "neutral" }
> = {
  pending: { label: "Re-open as pending", tone: "neutral" },
  in_review: { label: "Send to review", tone: "neutral" },
  under_eds_check: { label: "Route to EDD", tone: "gold" },
  approved: { label: "Approve", tone: "emerald" },
  rejected: { label: "Reject", tone: "down" },
  expired: { label: "Mark expired", tone: "neutral" },
  rekyc_due: { label: "Mark re-KYC due", tone: "gold" },
};

export interface KycActionsProps {
  kycRecordId: string;
  currentStatus: KycStatus;
  currentRisk: KycRisk | null;
  /** Contacts on the party (for the beneficial-owner selector). */
  contacts: { contactId: string; fullName: string }[];
}

export function KycActions({
  kycRecordId,
  currentStatus,
  currentRisk,
  contacts,
}: KycActionsProps) {
  const allowed = allowedTransitions[currentStatus] ?? [];

  return (
    <div className="flex flex-col gap-6">
      <TransitionForm kycRecordId={kycRecordId} current={currentStatus} allowed={allowed} />
      <RiskForm kycRecordId={kycRecordId} current={currentRisk} />
      <AddBoForm kycRecordId={kycRecordId} contacts={contacts} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * TransitionForm - render one submit button per allowed next status.
 * The EDD target surfaces an inline reason input before the submit.
 *
 * Each target is its own <form> (so the toStatus hidden input is unambiguous),
 * but all share the one useActionState [action, pending, state] triple - the
 * action reference is stable, pending disables every button while any
 * submission is in flight, and state surfaces the last error.
 * ------------------------------------------------------------------ */
function TransitionForm({
  kycRecordId,
  current,
  allowed,
}: {
  kycRecordId: string;
  current: KycStatus;
  allowed: readonly KycStatus[];
}) {
  const [state, action, pending] = useActionState<TransitionKycState, FormData>(
    transitionKycStatus,
    undefined,
  );
  const [eddArmed, setEddArmed] = React.useState(false);

  if (allowed.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <Eyebrow dot>Lifecycle actions</Eyebrow>
        <p className="text-[12.5px] text-muted-foreground">
          Status <span className="text-foreground/80">{current.replace(/_/g, " ")}</span>{" "}
          has no forward transitions available.
        </p>
      </div>
    );
  }

  const eddAllowed = allowed.includes("under_eds_check");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Eyebrow dot>Lifecycle actions</Eyebrow>
        <Badge variant="neutral">{current.replace(/_/g, " ")}</Badge>
      </div>

      {/* EDD reason - surfaced when the analyst arms the EDD transition. */}
      {eddAllowed && eddArmed ? (
        <form action={action} className="flex flex-col gap-2 rounded-xl bg-foreground/[0.02] p-3 ring-1 ring-hairline/60">
          <input type="hidden" name="kycRecordId" value={kycRecordId} />
          <input type="hidden" name="toStatus" value="under_eds_check" />
          <label htmlFor="eddReason" className={labelClass}>
            EDD reason
          </label>
          <input
            id="eddReason"
            name="eddReason"
            type="text"
            maxLength={1000}
            placeholder="e.g. PEP confirmed; BO > 10%; high risk rating"
            className={fieldClass}
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setEddArmed(false)}
              className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
            <Button
              type="submit"
              variant="primary-gold"
              size="sm"
              disabled={pending}
              leadingIcon={<ShieldWarning weight="light" className="size-3.5" />}
            >
              {pending ? "Routing…" : "Route to EDD"}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {allowed.map((target) => {
          const meta = TARGET_META[target];
          const isEdd = target === "under_eds_check";
          const variant =
            meta.tone === "emerald"
              ? "primary-gold"
              : meta.tone === "down"
                ? "primary-gold"
                : "secondary-hairline";
          const icon =
            meta.tone === "emerald" ? (
              <CheckCircle weight="light" className="size-3.5" />
            ) : meta.tone === "down" ? (
              <XCircle weight="light" className="size-3.5" />
            ) : meta.tone === "gold" ? (
              <ShieldWarning weight="light" className="size-3.5" />
            ) : (
              <ShieldCheck weight="light" className="size-3.5" />
            );

          // The EDD button arms the reason panel instead of submitting
          // immediately, so the analyst records the reason first.
          if (isEdd) {
            return (
              <Button
                key={target}
                type="button"
                variant={variant}
                size="sm"
                disabled={pending || eddArmed}
                onClick={() => setEddArmed(true)}
                leadingIcon={icon}
              >
                {meta.label}
              </Button>
            );
          }

          return (
            <form key={target} action={action} className="inline-flex">
              <input type="hidden" name="kycRecordId" value={kycRecordId} />
              <input type="hidden" name="toStatus" value={target} />
              <Button
                type="submit"
                variant={variant}
                size="sm"
                disabled={pending}
                leadingIcon={icon}
              >
                {meta.label}
              </Button>
            </form>
          );
        })}
      </div>

      {state?.error ? (
        <p className="inline-flex items-center gap-1.5 text-[12.5px] text-down">
          <Warning weight="light" className="size-4" />
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * RiskForm - re-rate a KYC record's risk (low / medium / high).
 * ------------------------------------------------------------------ */
function RiskForm({
  kycRecordId,
  current,
}: {
  kycRecordId: string;
  current: KycRisk | null;
}) {
  const [state, action, pending] = useActionState<SetKycRiskState, FormData>(
    setKycRiskRating,
    undefined,
  );
  const [risk, setRisk] = React.useState<string>(current ?? "medium");

  return (
    <form action={action} className="flex flex-col gap-2">
      <Eyebrow dot>Risk rating</Eyebrow>
      <div className="flex items-center gap-2.5">
        <input type="hidden" name="kycRecordId" value={kycRecordId} />
        <div className="group/field relative inline-flex items-center rounded-full bg-foreground/[0.03] p-px ring-1 ring-hairline/70 transition-all duration-200 ease-soft focus-within:ring-hairline">
          <div className="relative flex items-center rounded-full bg-surface">
            <select
              aria-label="Risk rating"
              value={risk}
              onChange={(e) => setRisk(e.target.value)}
              className={cn(
                "h-9 w-full appearance-none rounded-full bg-transparent pl-3.5 pr-8 text-[12.5px] font-medium text-foreground",
                "focus:outline-none",
              )}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
            <ArrowFatDown
              aria-hidden
              weight="light"
              className="pointer-events-none absolute right-3 size-3 text-muted-foreground"
            />
          </div>
          <input type="hidden" name="riskRating" value={risk} />
        </div>
        <Button
          type="submit"
          size="sm"
          variant="primary-gold"
          disabled={pending || risk === (current ?? "")}
        >
          {pending ? "Saving…" : "Re-rate"}
        </Button>
      </div>
      {state?.error ? (
        <p className="text-[12px] text-down">{state.error}</p>
      ) : null}
      <p className="text-[11.5px] text-muted-foreground">
        Recomputes the periodic-refresh schedule (valid until / re-KYC due) from
        the new rating; escalates to EDD when the inputs warrant it.
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * AddBoForm - attach a beneficial owner (kyc_beneficial_owner junction).
 *  The contact selector is seeded from the party's party_contact rows.
 * ------------------------------------------------------------------ */
function AddBoForm({
  kycRecordId,
  contacts,
}: {
  kycRecordId: string;
  contacts: { contactId: string; fullName: string }[];
}) {
  const [state, action, pending] = useActionState<AddBoState, FormData>(
    addBeneficialOwner,
    undefined,
  );
  const [open, setOpen] = React.useState(false);
  const [contactId, setContactId] = React.useState("");

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <Eyebrow dot>Beneficial owners</Eyebrow>
        <Button
          type="button"
          variant="secondary-hairline"
          size="sm"
          onClick={() => setOpen(true)}
          leadingIcon={<Plus weight="light" className="size-3.5" />}
          disabled={contacts.length === 0}
        >
          Add beneficial owner
        </Button>
        {contacts.length === 0 ? (
          <p className="text-[11.5px] text-muted-foreground">
            No contacts on this party - add a contact first.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl bg-foreground/[0.02] p-4 ring-1 ring-hairline/60">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow dot>Add beneficial owner</Eyebrow>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      <input type="hidden" name="kycRecordId" value={kycRecordId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="contactId" className={labelClass}>
          Contact
        </label>
        <FieldSelect
          id="contactId"
          name="contactId"
          required
          value={contactId}
          onChange={setContactId}
          options={contacts.map((c) => ({ value: c.contactId, label: c.fullName }))}
          placeholder="Select a contact…"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ownershipPct" className={labelClass}>
            Ownership %
          </label>
          <input
            id="ownershipPct"
            name="ownershipPct"
            type="number"
            min={0}
            max={100}
            step={0.01}
            placeholder="12.5"
            className={cn(fieldClass, "font-mono tabular-nums")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="relationshipPath" className={labelClass}>
            Relationship path
          </label>
          <input
            id="relationshipPath"
            name="relationshipPath"
            type="text"
            maxLength={500}
            placeholder="Sub A → Holdco B → Target"
            className={fieldClass}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary-gold"
          size="sm"
          disabled={pending || !contactId}
          trailingIcon={<ArrowRight weight="light" className="size-3.5" />}
        >
          {pending ? "Adding…" : "Add owner"}
        </Button>
      </div>
      {state?.error ? (
        <p className="text-[12px] text-down">{state.error}</p>
      ) : null}
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * FieldSelect - native <select> with the double-bezel hairline + chevron.
 * ------------------------------------------------------------------ */
function FieldSelect({
  id,
  name,
  value,
  onChange,
  options,
  required,
  placeholder,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="group/field rounded-xl bg-foreground/[0.02] p-px ring-1 ring-hairline/70 transition-all duration-200 ease-soft focus-within:ring-hairline">
      <div className="relative flex items-center rounded-[calc(0.75rem-1px)] bg-surface">
        <select
          id={id}
          value={value}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-10 w-full appearance-none rounded-[calc(0.75rem-1px)] bg-transparent px-3.5 pr-8 text-[13px] text-foreground",
            "focus:outline-none",
          )}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ArrowFatDown
          aria-hidden
          weight="light"
          className="pointer-events-none absolute right-3 size-3 text-muted-foreground"
        />
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}