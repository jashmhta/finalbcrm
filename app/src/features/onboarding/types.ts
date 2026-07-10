// Client Onboarding - shared types + domain constants.
//
// Onboarding is the workflow that turns a prospect into an active, KYC-cleared,
// compliance-approved client of the Indian bond house / IB (Binary Capital /
// Binary Bonds). Storage: a JSONB `onboarding_meta` column on party (migration
// 0007_onboarding.sql). A party is an onboarding case iff party.onboarding_meta
// IS NOT NULL. See the migration header for the full design rationale (single
// source of truth = party master; the JSONB blob carries the onboarding-specific
// state the frozen party schema lacks).
//
// Domain (Indian bond house, SEBI/PMLA compliant):
//   Initiate       → a prospect is earmarked for onboarding.
//   Profile        → company details + authorized signatory captured.
//   Documents      → the 7-document checklist collected + verified.
//   KYC            → a kyc_record is raised and approved (PMLA CDD/EDD).
//   Compliance     → the compliance officer reviews + approves/rejects.
//   Activate       → party.status flips prospect→active; the client is live.
//
// The onboarding funnel stages are DISTINCT from the deal execution pipeline
// (deal_status) and the lead funnel (lead_meta.stage) - a won lead or a
// mandated deal can still need onboarding before the client can transact.
//
// STAGE GATES (enforced in actions.ts):
//   initiated → profile_created            manual (profile ready)
//   profile_created → documents_collected  manual (begin document collection)
//   documents_collected → kyc_verified     GATE: all 7 docs verified AND the
//                                           party's latest kyc_record.status
//                                           = 'approved'
//   kyc_verified → compliance_approved      GATE: compliance officer approval
//                                            (approveCompliance action)
//   compliance_approved → active            manual (activateClient - flips
//                                            party.status to 'active')
// Compliance may REJECT (complianceRejected) - the case stays in kyc_verified
// with a rejected compliance status flag + reason, and can be re-submitted.

/** Onboarding funnel stage. The board's kanban columns, in canonical order. */
export type OnboardingStage =
  | "initiated"
  | "profile_created"
  | "documents_collected"
  | "kyc_verified"
  | "compliance_approved"
  | "active";

/**
 * The intended party role the prospect is being onboarded as. A subset of the
 * party_type enum that maps onto the firm's counterparty universe (bond house +
 * IB). Stored as the enum string in onboarding_meta.clientType so activation
 * can flow straight into a real party_type_assignment.
 */
export type OnboardingClientType =
  | "issuer"
  | "investor"
  | "intermediary"
  | "arranger"
  | "underwriter"
  | "broker"
  | "ifa"
  | "rating_agency"
  | "trustee"
  | "registrar"
  | "legal_counsel"
  | "auditor"
  | "guarantor"
  | "government"
  | "spv"
  | "vendor";

/**
 * The 7-document checklist for a corporate onboarding (SEBI/PMLA). Each item
 * is tracked uploaded/pending + verified/rejected. The keys are stable
 * identifiers; the labels are the display strings.
 */
export type OnboardingDocKey =
  | "incorporation_certificate"
  | "pan_card"
  | "board_resolution"
  | "authorised_signatory_kyc"
  | "financial_statements"
  | "beneficial_ownership_declaration"
  | "consent_form";

/** Upload state of a single checklist document. */
export type OnboardingDocStatus = "pending" | "uploaded";

/** Verification state of a single checklist document. */
export type OnboardingDocVerification =
  | "pending"
  | "verified"
  | "rejected";

/** One row of the document checklist stored in onboarding_meta.documents. */
export interface OnboardingDocItem {
  key: OnboardingDocKey;
  status: OnboardingDocStatus;
  verification: OnboardingDocVerification;
  /** document.document_id (uuid as text) when uploaded, else null. */
  documentId: string | null;
  uploadedAt: string | null;
  verifiedAt: string | null;
  /** app_user.user_id of the verifier (uuid as text), else null. */
  verifiedBy: string | null;
  rejectionReason: string | null;
}

/** A per-stage entry timestamp - drives the SLA clocks. */
export interface OnboardingStageEntry {
  stage: OnboardingStage;
  enteredAt: string;
}

/** The onboarding_meta JSONB shape stored on party.onboarding_meta. */
export interface OnboardingMeta {
  stage: OnboardingStage;
  clientType: OnboardingClientType;
  /** app_user.user_id (uuid as text) or null (unassigned). */
  assignedRm: string | null;
  // Primary authorized signatory captured in the wizard.
  contactName: string | null;
  contactTitle: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  // Company identifiers + registered-office geography.
  pan: string | null;
  cin: string | null;
  gstin: string | null;
  state: string | null;
  city: string | null;
  // The 7-document checklist.
  documents: OnboardingDocItem[];
  /** kyc_record.kyc_record_id (uuid as text) created/linked by the flow. */
  kycRecordId: string | null;
  // Compliance sign-off.
  complianceApprovedBy: string | null;
  complianceApprovedAt: string | null;
  complianceRejectedBy: string | null;
  complianceRejectedAt: string | null;
  complianceNote: string | null;
  // SLA clocks - per-stage entry timestamps.
  stageHistory: OnboardingStageEntry[];
  // Whole-case rejection reason (distinct from per-doc rejection).
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Canonical orderings + display labels (single source of truth for the UI).
// ---------------------------------------------------------------------------

/** Board column order - the onboarding funnel, terminal state last. */
export const ONBOARDING_STAGE_ORDER: OnboardingStage[] = [
  "initiated",
  "profile_created",
  "documents_collected",
  "kyc_verified",
  "compliance_approved",
  "active",
];

export const ONBOARDING_STAGE_LABELS: Record<OnboardingStage, string> = {
  initiated: "Initiated",
  profile_created: "Profile",
  documents_collected: "Documents",
  kyc_verified: "KYC",
  compliance_approved: "Compliance",
  active: "Active",
};

/** Full label for the detail stepper (the short board label is above). */
export const ONBOARDING_STAGE_FULL_LABELS: Record<OnboardingStage, string> = {
  initiated: "Initiated",
  profile_created: "Profile created",
  documents_collected: "Documents collected",
  kyc_verified: "KYC verified",
  compliance_approved: "Compliance approved",
  active: "Active client",
};

/** One-line hint under each column header - what the stage means. */
export const ONBOARDING_STAGE_HINTS: Record<OnboardingStage, string> = {
  initiated: "Prospect earmarked - profile pending.",
  profile_created: "Company + signatory captured - collect documents.",
  documents_collected: "Document checklist under collection + verification.",
  kyc_verified: "KYC approved - awaiting compliance sign-off.",
  compliance_approved: "Compliance cleared - ready to activate.",
  active: "Onboarded. The client is live.",
};

/** Semantic tone for a stage - maps to the brand Badge variants. */
export const ONBOARDING_STAGE_TONE: Record<
  OnboardingStage,
  "neutral" | "info" | "gold" | "emerald"
> = {
  initiated: "neutral",
  profile_created: "info",
  documents_collected: "gold",
  kyc_verified: "gold",
  compliance_approved: "emerald",
  active: "emerald",
};

/**
 * SLA target in DAYS to complete the current stage's gating work and advance.
 * The brief: documents 3 days, KYC 7 days, compliance 2 days. `initiated`
 * (profile creation) and `compliance_approved` (activation) get a short 1-day
 * target; `active` is terminal (0). The SLA clock starts at the stage's
 * stageHistory enteredAt.
 */
export const ONBOARDING_STAGE_SLA_DAYS: Record<OnboardingStage, number> = {
  initiated: 1,
  profile_created: 3,
  documents_collected: 7,
  kyc_verified: 2,
  compliance_approved: 1,
  active: 0,
};

/** Which stage's SLA each stage represents (for legend / tooltips). */
export const ONBOARDING_STAGE_SLA_LABEL: Record<OnboardingStage, string> = {
  initiated: "Profile · 1d",
  profile_created: "Documents · 3d",
  documents_collected: "KYC · 7d",
  kyc_verified: "Compliance · 2d",
  compliance_approved: "Activate · 1d",
  active: "-",
};

/**
 * Allowed forward transitions in the onboarding state machine. The gates
 * (all-docs-verified + KYC approved for documents_collected→kyc_verified;
 * compliance approval for kyc_verified→compliance_approved) are enforced in
 * actions.ts on top of this adjacency list - the adjacency is the structural
 * shape, the gates are the domain rules.
 */
export const ONBOARDING_ALLOWED_TRANSITIONS: Record<
  OnboardingStage,
  OnboardingStage[]
> = {
  initiated: ["profile_created"],
  profile_created: ["documents_collected"],
  documents_collected: ["kyc_verified"],
  kyc_verified: ["compliance_approved"],
  compliance_approved: ["active"],
  active: [],
};

export function canTransitionOnboarding(
  from: OnboardingStage,
  to: OnboardingStage,
): boolean {
  return (ONBOARDING_ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

/** The next stage in the funnel, or null if terminal. */
export function nextStageOf(stage: OnboardingStage): OnboardingStage | null {
  const idx = ONBOARDING_STAGE_ORDER.indexOf(stage);
  if (idx < 0 || idx >= ONBOARDING_STAGE_ORDER.length - 1) return null;
  return ONBOARDING_STAGE_ORDER[idx + 1]!;
}

// ---------------------------------------------------------------------------
// Client type labels
// ---------------------------------------------------------------------------

export const ONBOARDING_CLIENT_TYPE_ORDER: OnboardingClientType[] = [
  "issuer",
  "investor",
  "intermediary",
  "arranger",
  "underwriter",
  "broker",
  "ifa",
  "rating_agency",
  "trustee",
  "registrar",
  "legal_counsel",
  "auditor",
  "guarantor",
  "government",
  "spv",
  "vendor",
];

export const ONBOARDING_CLIENT_TYPE_LABELS: Record<OnboardingClientType, string> = {
  issuer: "Issuer",
  investor: "Investor",
  intermediary: "Intermediary",
  arranger: "Arranger",
  underwriter: "Underwriter",
  broker: "Broker",
  ifa: "IFA",
  rating_agency: "Rating agency",
  trustee: "Debenture trustee",
  registrar: "Registrar",
  legal_counsel: "Legal counsel",
  auditor: "Auditor",
  guarantor: "Guarantor",
  government: "Government / PSU",
  spv: "SPV",
  vendor: "Vendor",
};

// ---------------------------------------------------------------------------
// Document checklist - the 7 documents, in canonical collection order.
// ---------------------------------------------------------------------------

export const ONBOARDING_DOC_ORDER: OnboardingDocKey[] = [
  "incorporation_certificate",
  "pan_card",
  "board_resolution",
  "authorised_signatory_kyc",
  "financial_statements",
  "beneficial_ownership_declaration",
  "consent_form",
];

export const ONBOARDING_DOC_LABELS: Record<OnboardingDocKey, string> = {
  incorporation_certificate: "Certificate of incorporation",
  pan_card: "PAN card",
  board_resolution: "Board resolution",
  authorised_signatory_kyc: "Authorised signatory KYC",
  financial_statements: "Financial statements",
  beneficial_ownership_declaration: "Beneficial ownership declaration",
  consent_form: "Consent form",
};

/** Short label for dense cards / chips. */
export const ONBOARDING_DOC_SHORT: Record<OnboardingDocKey, string> = {
  incorporation_certificate: "COI",
  pan_card: "PAN",
  board_resolution: "Board res.",
  authorised_signatory_kyc: "Signatory KYC",
  financial_statements: "Financials",
  beneficial_ownership_declaration: "BO declaration",
  consent_form: "Consent",
};

/** One-line hint for each document - what it is / why it's required. */
export const ONBOARDING_DOC_HINTS: Record<OnboardingDocKey, string> = {
  incorporation_certificate:
    "MCA-issued certificate of incorporation (company / LLP).",
  pan_card: "Permanent Account Number - the firm's PAN.",
  board_resolution:
    "Board resolution authorizing the signatory + the engagement.",
  authorised_signatory_kyc:
    "PAN + address proof of the authorized signatory (individual CDD).",
  financial_statements:
    "Audited financials for the latest 2–3 years (rating + credit input).",
  beneficial_ownership_declaration:
    "BO declaration per PML Rules 2005 Rule 9(3) - ≥10% company / ≥15% trust.",
  consent_form:
    "DPDP consent + engagement consent (marketing / KYC processing).",
};

/**
 * Map an onboarding doc key onto the document_type enum value used when the
 * doc is uploaded (document.document_type). Where the enum has no exact match
 * (incorporation certificate, authorised signatory KYC, BO declaration), the
 * upload is filed as 'other' - the onboarding_meta checklist carries the
 * precise key, so the doc is always identifiable on the onboarding detail
 * page regardless of the coarse enum bucket.
 */
export const ONBOARDING_DOC_TO_DOCUMENT_TYPE: Record<
  OnboardingDocKey,
  string
> = {
  incorporation_certificate: "other",
  pan_card: "pan_card",
  board_resolution: "board_resolution",
  authorised_signatory_kyc: "kyc_pack",
  financial_statements: "financial_statement",
  beneficial_ownership_declaration: "other",
  consent_form: "consent_form",
};

// ---------------------------------------------------------------------------
// SLA helpers - pure, reusable by queries (read) + actions (write) + UI.
// ---------------------------------------------------------------------------

export type OnboardingSlaStatus = "on_track" | "due_soon" | "overdue" | "none";

export interface OnboardingSlaState {
  status: OnboardingSlaStatus;
  /** Days remaining before the SLA lapses (negative when overdue). */
  daysRemaining: number;
  /** Target days for the current stage (0 for terminal). */
  targetDays: number;
  /** ISO timestamp the current stage was entered (the clock start). */
  enteredAt: string | null;
}

/** Days of "due soon" lead time before an SLA lapses. */
export const ONBOARDING_SLA_DUE_SOON_DAYS = 1;

/**
 * Compute the SLA state for an onboarding case from its current stage + the
 * stage's entry timestamp. Terminal (active) → none. A missing entry timestamp
 * (legacy blob) → on_track with the full target runway.
 */
export function computeOnboardingSla(
  stage: OnboardingStage,
  stageHistory: OnboardingStageEntry[],
  now: number = Date.now(),
): OnboardingSlaState {
  const targetDays = ONBOARDING_STAGE_SLA_DAYS[stage] ?? 0;
  if (stage === "active" || targetDays <= 0) {
    return { status: "none", daysRemaining: 0, targetDays: 0, enteredAt: null };
  }
  // The current stage's entry = the most recent stageHistory row for this stage.
  const entry = [...stageHistory]
    .reverse()
    .find((h) => h.stage === stage);
  const enteredAt = entry?.enteredAt ?? null;
  if (!enteredAt) {
    return {
      status: "on_track",
      daysRemaining: targetDays,
      targetDays,
      enteredAt: null,
    };
  }
  const enteredMs = new Date(enteredAt).getTime();
  if (!Number.isFinite(enteredMs)) {
    return {
      status: "on_track",
      daysRemaining: targetDays,
      targetDays,
      enteredAt: null,
    };
  }
  const elapsedDays = (now - enteredMs) / 86_400_000;
  const daysRemaining = Math.ceil(targetDays - elapsedDays);
  const status: OnboardingSlaStatus =
    daysRemaining < 0
      ? "overdue"
      : daysRemaining <= ONBOARDING_SLA_DUE_SOON_DAYS
        ? "due_soon"
        : "on_track";
  return { status, daysRemaining, targetDays, enteredAt };
}

// ---------------------------------------------------------------------------
// Checklist helpers
// ---------------------------------------------------------------------------

/** Build a fresh 7-doc checklist with every item pending. */
export function freshChecklist(): OnboardingDocItem[] {
  return ONBOARDING_DOC_ORDER.map((key) => ({
    key,
    status: "pending",
    verification: "pending",
    documentId: null,
    uploadedAt: null,
    verifiedAt: null,
    verifiedBy: null,
    rejectionReason: null,
  }));
}

/** Count of documents uploaded (status !== pending). */
export function docsUploaded(docs: OnboardingDocItem[]): number {
  return docs.filter((d) => d.status === "uploaded").length;
}

/** Count of documents verified (verification === verified). */
export function docsVerified(docs: OnboardingDocItem[]): number {
  return docs.filter((d) => d.verification === "verified").length;
}

/** Count of documents rejected (verification === rejected). */
export function docsRejected(docs: OnboardingDocItem[]): number {
  return docs.filter((d) => d.verification === "rejected").length;
}

/** True when all 7 documents are verified - the documents→KYC gate. */
export function allDocsVerified(docs: OnboardingDocItem[]): boolean {
  return docs.length > 0 && docs.every((d) => d.verification === "verified");
}

/** Progress 0–100 across the full checklist (uploaded / total). */
export function docsUploadProgress(docs: OnboardingDocItem[]): number {
  if (docs.length === 0) return 0;
  return Math.round((docsUploaded(docs) / docs.length) * 100);
}

/** Progress 0–100 across verification (verified / total). */
export function docsVerifyProgress(docs: OnboardingDocItem[]): number {
  if (docs.length === 0) return 0;
  return Math.round((docsVerified(docs) / docs.length) * 100);
}

/**
 * Overall onboarding progress 0–100 across the 6 stages + the doc verification
 * sub-progress of the documents_collected stage. Used by the detail page's
 * visual progress bar.
 */
export function onboardingProgress(
  stage: OnboardingStage,
  docs: OnboardingDocItem[],
): number {
  const stageIdx = ONBOARDING_STAGE_ORDER.indexOf(stage);
  if (stageIdx < 0) return 0;
  // 5 transitions to complete; each completed transition = 20%. The current
  // stage contributes a fractional share from doc verification when in the
  // documents stage.
  const completed = stageIdx; // number of transitions completed
  let frac = completed / 5;
  if (stage === "documents_collected") {
    frac += (docsVerifyProgress(docs) / 100) * (1 / 5);
  } else if (stage === "active") {
    frac = 1;
  }
  return Math.round(Math.min(1, frac) * 100);
}
