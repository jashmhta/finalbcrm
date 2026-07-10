"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Buildings,
  Handshake,
  Coins,
  CalendarBlank,
  UserCircle,
  Notepad,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Button,
  Eyebrow,
  Badge,
} from "@/components/brand";
import {
  LeadDealTypeIcon,
  leadDealTypeTone,
} from "@/features/leads/lead-icons";
// CRITICAL: import runtime constants + types from `./types` (NOT the feature
// barrel). The barrel re-exports ./queries + ./actions, which import the
// `postgres` driver - pulling a server-only module into a "use client" bundle
// breaks the client build (Can't resolve 'fs'/'tls'). The server action
// (`createLead`) is imported from the "use server" actions file, which is the
// correct pattern for client→server-action calls.
import {
  LEAD_DEAL_TYPE_LABELS,
  LEAD_DEAL_TYPE_ORDER,
  LEAD_DEAL_TYPE_SHORT,
  LEAD_SOURCE_LABELS,
  LEAD_SOURCE_ORDER,
} from "@/features/leads/types";
import { createLead, type CreateLeadState } from "@/features/leads/actions";

/* ------------------------------------------------------------------ *
 * NewLeadForm - the lead capture form.
 *
 * Two modes:
 *   · new        → creates a prospect party + stamps lead_meta
 *   · existing   → links lead_meta onto an existing relationship
 *
 * The deal-type selector is an icon grid (the bond-house service umbrella)
 * rather than a flat <select> - the bespoke marks + Phosphor glyphs make the
 * 12 service lines scannable, and the tone well signals the bond/G-Sec
 * concepts. Native selects back the source / RM / existing-party fields for
 * accessibility + 44px mobile tap targets. The form posts to the createLead
 * server action via useActionState, which redirects to the new lead's
 * workspace on success.
 * ------------------------------------------------------------------ */

const SOURCES = LEAD_SOURCE_ORDER;
const DEAL_TYPES = LEAD_DEAL_TYPE_ORDER;

const fieldClass = cn(
  "h-11 w-full appearance-none rounded-xl bg-foreground/[0.03] px-3.5 text-[14px] text-foreground",
  "ring-1 ring-hairline/70 transition-all duration-200 ease-soft",
  "focus:bg-foreground/[0.05] focus:ring-hairline focus:outline-none",
  "placeholder:text-muted-foreground/70",
);

const labelClass =
  "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground";

export function NewLeadForm({
  rms,
  parties,
}: {
  rms: { userId: string; name: string }[];
  parties: { partyId: string; legalName: string }[];
}) {
  const [state, action, pending] = useActionState<CreateLeadState, FormData>(
    createLead,
    undefined,
  );

  const [mode, setMode] = React.useState<"new" | "existing">("new");
  const [companyName, setCompanyName] = React.useState("");
  const [linkPartyId, setLinkPartyId] = React.useState("");
  const [source, setSource] = React.useState<string>(SOURCES[0]!);
  const [dealType, setDealType] = React.useState<string>(DEAL_TYPES[0]!);
  const [estSize, setEstSize] = React.useState("");
  const [expectedClose, setExpectedClose] = React.useState("");
  const [assignedRm, setAssignedRm] = React.useState("");

  const dealTone = leadDealTypeTone(dealType as (typeof DEAL_TYPES)[number]);

  // Live preview - the lead's identity assembled from the capture so the RM
  // sees exactly how it will surface on the pipeline before committing.
  const previewName =
    mode === "existing"
      ? (parties.find((p) => p.partyId === linkPartyId)?.legalName ?? null)
      : companyName.trim() || null;

  const sizeNum = estSize.trim() ? Number(estSize) : NaN;
  const sizeText = Number.isFinite(sizeNum) && sizeNum >= 0
    ? `₹${sizeNum.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`
    : null;

  return (
    <Card>
      <CardHeader>
        <Eyebrow dot>Capture</Eyebrow>
        <CardTitle className="mt-1">New lead</CardTitle>
        <CardDescription>
          A lead is a prospect relationship the firm is qualifying toward a
          mandate. BANT qualification and conversion happen on the lead&apos;s
          workspace.
        </CardDescription>
      </CardHeader>
      <CardBody>
        {/* Live preview - the identity the lead will carry on the pipeline. */}
        <div
          className="mb-6 flex flex-col gap-2 rounded-xl bg-surface p-4 ring-1 ring-inset ring-foreground/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Buildings weight="light" className="size-3.5" />
            <span className="text-[10.5px] font-medium uppercase tracking-[0.14em]">
              Will appear as
            </span>
          </div>
          {previewName ? (
            <span className="text-[clamp(1.25rem,1rem+0.8vw,1.6rem)] font-light leading-tight tracking-[-0.01em] text-foreground break-words">
              {previewName}
            </span>
          ) : (
            <span className="text-[13px] italic text-muted-foreground">
              {mode === "existing"
                ? "Select an existing relationship…"
                : "Enter a company name…"}
            </span>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="neutral">
              {LEAD_DEAL_TYPE_SHORT[dealType as (typeof DEAL_TYPES)[number]]}
            </Badge>
            <Badge variant="outline">{LEAD_SOURCE_LABELS[source as (typeof SOURCES)[number]]}</Badge>
            {sizeText ? (
              <Badge variant="gold" icon={<Coins weight="light" />}>
                {sizeText}
              </Badge>
            ) : null}
          </div>
        </div>

        <form action={action} className="flex flex-col gap-5">
          {/* Mode toggle - new company vs link an existing relationship. */}
          <input type="hidden" name="mode" value={mode} />
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Capture mode</span>
            <div className="grid grid-cols-2 gap-2">
              <ModeButton
                active={mode === "new"}
                onClick={() => setMode("new")}
                icon={<Buildings weight="light" className="size-4" />}
                label="New company"
                hint="Create a prospect party"
              />
              <ModeButton
                active={mode === "existing"}
                onClick={() => setMode("existing")}
                icon={<Handshake weight="light" className="size-4" />}
                label="Existing client"
                hint="Link a relationship"
              />
            </div>
          </div>

          {/* Company / existing party - the primary naming lever. */}
          {mode === "new" ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="companyName" className={labelClass}>
                Company name <span className="text-down">*</span>
              </label>
              <input
                id="companyName"
                name="companyName"
                type="text"
                required
                maxLength={200}
                autoComplete="organization"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Aravali Power Generation Ltd."
                className={fieldClass}
              />
              <p className="text-[12px] text-muted-foreground">
                A prospect party is created (status: onboarding, type: prospect).
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="linkPartyId" className={labelClass}>
                Existing relationship <span className="text-down">*</span>
              </label>
              <FieldSelect
                id="linkPartyId"
                name="linkPartyId"
                required
                value={linkPartyId}
                onChange={(e) => setLinkPartyId(e.target.value)}
              >
                <option value="" disabled>
                  Select a relationship…
                </option>
                {parties.map((p) => (
                  <option key={p.partyId} value={p.partyId}>
                    {p.legalName}
                  </option>
                ))}
              </FieldSelect>
              <p className="text-[12px] text-muted-foreground">
                {parties.length === 0
                  ? "No existing relationships available."
                  : `${parties.length} relationship${parties.length === 1 ? "" : "s"} on the ledger. The lead is tracked on the existing party.`}
              </p>
            </div>
          )}

          {/* Deal-type selector - icon grid (the service umbrella). */}
          <div className="flex flex-col gap-2">
            <span className={labelClass}>Potential deal type</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DEAL_TYPES.map((dt) => {
                const active = dealType === dt;
                return (
                  <button
                    key={dt}
                    type="button"
                    onClick={() => setDealType(dt)}
                    aria-pressed={active}
                    className={cn(
                      "group/dt flex items-center gap-2.5 rounded-xl p-2.5 text-left ring-1 transition-all duration-200 ease-soft",
                      "min-h-[44px]",
                      active
                        ? "bg-foreground/[0.06] ring-hairline shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                        : "bg-foreground/[0.02] ring-hairline/50 hover:bg-foreground/[0.04] hover:ring-hairline/70",
                    )}
                  >
                    <span
                      className={cn(
                        "shrink-0 transition-transform duration-200 ease-soft",
                        active && "scale-105",
                      )}
                    >
                      <DealTypeGlyph dealType={dt} active={active} tone={leadDealTypeTone(dt)} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-[12px] font-medium leading-tight",
                          active ? "text-foreground" : "text-foreground/85",
                        )}
                      >
                        {LEAD_DEAL_TYPE_LABELS[dt]}
                      </span>
                    </span>
                    {active ? (
                      <span
                        aria-hidden
                        className="size-1.5 shrink-0 rounded-full bg-gold shadow-[0_0_8px] shadow-gold/60"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
            <input type="hidden" name="dealType" value={dealType} />
          </div>

          {/* Source + estimated size + expected close. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="source" className={labelClass}>
                Source
              </label>
              <FieldSelect
                id="source"
                name="source"
                required
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {LEAD_SOURCE_LABELS[s]}
                  </option>
                ))}
              </FieldSelect>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="estSizeCr" className={labelClass}>
                Estimated size (₹ Cr)
              </label>
              <div className="relative inline-flex items-center">
                <input
                  id="estSizeCr"
                  name="estSizeCr"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={50000}
                  step="1"
                  value={estSize}
                  onChange={(e) => setEstSize(e.target.value)}
                  placeholder="250"
                  className={cn(fieldClass, "pr-10 font-mono tabular-nums")}
                />
                <span className="pointer-events-none absolute right-3.5 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground/70">
                  Cr
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="expectedClose" className={labelClass}>
                Expected close
              </label>
              <div className="relative inline-flex items-center">
                <input
                  id="expectedClose"
                  name="expectedClose"
                  type="date"
                  value={expectedClose}
                  onChange={(e) => setExpectedClose(e.target.value)}
                  className={cn(fieldClass, "font-mono tabular-nums")}
                />
                <CalendarBlank
                  weight="light"
                  className="pointer-events-none absolute right-3 size-4 text-muted-foreground/70"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="assignedRm" className={labelClass}>
                Assigned Relationship Manager
              </label>
              <FieldSelect
                id="assignedRm"
                name="assignedRm"
                value={assignedRm}
                onChange={(e) => setAssignedRm(e.target.value)}
              >
                <option value="">Unassigned</option>
                {rms.map((r) => (
                  <option key={r.userId} value={r.userId}>
                    {r.name}
                  </option>
                ))}
              </FieldSelect>
            </div>
          </div>

          {/* Contact (optional) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <UserCircle weight="light" className="size-3.5 text-muted-foreground" />
              <span className={labelClass}>Primary contact (optional)</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                name="contactName"
                type="text"
                maxLength={160}
                autoComplete="name"
                placeholder="Full name"
                className={cn(fieldClass, "h-10")}
              />
              <input
                name="contactTitle"
                type="text"
                maxLength={160}
                placeholder="Title / designation"
                className={cn(fieldClass, "h-10")}
              />
              <input
                name="contactEmail"
                type="email"
                autoComplete="email"
                placeholder="Email"
                className={cn(fieldClass, "h-10")}
              />
              <input
                name="contactPhone"
                type="tel"
                maxLength={32}
                autoComplete="tel"
                placeholder="Phone"
                className={cn(fieldClass, "h-10")}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="notes" className={labelClass}>
              Notes
            </label>
            <div className="relative">
              <Notepad
                weight="light"
                className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground/60"
              />
              <textarea
                id="notes"
                name="notes"
                rows={3}
                maxLength={4000}
                placeholder="Context - the sourcing conversation, the financing need, next step…"
                className={cn(
                  fieldClass,
                  "h-auto min-h-[88px] resize-y pl-9 leading-relaxed",
                )}
              />
            </div>
          </div>

          {state?.error ? (
            <p className="text-[13px] text-down">{state.error}</p>
          ) : null}

          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              asChild
              variant="secondary-hairline"
              size="md"
              className="h-11 w-full sm:w-auto md:h-9.5"
              leadingIcon={<ArrowLeft weight="light" className="size-4" />}
            >
              <Link href="/leads">Cancel</Link>
            </Button>
            <Button
              type="submit"
              variant="primary-gold"
              size="md"
              className="h-11 w-full sm:w-auto md:h-9.5"
              disabled={
                pending ||
                (mode === "new" ? companyName.trim().length < 2 : !linkPartyId)
              }
              trailingIcon={<ArrowRight weight="light" className="size-4" />}
            >
              {pending ? "Capturing…" : "Capture lead"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * ModeButton - the new/existing capture-mode toggle.
 * ------------------------------------------------------------------ */
function ModeButton({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-start gap-1 rounded-xl p-3 text-left ring-1 transition-all duration-200 ease-soft min-h-[64px]",
        active
          ? "bg-foreground/[0.06] ring-hairline shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
          : "bg-foreground/[0.02] ring-hairline/50 hover:bg-foreground/[0.04] hover:ring-hairline/70",
      )}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-[13px] font-medium",
          active ? "text-foreground" : "text-foreground/85",
        )}
      >
        {icon}
        {label}
      </span>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * DealTypeGlyph - the deal-type icon in a tone well, brightened when active.
 *  Mirrors the IconTile disc treatment so the selector reads as a grid of
 *  the brand's icon language, not a flat radio list.
 * ------------------------------------------------------------------ */
function DealTypeGlyph({
  dealType,
  active,
  tone,
}: {
  dealType: (typeof DEAL_TYPES)[number];
  active: boolean;
  tone: ReturnType<typeof leadDealTypeTone>;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg ring-1 transition-colors duration-200 ease-soft",
        tone === "gold" && "ring-gold/22 bg-gold/[0.06] text-gold/85",
        tone === "emerald" && "ring-emerald/22 bg-emerald/[0.06] text-emerald/85",
        tone === "neutral" && "ring-hairline bg-foreground/[0.03] text-muted-foreground",
        active && tone === "neutral" && "text-foreground",
      )}
    >
      <LeadDealTypeIcon dealType={dealType} size={18} />
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * FieldSelect - native <select> styled with the double-bezel hairline +
 *  chevron. Native keeps the markup accessible + mobile-friendly (44px tap).
 * ------------------------------------------------------------------ */
function FieldSelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
) {
  return (
    <div className="relative inline-flex items-center">
      <select {...props} className={cn(fieldClass, "pr-9")} />
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className="pointer-events-none absolute right-3 size-3 text-muted-foreground"
      >
        <path
          d="M2 4l4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}