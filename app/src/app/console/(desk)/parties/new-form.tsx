"use client";

import { useActionState } from "react";
import { createParty, type CreatePartyState } from "@/features/parties/actions";
import { CInput } from "@/console/primitives/input";
import { CButton } from "@/console/primitives/button";

export function NewPartyForm() {
  const [state, action, pending] = useActionState(
    createParty,
    undefined as CreatePartyState,
  );

  return (
    <form
      action={action}
      className="space-y-3 rounded-[var(--c-radius-lg)] bg-[var(--c-surface)] p-5 ring-1 ring-[var(--c-line)]"
    >
      <p className="text-[12px] text-[var(--c-ink-3)]">
        Adds a client to <strong>your book</strong> (you become owner). Brand is
        set from your desk (Capital / Bonds). Super admin is not required.
      </p>
      <CInput
        label="Legal name"
        name="legalName"
        required
        maxLength={200}
        placeholder="e.g. Acme Infra Pvt Ltd"
      />
      <CInput
        label="Display name"
        name="displayName"
        maxLength={200}
        placeholder="Optional short name"
      />
      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-[var(--c-ink-2)]">
        Nature
        <select
          name="partyNature"
          defaultValue="organization"
          className="h-11 rounded-[var(--c-radius)] bg-[var(--c-surface)] px-3 ring-1 ring-[var(--c-line-strong)]"
          required
        >
          <option value="organization">organization</option>
          <option value="natural_person">natural_person</option>
          <option value="spv">spv</option>
          <option value="trust">trust</option>
          <option value="government">government</option>
          <option value="regulator">regulator</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-[var(--c-ink-2)]">
        Type
        <select
          name="partyType"
          defaultValue="prospect"
          className="h-11 rounded-[var(--c-radius)] bg-[var(--c-surface)] px-3 ring-1 ring-[var(--c-line-strong)]"
          required
        >
          <option value="prospect">prospect</option>
          <option value="issuer">issuer</option>
          <option value="investor">investor</option>
          <option value="intermediary">intermediary</option>
          <option value="arranger">arranger</option>
          <option value="underwriter">underwriter</option>
          <option value="broker">broker</option>
          <option value="ifa">ifa</option>
        </select>
      </label>
      <CInput
        label="Country (ISO-2)"
        name="countryOfIncorporation"
        defaultValue="IN"
        maxLength={2}
      />
      <div className="grid grid-cols-2 gap-2">
        <CInput label="City" name="city" />
        <CInput label="State" name="state" />
      </div>
      {state?.error ? (
        <p className="text-[13px] text-[var(--c-bad)]" role="alert">
          {state.error}
        </p>
      ) : null}
      <CButton type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create party"}
      </CButton>
    </form>
  );
}
