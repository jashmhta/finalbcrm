"use client";

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
import { X, Plus, ArrowRight, CircleNotch } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/brand/button";
import { Eyebrow } from "@/components/brand/text";
import { createParty, type CreatePartyState } from "@/features/parties/actions";

const PARTY_NATURES = [
  "organization",
  "natural_person",
  "spv",
  "trust",
  "government",
  "regulator",
] as const;

const PARTY_TYPES = [
  "issuer",
  "investor",
  "intermediary",
  "arranger",
  "underwriter",
  "broker",
  "ifa",
  "rating_agency",
  "trustee",
  "registrar",
  "legal_counsel",
  "auditor",
  "guarantor",
  "credit_enhancement_provider",
  "spv",
  "prospect",
] as const;

/**
 * "New party" dialog. Submits a native form to the createParty server action
 * via useActionState; on success the action redirects to the new party's
 * detail page. The hidden inputs forward the Select values (the trigger is a
 * bespoke double-bezel-flavoured control rendered from a styled native
 * <select> for accessibility + keyboard support; the value is mirrored into a
 * hidden input so the FormData carries it).
 *
 * Restyled as a double-bezel Dialog: outer shell hairline + inner core surface,
 * eyebrow header, mono inputs, gold primary CTA with a button-in-button
 * trailing arrow. Preserves useActionState + zod validation verbatim.
 */
export function NewPartyDialog() {
  const [state, action, pending] = useActionState<CreatePartyState, FormData>(
    createParty,
    undefined,
  );
  const [open, setOpen] = React.useState(false);
  const [nature, setNature] = React.useState<string>("organization");
  const [type, setType] = React.useState<string>("issuer");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="primary-gold" size="md" trailingIcon={<Plus weight="light" />}>
            New party
          </Button>
        }
      />
      <DialogContent
        className={cn(
          // Reset the shadcn defaults and rebuild as a double-bezel.
          // max-w-[calc(100%-2rem)] keeps a 16px gutter on phones so the dialog
          // never pins to the screen edges; sm:max-w-[560px] restores the
          // fixed desktop width.
          "max-w-[calc(100%-2rem)] gap-0 rounded-[1.5rem] border-0 bg-transparent p-0 ring-0",
          "sm:max-w-[560px]",
        )}
      >
        {/* Outer shell */}
        <div className="rounded-[1.5rem] bg-white/[0.02] p-1.5 ring-1 ring-hairline shadow-floating">
          {/* Inner core */}
          <div className="bezel-hi overflow-hidden rounded-[calc(1.5rem-0.375rem)] bg-surface">
            <form action={action} className="flex flex-col gap-6 p-6">
              {/* Header band */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <Eyebrow dot>Party master</Eyebrow>
                  <DialogTitle className="text-[1.5rem] font-light tracking-[-0.02em] leading-tight text-foreground">
                    New party
                  </DialogTitle>
                  <DialogDescription className="text-[13px] text-muted-foreground">
                    Create a master record with a primary type and address.
                  </DialogDescription>
                </div>
                <DialogClose
                  render={
                    <button
                      type="button"
                      aria-label="Close"
                      className={cn(
                        // size-11 (44px) on mobile for a confident thumb tap;
                        // md:size-8 restores the compact desktop close button.
                        "inline-flex size-11 md:size-8 items-center justify-center rounded-full",
                        "text-muted-foreground ring-1 ring-hairline transition-all duration-200 ease-soft",
                        "hover:bg-foreground/5 hover:text-foreground active:scale-[0.96]",
                      )}
                    />
                  }
                >
                  <X weight="light" className="size-4" />
                </DialogClose>
              </div>

              {/* Fields */}
              <div className="flex flex-col gap-4">
                <Field label="Legal name" htmlFor="legalName" required>
                  <BezelInput
                    id="legalName"
                    name="legalName"
                    required
                    placeholder="Acme Industries Ltd."
                  />
                </Field>

                <Field label="Display name" htmlFor="displayName" hint="Optional">
                  <BezelInput
                    id="displayName"
                    name="displayName"
                    placeholder="Acme"
                  />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Nature" htmlFor="partyNature">
                    <BezelSelect
                      id="partyNature"
                      value={nature}
                      onChange={setNature}
                      options={PARTY_NATURES}
                      name="partyNature"
                    />
                  </Field>
                  <Field label="Primary type" htmlFor="partyType">
                    <BezelSelect
                      id="partyType"
                      value={type}
                      onChange={setType}
                      options={PARTY_TYPES}
                      name="partyType"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="City" htmlFor="city">
                    <BezelInput id="city" name="city" placeholder="Mumbai" />
                  </Field>
                  <Field label="State" htmlFor="state">
                    <BezelInput id="state" name="state" placeholder="MH" />
                  </Field>
                </div>

                <input type="hidden" name="countryOfIncorporation" value="IN" />
              </div>

              {/* Error + footer */}
              {state?.error ? (
                <p
                  role="alert"
                  className="rounded-xl bg-down/10 px-3.5 py-2.5 text-[12.5px] font-medium text-down ring-1 ring-down/25"
                >
                  {state.error}
                </p>
              ) : null}

              <div className="flex flex-col gap-2.5 border-t border-hairline pt-5 sm:flex-row sm:items-center sm:justify-end">
                <DialogClose
                  render={
                    <Button
                      variant="ghost"
                      size="md"
                      type="button"
                      className="w-full h-11 sm:w-auto md:h-9.5"
                    >
                      Cancel
                    </Button>
                  }
                />
                <Button
                  type="submit"
                  variant="primary-gold"
                  size="md"
                  disabled={pending}
                  className="w-full h-11 sm:w-auto md:h-9.5"
                  leadingIcon={
                    pending ? (
                      <CircleNotch weight="light" className="size-4 animate-spin" />
                    ) : undefined
                  }
                  trailingIcon={
                    pending ? undefined : <ArrowRight weight="light" className="size-4" />
                  }
                >
                  {pending ? "Creating…" : "Create party"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Field wrapper - eyebrow label + hint, used in the dialog body. */
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

/**
 * BezelInput - outer hairline ring + inner field surface, the form-control
 * equivalent of the double-bezel Card. Focus tightens the ring to hairline
 * and lifts the inner bg.
 */
function BezelInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="group/field rounded-xl bg-foreground/[0.02] p-px ring-1 ring-hairline/70 transition-all duration-200 ease-soft focus-within:ring-hairline">
      <input
        {...props}
        className={cn(
          // h-11 (44px) meets the touch target floor for form fields on phones.
          "h-11 w-full rounded-[calc(0.75rem-1px)] bg-surface px-3.5 text-[13.5px] text-foreground",
          "placeholder:text-muted-foreground/60 focus:outline-none",
          className,
        )}
      />
    </div>
  );
}

/**
 * BezelSelect - styled native <select> in the same hairline shell as BezelInput.
 * The value is mirrored into a hidden input (the same trick the original used
 * for the shadcn Select) so FormData carries it into the server action.
 */
function BezelSelect({
  id,
  name,
  value,
  onChange,
  options,
}: {
  id: string;
  name: string;
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
            // h-11 (44px) meets the touch target floor for form fields on phones.
            "h-11 w-full appearance-none rounded-[calc(0.75rem-1px)] bg-transparent px-3.5 pr-8 text-[13.5px] text-foreground",
            "focus:outline-none",
          )}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o.replace(/_/g, " ")}
            </option>
          ))}
        </select>
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
      <input type="hidden" name={name} value={value} />
    </div>
  );
}