"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Buildings,
  Check,
  CheckCircle,
  Fingerprint,
  IdentificationCard,
  SealCheck,
  Stamp,
  User,
  FileText,
  ChartBar,
  Users,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Eyebrow,
  Badge,
} from "@/components/brand";
import {
  ONBOARDING_CLIENT_TYPE_LABELS,
  ONBOARDING_CLIENT_TYPE_ORDER,
  ONBOARDING_DOC_HINTS,
  ONBOARDING_DOC_LABELS,
  ONBOARDING_DOC_ORDER,
} from "@/features/onboarding/types";
import type { RmOption } from "@/features/onboarding/queries";
import { createOnboarding, type CreateOnboardingState } from "@/features/onboarding/actions";

/* ------------------------------------------------------------------ *
 * OnboardingWizard - a 4-step visual stepper capture form.
 *
 *   Step 1  Company details   - name, client type, RM, identifiers, geography
 *   Step 2  Contact            - authorized signatory (name, title, email, phone)
 *   Step 3  Document checklist - the 7 docs, mark which are in hand
 *   Step 4  Review             - summary + submit
 *
 * All step panels stay mounted (hidden when inactive) so their field values
 * persist across Back/Next navigation. The form posts to createOnboarding via
 * useActionState, which redirects to the new case on success.
 *
 * CRITICAL: primary content renders VISIBLE on mount - the stepper + the
 * active step render without a whileInView opacity-0 gate. Motion is reserved
 * for the step transition (fade + 8px rise) + the stepper fill.
 * ------------------------------------------------------------------ */

const EASE = [0.32, 0.72, 0, 1] as const;

const STEPS = [
  {
    key: "company",
    label: "Company",
    full: "Company details",
    hint: "The prospect's legal identity + registered office.",
    icon: Buildings,
  },
  {
    key: "contact",
    label: "Contact",
    full: "Authorized signatory",
    hint: "The individual who signs the engagement + KYC.",
    icon: User,
  },
  {
    key: "documents",
    label: "Documents",
    full: "Document checklist",
    hint: "Mark the documents you already have in hand.",
    icon: FileText,
  },
  {
    key: "review",
    label: "Review",
    full: "Review & create",
    hint: "Confirm the case file before opening it.",
    icon: SealCheck,
  },
] as const;

const fieldClass = cn(
  "h-11 w-full appearance-none rounded-xl bg-foreground/[0.03] px-3.5 text-[14px] text-foreground",
  "ring-1 ring-hairline/70 transition-all duration-200 ease-soft",
  "focus:bg-foreground/[0.05] focus:ring-hairline focus:outline-none",
  "placeholder:text-muted-foreground/70",
);

const labelClass = "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground";

const DOC_ICONS = {
  incorporation_certificate: Buildings,
  pan_card: IdentificationCard,
  board_resolution: Stamp,
  authorised_signatory_kyc: Fingerprint,
  financial_statements: ChartBar,
  beneficial_ownership_declaration: Users,
  consent_form: CheckCircle,
} as const;

export interface OnboardingWizardProps {
  rms: RmOption[];
}

export function OnboardingWizard({ rms }: OnboardingWizardProps) {
  const [state, action, pending] = useActionState<
    CreateOnboardingState,
    FormData
  >(createOnboarding, undefined);

  const [step, setStep] = React.useState(0);
  const formRef = React.useRef<HTMLFormElement>(null);

  // Tracked for the live review + the stepper's completed check. Values also
  // live in the form fields themselves (the source of truth on submit); this
  // state mirrors them so the review panel can render a summary without
  // reading the DOM.
  const [companyName, setCompanyName] = React.useState("");
  const [clientType, setClientType] = React.useState<string>("issuer");
  const [assignedRm, setAssignedRm] = React.useState<string>("");
  const [pan, setPan] = React.useState("");
  const [contactName, setContactName] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [docsInHand, setDocsInHand] = React.useState<Set<string>>(new Set());

  const goNext = React.useCallback(() => {
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }, []);
  const goBack = React.useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const toggleDoc = React.useCallback((key: string) => {
    setDocsInHand((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const canProceed = step === 0 ? companyName.trim().length >= 2 : true;

  return (
    <div className="flex flex-col gap-6">
      {/* Stepper */}
      <Stepper current={step} />

      <form ref={formRef} action={action} className="flex flex-col gap-5">
        {/* Step 1 - Company details */}
        <StepPanel active={step === 0} stepKey="company">
          <Card>
            <CardHeader>
              <Eyebrow dot>Step 1 of 4</Eyebrow>
              <CardTitle className="mt-1">Company details</CardTitle>
              <CardDescription>
                The prospect&rsquo;s legal identity, intended role and registered office.
              </CardDescription>
            </CardHeader>
            <CardBody className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="companyName" className={labelClass}>
                  Company name <span className="text-down">*</span>
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  required
                  minLength={2}
                  maxLength={200}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Aravali Power Generation Ltd"
                  className={fieldClass}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="clientType" className={labelClass}>
                    Client type <span className="text-down">*</span>
                  </label>
                  <FieldSelect
                    id="clientType"
                    name="clientType"
                    required
                    value={clientType}
                    onChange={(e) => setClientType(e.target.value)}
                  >
                    {ONBOARDING_CLIENT_TYPE_ORDER.map((t) => (
                      <option key={t} value={t}>
                        {ONBOARDING_CLIENT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </FieldSelect>
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

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="pan" className={labelClass}>
                    PAN
                  </label>
                  <input
                    id="pan"
                    name="pan"
                    maxLength={10}
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                    placeholder="ABCDE1234F"
                    className={cn(fieldClass, "font-mono uppercase")}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="cin" className={labelClass}>
                    CIN / LLPIN
                  </label>
                  <input
                    id="cin"
                    name="cin"
                    maxLength={21}
                    placeholder="U12345MH2024PTC…"
                    className={cn(fieldClass, "font-mono uppercase")}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="gstin" className={labelClass}>
                    GSTIN
                  </label>
                  <input
                    id="gstin"
                    name="gstin"
                    maxLength={15}
                    placeholder="27ABCDE1234F1Z5"
                    className={cn(fieldClass, "font-mono uppercase")}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="state" className={labelClass}>
                    State
                  </label>
                  <input
                    id="state"
                    name="state"
                    maxLength={120}
                    placeholder="Maharashtra"
                    className={fieldClass}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="city" className={labelClass}>
                    City
                  </label>
                  <input
                    id="city"
                    name="city"
                    maxLength={120}
                    placeholder="Mumbai"
                    className={fieldClass}
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        </StepPanel>

        {/* Step 2 - Contact */}
        <StepPanel active={step === 1} stepKey="contact">
          <Card>
            <CardHeader>
              <Eyebrow dot>Step 2 of 4</Eyebrow>
              <CardTitle className="mt-1">Authorized signatory</CardTitle>
              <CardDescription>
                The individual who signs the engagement and is the natural-person
                principal for KYC.
              </CardDescription>
            </CardHeader>
            <CardBody className="flex flex-col gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="contactName" className={labelClass}>
                    Full name
                  </label>
                  <input
                    id="contactName"
                    name="contactName"
                    maxLength={160}
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Aarav Mehta"
                    className={fieldClass}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="contactTitle" className={labelClass}>
                    Designation
                  </label>
                  <input
                    id="contactTitle"
                    name="contactTitle"
                    maxLength={160}
                    placeholder="CFO · Treasurer · MD & CEO"
                    className={fieldClass}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="contactEmail" className={labelClass}>
                    Email
                  </label>
                  <input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="aarav.mehta@corp.in"
                    className={fieldClass}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="contactPhone" className={labelClass}>
                    Phone
                  </label>
                  <input
                    id="contactPhone"
                    name="contactPhone"
                    maxLength={32}
                    placeholder="+91 98765 43210"
                    className={cn(fieldClass, "font-mono")}
                  />
                </div>
              </div>
              <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
                <IdentificationCard weight="light" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" />
                The signatory&rsquo;s PAN + address proof are collected as the
                &ldquo;Authorized signatory KYC&rdquo; checklist document in the
                next step.
              </p>
            </CardBody>
          </Card>
        </StepPanel>

        {/* Step 3 - Document checklist */}
        <StepPanel active={step === 2} stepKey="documents">
          <Card>
            <CardHeader>
              <Eyebrow dot>Step 3 of 4</Eyebrow>
              <CardTitle className="mt-1">Document checklist</CardTitle>
              <CardDescription>
                Mark the documents you already have in hand - they&rsquo;ll be filed as
                uploaded (pending verification). The rest stay pending for
                collection on the case detail page.
              </CardDescription>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <ul className="flex flex-col gap-2.5">
                {ONBOARDING_DOC_ORDER.map((key) => {
                  const Icon = DOC_ICONS[key];
                  const checked = docsInHand.has(key);
                  return (
                    <li key={key}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl p-3.5 ring-1 transition-all duration-200 ease-soft",
                          checked
                            ? "bg-emerald/[0.06] ring-emerald/30"
                            : "bg-foreground/[0.02] ring-hairline/60 hover:bg-foreground/[0.04]",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md ring-1 transition-all duration-200 ease-soft",
                            checked
                              ? "bg-emerald text-on-emerald ring-emerald"
                              : "bg-transparent text-transparent ring-hairline",
                          )}
                        >
                          <Check weight="bold" className="size-3.5" />
                        </span>
                        <input
                          type="checkbox"
                          name="docsInHand"
                          value={key}
                          checked={checked}
                          onChange={() => toggleDoc(key)}
                          className="sr-only"
                        />
                        <span className="mt-0.5 text-muted-foreground/80 [&_svg]:size-5">
                          <Icon weight="light" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-medium text-foreground">
                            {ONBOARDING_DOC_LABELS[key]}
                          </span>
                          <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground/80">
                            {ONBOARDING_DOC_HINTS[key]}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="notes" className={labelClass}>
                  Onboarding note (optional)
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  maxLength={4000}
                  rows={3}
                  placeholder="Context for the compliance officer - source of the referral, any known constraints…"
                  className={cn(
                    "w-full appearance-none rounded-xl bg-foreground/[0.03] px-3.5 py-3 text-[14px] text-foreground",
                    "ring-1 ring-hairline/70 transition-all duration-200 ease-soft",
                    "focus:bg-foreground/[0.05] focus:ring-hairline focus:outline-none",
                    "placeholder:text-muted-foreground/70 resize-none",
                  )}
                />
              </div>
              <p className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
                {docsInHand.size} of {ONBOARDING_DOC_ORDER.length} documents in hand
              </p>
            </CardBody>
          </Card>
        </StepPanel>

        {/* Step 4 - Review */}
        <StepPanel active={step === 3} stepKey="review">
          <Card>
            <CardHeader>
              <Eyebrow dot>Step 4 of 4</Eyebrow>
              <CardTitle className="mt-1">Review &amp; create</CardTitle>
              <CardDescription>
                Confirm the case file. The case opens at the Profile stage; documents
                in hand are filed for verification.
              </CardDescription>
            </CardHeader>
            <CardBody className="flex flex-col gap-5">
              {/* Filed-as preview */}
              <div
                className="flex flex-col gap-2 rounded-xl bg-surface p-4 ring-1 ring-inset ring-foreground/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                aria-live="polite"
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <SealCheck weight="light" className="size-3.5" />
                  <span className="text-[10.5px] font-medium uppercase tracking-[0.14em]">
                    Case file
                  </span>
                </div>
                <span className="text-[clamp(1.25rem,1rem+0.8vw,1.6rem)] font-light leading-tight tracking-[-0.01em] text-foreground break-words">
                  {companyName.trim() || "Untitled onboarding"}
                </span>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge variant="info" icon={<Buildings weight="light" />}>
                    {ONBOARDING_CLIENT_TYPE_LABELS[clientType as keyof typeof ONBOARDING_CLIENT_TYPE_LABELS] ?? clientType}
                  </Badge>
                  <Badge variant="emerald" dot>
                    Profile stage
                  </Badge>
                  <Badge variant="outline" icon={<FileText weight="light" />}>
                    {docsInHand.size} in hand
                  </Badge>
                </div>
              </div>

              {/* Summary grid */}
              <div className="grid gap-4 sm:grid-cols-2">
                <ReviewBlock title="Company">
                  <ReviewRow label="Name" value={companyName || "-"} />
                  <ReviewRow label="Client type" value={ONBOARDING_CLIENT_TYPE_LABELS[clientType as keyof typeof ONBOARDING_CLIENT_TYPE_LABELS] ?? "-"} />
                  <ReviewRow
                    label="Relationship Manager"
                    value={assignedRm ? rms.find((r) => r.userId === assignedRm)?.name ?? "-" : "Unassigned"}
                  />
                  <ReviewRow label="PAN" value={pan || "-"} mono />
                </ReviewBlock>
                <ReviewBlock title="Contact">
                  <ReviewRow label="Signatory" value={contactName || "-"} />
                  <ReviewRow label="Email" value={contactEmail || "-"} />
                  <ReviewRow label="Designation" value="(from step 2)" muted />
                  <ReviewRow label="Phone" value="(from step 2)" muted />
                </ReviewBlock>
              </div>

              <ReviewBlock title="Documents in hand">
                {docsInHand.size === 0 ? (
                  <p className="text-[13px] text-muted-foreground">
                    None marked - all seven documents start pending collection.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {ONBOARDING_DOC_ORDER.filter((k) => docsInHand.has(k)).map((k) => (
                      <Badge key={k} variant="emerald" icon={<CheckCircle weight="light" />}>
                        {ONBOARDING_DOC_LABELS[k]}
                      </Badge>
                    ))}
                  </div>
                )}
              </ReviewBlock>

              {state?.error ? (
                <p className="text-[13px] text-down">{state.error}</p>
              ) : null}
            </CardBody>
          </Card>
        </StepPanel>

        {/* Navigation */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            asChild
            variant="ghost"
            size="md"
            leadingIcon={<ArrowLeft weight="light" className="size-4" />}
            className="w-full h-11 sm:w-auto md:h-9.5"
          >
            <Link href="/onboarding">Cancel</Link>
          </Button>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {step > 0 ? (
              <Button
                type="button"
                variant="secondary-hairline"
                size="md"
                onClick={goBack}
                leadingIcon={<ArrowLeft weight="light" className="size-4" />}
                className="w-full h-11 sm:w-auto md:h-9.5"
              >
                Back
              </Button>
            ) : null}
            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                variant="primary-emerald"
                size="md"
                onClick={goNext}
                disabled={!canProceed}
                trailingIcon={<ArrowRight weight="light" className="size-4" />}
                className="w-full h-11 sm:w-auto md:h-9.5"
              >
                Next
              </Button>
            ) : (
              <Button
                type="submit"
                variant="primary-emerald"
                size="md"
                disabled={pending || companyName.trim().length < 2}
                trailingIcon={<SealCheck weight="light" className="size-4" />}
                className="w-full h-11 sm:w-auto md:h-9.5"
              >
                {pending ? "Creating…" : "Create onboarding case"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Stepper - the 4-step visual progress indicator.
 * ------------------------------------------------------------------ */
function Stepper({ current }: { current: number }) {
  return (
    <div className="relative">
      {/* Connector line (behind the circles) */}
      <div
        aria-hidden
        className="absolute left-0 right-0 top-[18px] hidden h-px bg-hairline sm:block"
      />
      <motion.div
        aria-hidden
        className="absolute left-0 top-[18px] hidden h-px bg-emerald sm:block"
        initial={{ width: "0%" }}
        animate={{ width: `${(current / (STEPS.length - 1)) * 100}%` }}
        transition={{ duration: 0.5, ease: EASE }}
      />
      <ol className="relative flex items-start justify-between">
        {STEPS.map((s, i) => {
          const status =
            i < current ? "done" : i === current ? "active" : "todo";
          const Icon = s.icon;
          return (
            <li key={s.key} className="flex flex-1 flex-col items-center gap-2 text-center">
              <div className="flex w-full justify-center">
                <span
                  className={cn(
                    "relative z-10 inline-flex size-9 items-center justify-center rounded-full ring-1 transition-all duration-300 ease-soft",
                    status === "done" &&
                      "bg-emerald text-on-emerald ring-emerald",
                    status === "active" &&
                      "bg-surface text-emerald ring-emerald/50 shadow-[0_0_0_4px] shadow-emerald/15",
                    status === "todo" &&
                      "bg-surface text-muted-foreground/60 ring-hairline",
                  )}
                >
                  {status === "done" ? (
                    <Check weight="bold" className="size-4" />
                  ) : (
                    <Icon weight="light" className="size-4" />
                  )}
                </span>
              </div>
              <div className="hidden flex-col gap-0.5 sm:flex">
                <span
                  className={cn(
                    "text-[11px] font-medium uppercase tracking-[0.12em]",
                    status === "todo" ? "text-muted-foreground/60" : "text-foreground",
                  )}
                >
                  {s.label}
                </span>
                {status === "active" ? (
                  <span className="text-[10.5px] text-muted-foreground/80">{s.hint}</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * StepPanel - wraps a step's card; keeps it mounted (hidden when inactive)
 * so field values persist across Back/Next.
 * ------------------------------------------------------------------ */
function StepPanel({
  active,
  stepKey,
  children,
}: {
  active: boolean;
  stepKey: string;
  children: React.ReactNode;
}) {
  return (
    <div hidden={!active} aria-hidden={!active} data-step={stepKey}>
      <AnimatePresence mode="wait">
        {active ? (
          <motion.div
            key={stepKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * FieldSelect - native <select> styled with the double-bezel hairline.
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

/* ------------------------------------------------------------------ *
 * Review helpers.
 * ------------------------------------------------------------------ */
function ReviewBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-foreground/[0.02] p-4 ring-1 ring-hairline/60">
      <Eyebrow>{title}</Eyebrow>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  mono = false,
  muted = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
        {label}
      </span>
      <span
        className={cn(
          "text-[13px] text-right",
          mono && "font-mono tabular-nums",
          muted ? "text-muted-foreground/60 italic" : "text-foreground/90",
          "truncate",
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}