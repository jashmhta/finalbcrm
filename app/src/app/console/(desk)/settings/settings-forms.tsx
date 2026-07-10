"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  superClearClientData,
  superDeleteParty,
  superUpdateParty,
  type SettingsActionState,
} from "@/features/settings/actions";
import { CButton } from "@/console/primitives/button";

type PartyOpt = {
  partyId: string;
  legalName: string | null;
  status: string | null;
  brandOrigin: string | null;
};

export function SettingsForms({
  mode,
  parties,
}: {
  mode: "edit" | "clear";
  parties: PartyOpt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<SettingsActionState | null>(null);

  if (mode === "clear") {
    return (
      <div className="space-y-6">
        {(
          [
            {
              scope: "mock",
              title: "Clear MOCK clients",
              phrase: "CLEAR MOCK",
              desc: "Removes MOCK-* seeded demo rows only.",
            },
            {
              scope: "scale",
              title: "Clear scale seed (20k)",
              phrase: "CLEAR SCALE",
              desc: "Removes seed-scale parties + SCALE deals/interactions.",
            },
            {
              scope: "all_clients",
              title: "Wipe ALL clients",
              phrase: "DELETE ALL CLIENTS",
              desc: "Soft-deletes every party in the database. Extremely destructive.",
            },
          ] as const
        ).map((cfg) => (
          <form
            key={cfg.scope}
            className="space-y-2 rounded-[var(--c-radius)] bg-[var(--c-surface-2)]/60 p-3 ring-1 ring-[var(--c-line)]"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              start(async () => {
                const res = await superClearClientData(undefined, fd);
                setState(res);
                if (res.ok) router.refresh();
              });
            }}
          >
            <p className="text-[13px] font-semibold text-[var(--c-ink)]">
              {cfg.title}
            </p>
            <p className="text-[11px] text-[var(--c-ink-3)]">{cfg.desc}</p>
            <input type="hidden" name="scope" value={cfg.scope} />
            <label className="block text-[11px] font-medium text-[var(--c-ink-2)]">
              Type <code className="font-mono">{cfg.phrase}</code>
              <input
                name="confirm"
                required
                className="mt-1 h-9 w-full rounded-[var(--c-radius)] bg-[var(--c-surface)] px-3 text-[12px] ring-1 ring-[var(--c-line-strong)]"
                autoComplete="off"
              />
            </label>
            <label className="block text-[11px] font-medium text-[var(--c-ink-2)]">
              Your password
              <input
                type="password"
                name="password"
                required
                className="mt-1 h-9 w-full rounded-[var(--c-radius)] bg-[var(--c-surface)] px-3 text-[12px] ring-1 ring-[var(--c-line-strong)]"
              />
            </label>
            <CButton
              type="submit"
              variant="danger"
              size="sm"
              disabled={pending}
              className="w-full"
            >
              {pending ? "Working…" : cfg.title}
            </CButton>
          </form>
        ))}
        <Result state={state} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const res = await superUpdateParty(undefined, fd);
            setState(res);
            if (res.ok) router.refresh();
          });
        }}
      >
        <p className="text-[12px] font-semibold">Edit client</p>
        <PartySelect parties={parties} />
        <label className="block text-[11px] font-medium">
          Legal name
          <input
            name="legalName"
            required
            className="mt-1 h-9 w-full rounded-[var(--c-radius)] bg-[var(--c-surface)] px-3 text-[12px] ring-1 ring-[var(--c-line-strong)]"
          />
        </label>
        <label className="block text-[11px] font-medium">
          Status
          <select
            name="status"
            defaultValue="active"
            className="mt-1 h-9 w-full rounded-[var(--c-radius)] bg-[var(--c-surface)] px-3 text-[12px] ring-1 ring-[var(--c-line-strong)]"
          >
            {["active", "onboarding", "dormant", "closed", "blacklisted"].map(
              (s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="block text-[11px] font-medium">
          Brand origin
          <select
            name="brandOrigin"
            defaultValue="shared"
            className="mt-1 h-9 w-full rounded-[var(--c-radius)] bg-[var(--c-surface)] px-3 text-[12px] ring-1 ring-[var(--c-line-strong)]"
          >
            <option value="binarycapital">Binary Capital</option>
            <option value="binarybonds">Binary Bonds</option>
            <option value="shared">Shared</option>
          </select>
        </label>
        <label className="block text-[11px] font-medium">
          Password
          <input
            type="password"
            name="password"
            required
            className="mt-1 h-9 w-full rounded-[var(--c-radius)] bg-[var(--c-surface)] px-3 text-[12px] ring-1 ring-[var(--c-line-strong)]"
          />
        </label>
        <CButton type="submit" size="sm" disabled={pending} className="w-full">
          {pending ? "Saving…" : "Save changes"}
        </CButton>
      </form>

      <form
        className="space-y-2 border-t border-[var(--c-line)] pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const res = await superDeleteParty(undefined, fd);
            setState(res);
            if (res.ok) router.refresh();
          });
        }}
      >
        <p className="text-[12px] font-semibold text-[var(--c-bad)]">
          Soft-delete client
        </p>
        <PartySelect parties={parties} />
        <label className="block text-[11px] font-medium">
          Password
          <input
            type="password"
            name="password"
            required
            className="mt-1 h-9 w-full rounded-[var(--c-radius)] bg-[var(--c-surface)] px-3 text-[12px] ring-1 ring-[var(--c-line-strong)]"
          />
        </label>
        <CButton
          type="submit"
          variant="danger"
          size="sm"
          disabled={pending}
          className="w-full"
        >
          {pending ? "Deleting…" : "Soft-delete client"}
        </CButton>
      </form>
      <Result state={state} />
    </div>
  );
}

function PartySelect({ parties }: { parties: PartyOpt[] }) {
  return (
    <label className="block text-[11px] font-medium">
      Client
      <select
        name="partyId"
        required
        defaultValue=""
        className="mt-1 h-9 w-full rounded-[var(--c-radius)] bg-[var(--c-surface)] px-3 text-[12px] ring-1 ring-[var(--c-line-strong)]"
      >
        <option value="" disabled>
          Select party
        </option>
        {parties.map((p) => (
          <option key={p.partyId} value={p.partyId}>
            {p.legalName} ({p.brandOrigin})
          </option>
        ))}
      </select>
    </label>
  );
}

function Result({ state }: { state: SettingsActionState | null }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p className="text-[12px] text-[var(--c-bad)]" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p className="text-[12px] text-[var(--c-ok)]">
        {state.message}
        {state.deleted != null ? ` (${state.deleted})` : ""}
      </p>
    );
  }
  return null;
}
