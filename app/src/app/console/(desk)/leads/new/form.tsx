"use client";

import { useActionState } from "react";
import { createLead, type CreateLeadState } from "@/features/leads/actions";
import { CInput } from "@/console/primitives/input";
import { CButton } from "@/console/primitives/button";

export function NewLeadForm() {
  const [state, action, pending] = useActionState(
    async (_prev: CreateLeadState, fd: FormData) => {
      // createLead redirects to /leads/[id] on success - we set a flag after
      // and prefer console by posting through a wrapper if needed.
      const result = await createLead(_prev, fd);
      return result;
    },
    undefined as CreateLeadState,
  );

  return (
    <form
      action={action}
      className="mx-auto max-w-lg space-y-4 rounded-[var(--c-radius-lg)] bg-[var(--c-surface)] p-6 ring-1 ring-[var(--c-line)]"
    >
      <input type="hidden" name="mode" value="new" />
      <input type="hidden" name="redirectTo" value="/console/leads" />
      <CInput label="Company name" name="companyName" required maxLength={200} />
      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-[var(--c-ink-2)]">
        Source
        <select
          name="source"
          className="h-11 rounded-[var(--c-radius)] bg-[var(--c-surface)] px-3 ring-1 ring-[var(--c-line-strong)]"
          defaultValue="referral"
        >
          <option value="referral">Referral</option>
          <option value="website">Website</option>
          <option value="event">Event</option>
          <option value="cold_call">Cold call</option>
          <option value="existing_client">Existing client</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-[var(--c-ink-2)]">
        Deal type
        <select
          name="dealType"
          className="h-11 rounded-[var(--c-radius)] bg-[var(--c-surface)] px-3 ring-1 ring-[var(--c-line-strong)]"
          defaultValue="bond_underwriting"
        >
          <option value="bond_underwriting">Bond underwriting</option>
          <option value="private_placement_debt">Private placement</option>
          <option value="gsec_auction">G-Sec auction</option>
          <option value="m_and_a">M&A</option>
          <option value="rating_advisory">Rating advisory</option>
          <option value="dcm_advisory">DCM advisory</option>
        </select>
      </label>
      <CInput
        label="Est. size (₹ Cr)"
        name="estSizeCr"
        type="number"
        step="0.01"
      />
      <CInput label="Contact name" name="contactName" />
      <CInput label="Contact email" name="contactEmail" type="email" />
      <CInput label="Contact phone" name="contactPhone" />
      <CInput label="Notes" name="notes" />
      {state?.error ? (
        <p className="text-[13px] text-[var(--c-bad)]" role="alert">
          {state.error}
        </p>
      ) : null}
      <CButton type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Create lead"}
      </CButton>
    </form>
  );
}
