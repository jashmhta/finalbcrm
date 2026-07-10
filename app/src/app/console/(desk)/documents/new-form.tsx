"use client";

import { useActionState } from "react";
import {
  createDocument,
  type CreateDocumentState,
} from "@/features/documents/actions";
import { CInput } from "@/console/primitives/input";
import { CButton } from "@/console/primitives/button";

export function NewDocumentForm() {
  const [state, action, pending] = useActionState(
    createDocument,
    undefined as CreateDocumentState,
  );

  return (
    <form
      action={action}
      className="min-w-0 space-y-3"
      encType="multipart/form-data"
    >
      <input type="hidden" name="redirectTo" value="/console/documents" />
      <label className="flex min-w-0 flex-col gap-1 text-[12px] font-medium text-[var(--c-ink-2)]">
        File
        <input
          type="file"
          name="file"
          required
          className="max-w-full text-[13px] file:mr-2 file:rounded-full file:border-0 file:bg-[var(--c-accent-soft)] file:px-3 file:py-1.5 file:text-[12px]"
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-[12px] font-medium text-[var(--c-ink-2)]">
        Type
        <select
          name="documentType"
          defaultValue="other"
          className="h-10 w-full max-w-full rounded-[var(--c-radius)] px-2 ring-1 ring-[var(--c-line-strong)]"
        >
          <option value="kyc_pack">kyc_pack</option>
          <option value="mandate_letter">mandate_letter</option>
          <option value="term_sheet">term_sheet</option>
          <option value="financial_statement">financial_statement</option>
          <option value="other">other</option>
        </select>
      </label>
      <CInput label="Party ID (optional uuid)" name="partyId" />
      {state?.error ? (
        <p className="text-[12px] text-[var(--c-bad)]">{state.error}</p>
      ) : null}
      <CButton type="submit" disabled={pending} className="w-full">
        {pending ? "Uploading…" : "Upload"}
      </CButton>
    </form>
  );
}
