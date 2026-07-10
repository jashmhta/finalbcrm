"use client";

import * as React from "react";
import { useActionState } from "react";

import { assignParty, type PartyActionState } from "@/features/parties/actions";
import { Button } from "@/components/brand";

export interface StaffOption {
  userId: string;
  email: string;
  label: string;
  desk: string | null;
}

export function AssignPartyForm({
  partyId,
  currentAssigneeId,
  staff,
}: {
  partyId: string;
  currentAssigneeId: string | null;
  staff: StaffOption[];
}) {
  const [state, formAction, pending] = useActionState(
    assignParty,
    undefined as PartyActionState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="partyId" value={partyId} />
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-muted-foreground">
          Assigned staff
        </span>
        <select
          name="assigneeUserId"
          defaultValue={currentAssigneeId ?? ""}
          className="h-9 rounded-md border border-hairline bg-surface px-2.5 text-[13px] text-foreground outline-none focus:ring-2 focus:ring-gold/40"
        >
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.userId} value={s.userId}>
              {s.email}
              {s.desk ? ` (${s.desk})` : ""}
            </option>
          ))}
        </select>
      </label>
      {state?.error ? (
        <p className="text-[12.5px] text-down" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="text-[12.5px] text-up" role="status">
          Assignment saved. A follow-up task was created for the assignee.
        </p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Assign"}
      </Button>
    </form>
  );
}
