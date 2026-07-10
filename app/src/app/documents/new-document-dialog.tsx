"use client";

// "New document" dialog - the upload STUB, elevated to the double-bezel
// treatment. In a later phase a presigned-PUT route will accept the file, mint
// file_store_ref + sha256, then this form (or a shared helper) persists the
// metadata row. For now the operator pastes the object-store key and optional
// integrity hash so the table can be exercised end-to-end. The file <input>
// is captured but disabled. zod validation + createDocument action untouched -
// only the VIEW changed.

import * as React from "react";
import { useActionState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  X,
  ArrowRight,
  CircleNotch,
  ArrowFatDown,
  UploadSimple,
  SealWarning,
  LockSimple,
  FileText,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/brand/button";
import { Eyebrow } from "@/components/brand/text";
import {
  createDocument,
  type CreateDocumentState,
} from "@/features/documents/actions";

const DOCUMENT_TYPES = [
  "engagement_letter",
  "mandate_letter",
  "rating_rationale",
  "offering_circular",
  "drhp",
  "information_memorandum",
  "term_sheet",
  "security_document",
  "trustee_deed",
  "kyc_pack",
  "pan_card",
  "aadhaar",
  "board_resolution",
  "form60",
  "form61",
  "financial_statement",
  "financial_model_file",
  "credit_memo",
  "valuation_report",
  "legal_dd_report",
  "site_report",
  "consent_form",
  "other",
] as const;

const KYC_CATEGORIES = [
  "id_proof",
  "address_proof",
  "pan",
  "bo_declaration",
  "pep_declaration",
  "source_of_funds",
  "authority_letter",
] as const;

export function NewDocumentDialog() {
  const [state, action, pending] = useActionState<CreateDocumentState, FormData>(
    createDocument,
    undefined,
  );
  const [open, setOpen] = React.useState(false);
  const [documentType, setDocumentType] = React.useState<string>("other");
  const [kycCategory, setKycCategory] = React.useState<string>("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="primary-emerald"
            size="md"
            leadingIcon={<UploadSimple weight="light" className="size-4" />}
          >
            Upload document
          </Button>
        }
      />
      <DialogContent
        className={cn(
          "max-h-[90vh] max-w-[600px] gap-0 overflow-y-auto rounded-[1.5rem] border-0 bg-transparent p-0 ring-0",
          "sm:max-w-[600px]",
        )}
      >
        <div className="rounded-[1.5rem] bg-white/[0.02] p-1.5 ring-1 ring-hairline shadow-floating">
          <div className="bezel-hi overflow-hidden rounded-[calc(1.5rem-0.375rem)] bg-surface">
            <form action={action} className="flex flex-col gap-6 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <Eyebrow dot>Records</Eyebrow>
                  <DialogTitle className="text-[1.5rem] font-light tracking-[-0.02em] leading-tight text-foreground">
                    Upload document
                  </DialogTitle>
                  <DialogDescription className="text-[13px] text-muted-foreground">
                    Register document metadata. The blob lives in object
                    storage (S3); this form records the object key + integrity
                    hash. A presigned-upload route is wired in a later phase.
                  </DialogDescription>
                </div>
                <DialogClose
                  render={
                    <button
                      type="button"
                      aria-label="Close"
                      className={cn(
                        "inline-flex size-8 items-center justify-center rounded-full",
                        "text-muted-foreground ring-1 ring-hairline transition-all duration-200 ease-soft",
                        "hover:bg-foreground/5 hover:text-foreground active:scale-[0.96]",
                      )}
                    />
                  }
                >
                  <X weight="light" className="size-4" />
                </DialogClose>
              </div>

              <div className="flex flex-col gap-4">
                <Field label="File name" htmlFor="fileName" required>
                  <BezelInput
                    id="fileName"
                    name="fileName"
                    required
                    placeholder="acme-term-sheet.pdf"
                  />
                </Field>

                {/* Upload dropzone stub - disabled, documents intent. */}
                <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline/60 bg-foreground/[0.015] px-4 py-6 text-center">
                  <span className="inline-flex size-10 items-center justify-center rounded-full bg-foreground/[0.04] text-muted-foreground ring-1 ring-hairline/60 [&_svg]:size-5">
                    <UploadSimple weight="light" />
                  </span>
                  <p className="text-[12.5px] text-muted-foreground">
                    Direct upload is not wired yet - paste the object-store key
                    below.
                  </p>
                  <input
                    id="file"
                    name="file"
                    type="file"
                    disabled
                    className="hidden"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Type" htmlFor="documentType">
                    <BezelSelect
                      id="documentType"
                      name="documentType"
                      value={documentType}
                      onChange={setDocumentType}
                      options={DOCUMENT_TYPES}
                    />
                  </Field>
                  <Field
                    label="KYC category"
                    htmlFor="kycCategory"
                    hint="optional"
                  >
                    <BezelSelect
                      id="kycCategory"
                      name={kycCategory ? "kycCategory" : undefined}
                      value={kycCategory || "none"}
                      onChange={(v) => setKycCategory(v === "none" ? "" : v)}
                      options={["none", ...KYC_CATEGORIES] as readonly string[]}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="MIME type" htmlFor="mimeType">
                    <BezelInput
                      id="mimeType"
                      name="mimeType"
                      placeholder="application/pdf"
                    />
                  </Field>
                  <Field label="Size (bytes)" htmlFor="sizeBytes">
                    <BezelInput
                      id="sizeBytes"
                      name="sizeBytes"
                      type="number"
                      min={0}
                      placeholder="102400"
                    />
                  </Field>
                </div>

                <Field
                  label="Object-store key"
                  htmlFor="fileStoreRef"
                  hint="file_store_ref"
                >
                  <BezelInput
                    id="fileStoreRef"
                    name="fileStoreRef"
                    placeholder="s3://binary-crm-docs/2026/06/uuid.pdf"
                  />
                </Field>

                <Field label="SHA-256" htmlFor="sha256" hint="integrity hash">
                  <BezelInput
                    id="sha256"
                    name="sha256"
                    placeholder="64 hex chars"
                    maxLength={64}
                  />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label="Deal ID" htmlFor="dealId" hint="uuid">
                    <BezelInput id="dealId" name="dealId" placeholder="uuid" />
                  </Field>
                  <Field label="Party ID" htmlFor="partyId" hint="uuid">
                    <BezelInput id="partyId" name="partyId" placeholder="uuid" />
                  </Field>
                  <Field label="Contact ID" htmlFor="contactId" hint="uuid">
                    <BezelInput
                      id="contactId"
                      name="contactId"
                      placeholder="uuid"
                    />
                  </Field>
                </div>

                <Field label="Retention until" htmlFor="retentionUntil" hint="DPDP">
                  <BezelInput
                    id="retentionUntil"
                    name="retentionUntil"
                    type="date"
                  />
                </Field>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <CheckRow
                    name="isConfidential"
                    icon={<LockSimple weight="light" className="size-4" />}
                    title="Confidential"
                    hint="Restricts access to the walled group."
                  />
                  <CheckRow
                    name="isMnpi"
                    icon={<SealWarning weight="light" className="size-4" />}
                    title="MNPI"
                    hint="Disables download/copy/forward; forces watermark."
                  />
                </div>
              </div>

              {state?.error ? (
                <p
                  role="alert"
                  className="rounded-xl bg-down/10 px-3.5 py-2.5 text-[12.5px] font-medium text-down ring-1 ring-down/25"
                >
                  {state.error}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2.5 border-t border-hairline pt-5">
                <DialogClose
                  render={
                    <Button variant="ghost" size="md" type="button">
                      Cancel
                    </Button>
                  }
                />
                <Button
                  type="submit"
                  variant="primary-gold"
                  size="md"
                  disabled={pending}
                  leadingIcon={
                    pending ? (
                      <CircleNotch weight="light" className="size-4 animate-spin" />
                    ) : (
                      <FileText weight="light" className="size-4" />
                    )
                  }
                  trailingIcon={
                    pending ? undefined : (
                      <ArrowRight weight="light" className="size-4" />
                    )
                  }
                >
                  {pending ? "Registering…" : "Register document"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
      >
        {label}
        {required ? <span className="text-gold">*</span> : null}
        {hint ? (
          <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground/70">
            {hint}
          </span>
        ) : null}
      </label>
      {children}
    </div>
  );
}

function CheckRow({
  name,
  icon,
  title,
  hint,
}: {
  name: string;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3 rounded-xl bg-foreground/[0.02] px-3.5 py-3 ring-1 ring-hairline/60 transition-all duration-200 ease-soft hover:ring-hairline">
      <span className="relative inline-flex size-4 items-center justify-center">
        <input
          type="checkbox"
          name={name}
          className="peer size-4 appearance-none rounded-[5px] bg-foreground/[0.06] ring-1 ring-hairline transition-all duration-200 ease-soft checked:bg-emerald checked:ring-emerald/60"
        />
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className="pointer-events-none absolute size-3 text-on-emerald opacity-0 transition-opacity duration-200 peer-checked:opacity-100"
        >
          <path
            d="M2.5 6.5l2.5 2.5 4.5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="flex flex-col">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground [&_svg]:size-3.5">
          {icon}
          {title}
        </span>
        <span className="text-[11.5px] text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

function BezelInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="group/field rounded-xl bg-foreground/[0.02] p-px ring-1 ring-hairline/70 transition-all duration-200 ease-soft focus-within:ring-hairline">
      <input
        {...props}
        className={cn(
          "h-10 w-full rounded-[calc(0.75rem-1px)] bg-surface px-3.5 text-[13.5px] text-foreground",
          "placeholder:text-muted-foreground/60 focus:outline-none",
          className,
        )}
      />
    </div>
  );
}

function BezelSelect({
  id,
  name,
  value,
  onChange,
  options,
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <div className="group/field rounded-xl bg-foreground/[0.02] p-px ring-1 ring-hairline/70 transition-all duration-200 ease-soft focus-within:ring-hairline">
      <div className="relative flex items-center rounded-[calc(0.75rem-1px)] bg-surface">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-10 w-full appearance-none rounded-[calc(0.75rem-1px)] bg-transparent px-3.5 pr-8 text-[13.5px] text-foreground",
            "focus:outline-none",
          )}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o === "none" ? "- none -" : o.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <ArrowFatDown
          aria-hidden
          weight="light"
          className="pointer-events-none absolute right-3 size-3 text-muted-foreground"
        />
      </div>
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}