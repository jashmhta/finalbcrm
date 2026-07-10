// DPDP Act 2023 consent + Data Subject Request (DSR) helpers.
//
// Research: COMPLIANCE_LEGAL_FEASIBILITY.md §6-7. Schema: compliance.ts
// `consent_record` (purpose-bound, granular per data category, retention clock)
// and `data_subject_request` (principal-rights workflow). Consent is
// purpose-bound - a marketing consent does NOT authorize sharing data with a
// rating agency; that needs its own consent_record. Withdrawal triggers a DSR
// (type=`withdraw_consent` or `erasure`).
//
// These are PURE helpers (no DB). DB-mutating orchestration (capture, withdraw,
// DSR transitions) lives in actions.ts and runs inside withRls.

export type ConsentPurpose =
  | "marketing"
  | "advisory_engagement"
  | "kyc_processing"
  | "credit_analysis"
  | "data_sharing_with_rating_agency"
  | "data_sharing_with_investors"
  | "regulatory_reporting"
  | "portfolio_management"
  | "secondary_trading_contact";

export type ConsentMethod =
  | "digital_sign"
  | "checkbox_email"
  | "physical_signed"
  | "verbal_recorded";

// DPDP Act 2023 principal-rights request types. These mirror the `dsr_type`
// Postgres enum in src/db/schema/enums.ts (preserved) and MUST stay in sync
// with it: the createDsr insert type-checks `requestType` against that enum.
//
// NOTE: `nomination` (DPDP Act 2023 Section 11(d) - right to nominate a
// natural person to exercise the principal's rights on death or incapacity)
// is a real statutory right that is currently NOT modelled here because the
// `dsr_type` schema enum does not yet include it. Adding it requires extending
// src/db/schema/enums.ts (`dsrTypeEnum`) plus an additive
// `ALTER TYPE dsr_type ADD VALUE 'nomination'` migration - both owned by the
// schema agent (src/db/schema/* is preserved). Tracked as a compliance TODO.
export type DsrType =
  | "access"
  | "erasure"
  | "rectification"
  | "restriction"
  | "portability"
  | "withdraw_consent";

export type DsrStatus =
  | "received"
  | "in_review"
  | "fulfilled"
  | "rejected"
  | "cancelled";

/**
 * Default retention horizon per consent purpose (DPDP purpose limitation +
// research §6). Marketing/web-lead data is held ~2yr per the public Privacy
// Policy; regulated purposes (kyc, credit_analysis, regulatory_reporting) follow
// the PMLA s.12 5yr minimum and sectoral regs. Callers may override.
 */
export const DEFAULT_RETENTION_YEARS_BY_PURPOSE: Record<ConsentPurpose, number> = {
  marketing: 2,
  advisory_engagement: 7,
  kyc_processing: 5,
  credit_analysis: 5,
  data_sharing_with_rating_agency: 5,
  data_sharing_with_investors: 5,
  regulatory_reporting: 7,
  portfolio_management: 7,
  secondary_trading_contact: 2,
};

/**
 * DPDP timelines for DSR fulfilment (research §6). The DPDP Act 2023 and the
// draft DPDP Rules 2025 set the principal-rights response window; the figures
// below track the operative draft rules and are conservative where the rules
// are not yet finalised.
 */
export const DSR_TIMELINE_DAYS: Partial<Record<DsrType, number>> = {
  access: 30,
  rectification: 7,
  erasure: 30,
  portability: 30,
  restriction: 7,
  withdraw_consent: 3,
};

/**
 * Compute the `retention_until` date for a consent record from its purpose and
// the consent-given date. Returns an ISO date string (YYYY-MM-DD).
 */
export function computeConsentRetentionUntil(
  purpose: ConsentPurpose,
  consentGivenAt: Date = new Date(),
  years?: number,
): string {
  const yrs = years ?? DEFAULT_RETENTION_YEARS_BY_PURPOSE[purpose];
  const d = new Date(consentGivenAt);
  d.setFullYear(d.getFullYear() + yrs);
  return toIsoDate(d);
}

/**
 * Compute the SLA due date for a DSR from its request type and the requested-at
// timestamp. Returns `null` for request types without a defined statutory
// window.
 */
export function computeDsrDueDate(
  type: DsrType,
  requestedAt: Date = new Date(),
): string | null {
  const days = DSR_TIMELINE_DAYS[type];
  if (days == null) return null;
  const d = new Date(requestedAt);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/**
 * Whether a consent_record is currently active (not withdrawn, not
// soft-deleted). Mirrors the partial index `consent_record_active_idx`.
 */
export function isConsentActive(c: {
  consentWithdrawnAt: Date | null;
  deletedAt: Date | null;
}): boolean {
  return c.consentWithdrawnAt == null && c.deletedAt == null;
}

/**
 * When consent is withdrawn for a purpose that previously authorised data
// processing/sharing, the withdrawal should spawn a DSR so the purge/restriction
// job runs. This helper decides whether a withdrawal should auto-trigger a DSR
// and what type. Per research §6 + schema §2.21: a withdrawal of
// `kyc_processing` / `credit_analysis` / `data_sharing_*` triggers an `erasure`
// or `restriction` DSR (the regulated-purpose data may still be retained per
// PMLA s.12 minimum - restriction, not erasure - for kyc_processing).
 */
export function dsrTypeForWithdrawal(purpose: ConsentPurpose): DsrType | null {
  switch (purpose) {
    // Regulated minimum retention applies - restrict further processing, do not
    // erase (PMLA s.12 5yr overrides DPDP erasure within the retention window).
    case "kyc_processing":
    case "regulatory_reporting":
      return "restriction";
    // Non-regulated purposes - the principal can demand erasure.
    case "marketing":
    case "secondary_trading_contact":
    case "advisory_engagement":
    case "portfolio_management":
      return "erasure";
    // Sharing consents - withdraw the share (restriction) + downstream recall.
    case "data_sharing_with_rating_agency":
    case "data_sharing_with_investors":
      return "restriction";
    case "credit_analysis":
      return "restriction";
    default:
      return null;
  }
}

/**
 * Allowed DSR status transitions (research §6 workflow). received → in_review
// → fulfilled | rejected; received/in_review can be cancelled by the principal.
 */
export const DSR_TRANSITIONS: Record<DsrStatus, DsrStatus[]> = {
  received: ["in_review", "cancelled"],
  in_review: ["fulfilled", "rejected", "cancelled"],
  fulfilled: [],
  rejected: ["in_review"],
  cancelled: [],
};

export function canTransitionDsr(from: DsrStatus, to: DsrStatus): boolean {
  return (DSR_TRANSITIONS[from] ?? []).includes(to);
}

function toIsoDate(d: Date): string {
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
