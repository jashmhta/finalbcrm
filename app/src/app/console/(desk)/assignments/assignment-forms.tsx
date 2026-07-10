"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  requestPartyAssignment,
  reviewPartyAssignment,
} from "@/features/parties/actions";
import { CButton } from "@/console/primitives/button";

export function AssignmentRequestForm({
  parties,
  users,
}: {
  parties: { partyId: string; legalName: string; assignedUserId?: string | null }[];
  users: { userId: string; email: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          setError(null);
          setOk(false);
          const res = await requestPartyAssignment(undefined, fd);
          if (res?.error) {
            setError(res.error);
            return;
          }
          setOk(true);
          (e.target as HTMLFormElement).reset();
          router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-[var(--c-ink-2)]">
        Client
        <select
          name="partyId"
          required
          className="h-11 rounded-[var(--c-radius)] bg-[var(--c-bg)] px-3 text-[13px] ring-1 ring-[var(--c-line-strong)]"
          defaultValue=""
        >
          <option value="" disabled>
            Select client
          </option>
          {parties.map((p) => (
            <option key={p.partyId} value={p.partyId}>
              {p.legalName}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-[var(--c-ink-2)]">
        Assign to staff
        <select
          name="toUserId"
          required
          className="h-11 rounded-[var(--c-radius)] bg-[var(--c-bg)] px-3 text-[13px] ring-1 ring-[var(--c-line-strong)]"
          defaultValue=""
        >
          <option value="" disabled>
            Select staff
          </option>
          {users.map((u) => (
            <option key={u.userId} value={u.userId}>
              {u.email}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-[var(--c-ink-2)]">
        Note (optional)
        <input
          name="note"
          className="h-11 rounded-[var(--c-radius)] bg-[var(--c-bg)] px-3 text-[13px] ring-1 ring-[var(--c-line-strong)]"
          placeholder="Reason for handoff"
        />
      </label>
      {error ? (
        <p className="text-[12px] text-[var(--c-bad)]" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="text-[12px] text-[var(--c-ok)]">
          Request submitted for super-admin approval.
        </p>
      ) : null}
      <CButton type="submit" className="w-full" disabled={pending}>
        {pending ? "Submitting…" : "Submit for approval"}
      </CButton>
    </form>
  );
}

export function ReviewAssignmentForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(decision: "approve" | "reject") {
    const fd = new FormData();
    fd.set("requestId", requestId);
    fd.set("decision", decision);
    start(async () => {
      setError(null);
      const res = await reviewPartyAssignment(undefined, fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CButton
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => decide("approve")}
        data-testid="assign-approve"
      >
        ✓ Approve
      </CButton>
      <CButton
        type="button"
        size="sm"
        variant="danger"
        disabled={pending}
        data-testid="assign-reject"
        onClick={() => decide("reject")}
      >
        Reject
      </CButton>
      {error ? (
        <p className="w-full text-[11px] text-[var(--c-bad)]">{error}</p>
      ) : null}
    </div>
  );
}
