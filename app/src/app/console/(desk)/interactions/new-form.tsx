"use client";

import { useActionState } from "react";
import {
  createInteraction,
  type CreateInteractionState,
} from "@/features/interactions/actions";
import { CInput } from "@/console/primitives/input";
import { CButton } from "@/console/primitives/button";

export function NewInteractionForm() {
  const [state, action, pending] = useActionState(
    createInteraction,
    undefined as CreateInteractionState,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="redirectTo" value="/console/interactions" />
      <CInput label="Subject" name="subject" required />
      <label className="flex flex-col gap-1 text-[12px] font-medium text-[var(--c-ink-2)]">
        Channel
        <select
          name="channel"
          defaultValue="call"
          className="h-10 rounded-[var(--c-radius)] px-2 ring-1 ring-[var(--c-line-strong)]"
        >
          <option value="call">call</option>
          <option value="meeting">meeting</option>
          <option value="email">email</option>
          <option value="whatsapp">whatsapp</option>
          <option value="site_visit">site_visit</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[12px] font-medium text-[var(--c-ink-2)]">
        Direction
        <select
          name="direction"
          defaultValue="outbound"
          className="h-10 rounded-[var(--c-radius)] px-2 ring-1 ring-[var(--c-line-strong)]"
        >
          <option value="outbound">outbound</option>
          <option value="inbound">inbound</option>
        </select>
      </label>
      <CInput
        label="Party ID (uuid)"
        name="partyId"
        hint="Required unless deal/contact set - use party detail later for pickers."
      />
      <CInput label="Body" name="body" />
      <CInput label="Next action" name="nextAction" />
      {state?.error ? (
        <p className="text-[12px] text-[var(--c-bad)]">{state.error}</p>
      ) : null}
      <CButton type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Log interaction"}
      </CButton>
    </form>
  );
}
