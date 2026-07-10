"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  importClientsBulk,
  type ImportClientsResult,
} from "@/features/parties/import-clients";
import { CButton } from "@/console/primitives/button";

export function ImportClientsForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ImportClientsResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await importClientsBulk(undefined, fd);
          setResult(res);
          if (res.ok) router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-[var(--c-ink-2)]">
        Excel or CSV file
        <input
          type="file"
          name="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          required
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          className="block w-full text-[13px] file:mr-3 file:rounded-full file:border-0 file:bg-[var(--c-accent-soft)] file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-[var(--c-accent)]"
        />
      </label>
      {fileName ? (
        <p className="text-[11px] text-[var(--c-ink-3)]">Selected: {fileName}</p>
      ) : (
        <p className="text-[11px] text-[var(--c-ink-3)]">
          Max 2,000 rows · 8 MB · headers must match the template
        </p>
      )}
      <CButton type="submit" className="w-full" disabled={pending}>
        {pending ? "Importing…" : "Import clients"}
      </CButton>
      {result?.error ? (
        <p className="text-[12px] text-[var(--c-bad)]" role="alert">
          {result.error}
        </p>
      ) : null}
      {result?.ok ? (
        <div className="rounded-[var(--c-radius)] bg-[var(--c-surface-2)] p-3 text-[12px] text-[var(--c-ink-2)]">
          <p className="font-medium text-[var(--c-ok)]">Import finished</p>
          <p className="mt-1">
            Inserted {result.inserted ?? 0} · skipped {result.skipped ?? 0} ·
            invalid {result.invalid ?? 0}
          </p>
          {result.errors?.length ? (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[var(--c-bad)]">
              {result.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
