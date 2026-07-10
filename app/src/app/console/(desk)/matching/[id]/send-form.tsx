"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendToDeal } from "@/features/matching/actions";
import { CButton } from "@/console/primitives/button";
import { CInput } from "@/console/primitives/input";

export function SendToDealForm({
  issuerId,
  defaultDealName,
  defaultSize,
  defaultTenor,
  topInvestors,
  existingDealId,
}: {
  issuerId: string;
  defaultDealName: string;
  defaultSize: number;
  defaultTenor: number;
  topInvestors: { partyId: string; legalName: string; score: number }[];
  existingDealId: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(topInvestors.slice(0, 5).map((i) => i.partyId)),
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const investors = Array.from(selected).map((partyId) => ({
          partyId,
          commitmentCrores: Number(fd.get(`c_${partyId}`)) || undefined,
        }));
        start(async () => {
          setError(null);
          const res = await sendToDeal({
            issuerId,
            existingDealId: existingDealId ?? undefined,
            dealName: String(fd.get("dealName") || defaultDealName),
            dealType: "bond_underwriting",
            targetSizeCrores: Number(fd.get("targetSizeCrores") || defaultSize),
            targetTenorYears: Number(fd.get("targetTenorYears") || defaultTenor),
            investors,
          });
          if (!res.ok) {
            setError(res.error);
            return;
          }
          router.push(`/console/deals/${res.dealId}`);
          router.refresh();
        });
      }}
    >
      <CInput
        label="Deal name"
        name="dealName"
        defaultValue={defaultDealName}
        required
      />
      <div className="grid grid-cols-2 gap-2">
        <CInput
          label="Size (₹ Cr)"
          name="targetSizeCrores"
          type="number"
          defaultValue={String(defaultSize)}
          required
        />
        <CInput
          label="Tenor (years)"
          name="targetTenorYears"
          type="number"
          defaultValue={String(defaultTenor)}
          required
        />
      </div>
      <p className="text-[12px] font-medium text-[var(--c-ink-2)]">
        Top investors
      </p>
      <ul className="max-h-56 space-y-1.5 overflow-y-auto">
        {topInvestors.map((inv) => (
          <li
            key={inv.partyId}
            className="flex items-center gap-2 rounded-[var(--c-radius)] px-2 py-1.5 ring-1 ring-[var(--c-line)]"
          >
            <input
              type="checkbox"
              checked={selected.has(inv.partyId)}
              onChange={() => toggle(inv.partyId)}
              className="size-4"
            />
            <span className="min-w-0 flex-1 truncate text-[12px]">
              {inv.legalName}
            </span>
            <span className="font-mono text-[11px] text-[var(--c-ink-3)]">
              {Math.round(inv.score)}
            </span>
            <input
              name={`c_${inv.partyId}`}
              type="number"
              step="0.1"
              placeholder="Cr"
              className="w-16 rounded border border-[var(--c-line)] px-1 py-0.5 text-[11px]"
              disabled={!selected.has(inv.partyId)}
            />
          </li>
        ))}
      </ul>
      {error ? (
        <p className="text-[12px] text-[var(--c-bad)]" role="alert">
          {error}
        </p>
      ) : null}
      <CButton type="submit" className="w-full" disabled={pending || selected.size === 0}>
        {pending ? "Sending…" : `Send ${selected.size} to deal`}
      </CButton>
    </form>
  );
}
