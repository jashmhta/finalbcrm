"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createUser, updateUser } from "@/features/admin/actions";
import { assignParty } from "@/features/parties/actions";
import { CButton } from "@/console/primitives/button";
import { CInput } from "@/console/primitives/input";

const DESKS = [
  "ib_advisory",
  "bond_underwriting",
  "gsec_trading",
  "secondary_mm",
  "portfolio_mgmt",
  "credit",
  "rating_advisory",
  "operations",
  "compliance",
  "management",
] as const;

export function CreateUserForm({ roleNames }: { roleNames: string[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createUser, undefined);

  return (
    <form
      action={async (fd) => {
        await action(fd);
        router.refresh();
      }}
      className="space-y-3"
    >
      <CInput
        label="Work email"
        name="email"
        type="email"
        required
        placeholder="name@binarycapital.in"
      />
      <CInput
        label="Temporary password"
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        hint="Min 8 characters. User can sign in immediately."
      />
      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-[var(--c-ink-2)]">
        Desk
        <select
          name="desk"
          required
          className="h-11 rounded-[var(--c-radius)] bg-[var(--c-surface)] px-3 text-[13px] ring-1 ring-[var(--c-line-strong)]"
          defaultValue="ib_advisory"
        >
          {DESKS.map((d) => (
            <option key={d} value={d}>
              {d.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="space-y-1.5">
        <legend className="text-[12px] font-medium text-[var(--c-ink-2)]">
          Roles
        </legend>
        <div className="flex max-h-36 flex-col gap-1 overflow-y-auto rounded-[var(--c-radius)] p-2 ring-1 ring-[var(--c-line)]">
          {roleNames.map((r) => (
            <label
              key={r}
              className="flex items-center gap-2 text-[12px] text-[var(--c-ink)]"
            >
              <input type="checkbox" name="roleNames" value={r} className="size-3.5" />
              {r}
            </label>
          ))}
        </div>
      </fieldset>
      <input type="hidden" name="isActive" value="true" />
      {state?.error ? (
        <p className="text-[12px] text-[var(--c-bad)]" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.userId ? (
        <p className="text-[12px] text-[var(--c-ok)]">
          User created. They can sign in with the password you set.
        </p>
      ) : null}
      <CButton type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating…" : "Create user & credentials"}
      </CButton>
    </form>
  );
}

export function ResetPasswordForm({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateUser, undefined);

  return (
    <form
      action={async (fd) => {
        // Password-only: must NOT include rolesSync/barriersSync so RBAC is preserved.
        await action(fd);
        router.refresh();
      }}
      className="space-y-2"
    >
      <input type="hidden" name="userId" value={userId} />
      <CInput
        label={`Reset password · ${email}`}
        name="password"
        type="password"
        minLength={8}
        required
        placeholder="New password (min 8)"
        autoComplete="new-password"
      />
      <CButton type="submit" size="sm" disabled={pending}>
        {pending ? "…" : "Set password"}
      </CButton>
      {state?.error ? (
        <p className="text-[11px] text-[var(--c-bad)]">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-[11px] text-[var(--c-ok)]">Password updated.</p>
      ) : null}
    </form>
  );
}

/** Grant/revoke roles on an existing user (explicit rolesSync sentinel). */
export function EditRolesForm({
  userId,
  email,
  allRoleNames,
  currentRoleNames,
}: {
  userId: string;
  email: string;
  allRoleNames: string[];
  currentRoleNames: string[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateUser, undefined);
  const current = new Set(currentRoleNames);

  return (
    <form
      action={async (fd) => {
        await action(fd);
        router.refresh();
      }}
      className="space-y-2 border-t border-[var(--c-line)] pt-2"
    >
      <input type="hidden" name="userId" value={userId} />
      {/* Sentinel: presence means replace role grants (empty checkboxes = revoke all). */}
      <input type="hidden" name="rolesSync" value="1" />
      <p className="text-[11px] font-medium text-[var(--c-ink-2)]">
        Roles · {email}
      </p>
      <div className="flex max-h-28 flex-col gap-1 overflow-y-auto rounded-[var(--c-radius)] p-2 ring-1 ring-[var(--c-line)]">
        {allRoleNames.map((r) => (
          <label
            key={r}
            className="flex items-center gap-2 text-[12px] text-[var(--c-ink)]"
          >
            <input
              type="checkbox"
              name="roleNames"
              value={r}
              defaultChecked={current.has(r)}
              className="size-3.5"
            />
            {r}
          </label>
        ))}
      </div>
      <CButton type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save roles"}
      </CButton>
      {state?.error ? (
        <p className="text-[11px] text-[var(--c-bad)]">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-[11px] text-[var(--c-ok)]">Roles updated.</p>
      ) : null}
    </form>
  );
}

export function AssignPartyForm({
  users,
  parties,
}: {
  users: { userId: string; email: string }[];
  parties: { partyId: string; legalName: string }[];
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
          const res = await assignParty(undefined, fd);
          if (res?.error) {
            setError(res.error);
            return;
          }
          setOk(true);
          router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-[var(--c-ink-2)]">
        Client / party
        <select
          name="partyId"
          required
          className="h-11 rounded-[var(--c-radius)] bg-[var(--c-surface)] px-3 text-[13px] ring-1 ring-[var(--c-line-strong)]"
          defaultValue=""
        >
          <option value="" disabled>
            Select party
          </option>
          {parties.map((p) => (
            <option key={p.partyId} value={p.partyId}>
              {p.legalName}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-[var(--c-ink-2)]">
        Assign to user
        <select
          name="assigneeUserId"
          required
          className="h-11 rounded-[var(--c-radius)] bg-[var(--c-surface)] px-3 text-[13px] ring-1 ring-[var(--c-line-strong)]"
          defaultValue=""
        >
          <option value="" disabled>
            Select user
          </option>
          {users.map((u) => (
            <option key={u.userId} value={u.userId}>
              {u.email}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <p className="text-[12px] text-[var(--c-bad)]" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="text-[12px] text-[var(--c-ok)]">
          Party assigned. Follow-up task created for the assignee.
        </p>
      ) : null}
      <CButton
        type="submit"
        className="w-full"
        disabled={pending || parties.length === 0}
      >
        {pending ? "Assigning…" : "Assign client to user"}
      </CButton>
    </form>
  );
}
