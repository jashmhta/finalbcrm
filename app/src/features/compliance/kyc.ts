// KYC lifecycle helpers (PMLA 2002 + RBI Master Direction on KYC).
//
// Research: COMPLIANCE_LEGAL_FEASIBILITY.md §5 (PMLA KYC/CDD/EDD, BO thresholds,
// PEP/sanctions, STR/CTR, retention). Schema: credit.ts `kyc_record` +
// `kyc_beneficial_owner`; contact.pep_status for PEP. These are PURE helpers -
// no DB access - so they can be unit-tested and reused by both Server
// Components (queries.ts) and Server Actions (actions.ts). DB-mutating
// orchestration lives in actions.ts and runs inside withRls.
//
// Key rules encoded:
//  - BO thresholds (PML Rules 2005 Rule 9(3), as amended 2019 - uniform across
//    RBI/SEBI/IRDAI): company >10%, partnership >15%, trust >15% (any
//    beneficiary with >15% interest, or author/settlor/trustee, or controller).
//    Where no natural person meets threshold, fallback BO = senior managing
//    official (CEO/MD/CFO) - role-based, NO percentage. There is NO 25%
//    threshold (debunked legacy misattribution). Partnership firms are modeled
//    with party_nature='organization' (no `partnership` nature exists), so
//    callers MUST pass `legalForm: 'partnership'` to boThresholdFor /
//    requiresEddForBo / shouldEscalateToEdd to get the 15% threshold.
//  - Periodic re-KYC periodicity (RBI Master Direction on KYC, FAQ Id=3782):
//    low=10yr, medium=8yr, high=2yr. SEBI KRA has no mandated cycle (5yr only
//    proposed in the 16 Jan 2026 consultation paper) - modelled separately.
//  - Retention (PMLA s.12): transaction records 5yr from transaction date
//    [s.12(3)]; identity records 5yr after relationship ended OR account closed,
//    whichever is later [s.12(4)]. NOT PML Rules Rule 7.
//  - Status lifecycle: pending → in_review → (CDD done) → approved | rejected;
//    approved → expired → rekyc_due; EDD path goes pending → in_review →
//    under_eds_check → approved | rejected. See `allowedTransitions`.

import {
  screenPepAdvanced,
  screenSanctionsAdvanced,
  type ScreeningResult,
  type ScreeningStatus,
} from "./screening";

export type { ScreeningResult, ScreeningStatus };

export type KycStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "expired"
  | "rekyc_due"
  | "under_eds_check";

export type KycType = "CDD" | "EDD" | "simplified";

export type KycRisk = "low" | "medium" | "high";

export type PartyNature =
  | "organization"
  | "natural_person"
  | "spv"
  | "trust"
  | "government"
  | "regulator";

// ---------------------------------------------------------------------------
// Beneficial-ownership thresholds (PML Rules 2005 Rule 9(3), 2019 amendment).
// `null` = role-based fallback (no percentage threshold); for a natural person
// the principal IS the BO so no threshold applies.
// ---------------------------------------------------------------------------

export const BO_THRESHOLD_PCT: Record<PartyNature, number | null> = {
  // Company / organization / SPV: >10% of shares/capital/profits or control
  // (PML Rules 2005 Rule 9(3), as amended 2019 - lowered from 25% to 10%).
  organization: 10,
  spv: 10,
  // Trust: author/settlor, trustee(s), any beneficiary with >15% interest, or
  // any person with control.
  trust: 15,
  // A natural person is their own BO - no ownership threshold.
  natural_person: null,
  // Government / regulator: senior managing official fallback (role-based).
  government: null,
  regulator: null,
};

/**
 * Legal form of an organization-typed party. The schema's `party_nature` enum
 * has no `partnership` value (partnerships are modeled with
 * `party_nature='organization'`), so the BO threshold for a partnership (15%)
 * cannot be derived from `party_nature` alone. Callers that know the obligor's
 * legal form pass it here; otherwise the company threshold (10%) is used.
 */
export type LegalForm =
  | "company"
  | "llp"
  | "partnership"
  | "trust"
  | "huf"
  | "other";

// Partnership firm: >15% of capital or profits (PML Rules 2005 Rule 9(3)).
// A partnership is modeled with party_nature='organization' in this schema, so
// callers MUST pass `legalForm: 'partnership'` to `boThresholdFor` /
// `requiresEddForBo` / `shouldEscalateToEdd` when the obligor is a partnership
// - otherwise the 10% company threshold is (wrongly) applied.
export const PARTNERSHIP_BO_THRESHOLD_PCT = 15;

/**
 * The ownership % at or above which a natural person is a beneficial owner for
 * the given party nature + legal form. Returns `null` when the threshold is
 * role-based (senior managing official fallback) or when the party is itself a
 * natural person (the principal is the BO). A `partnership` legal form
 * overrides the organization threshold to 15%.
 */
export function boThresholdFor(
  nature: PartyNature,
  legalForm?: LegalForm | null,
): number | null {
  if (legalForm === "partnership") return PARTNERSHIP_BO_THRESHOLD_PCT;
  return BO_THRESHOLD_PCT[nature] ?? null;
}

/**
 * True when the highest identified ownership % crosses the BO threshold for
 * this party nature + legal form - i.e. EDD review is triggered. For
 * role-based fallback natures (government/regulator/natural_person) this
 * returns false (EDD is driven by PEP/sanctions/adverse-media, not ownership
 * %).
 *
 * Per the post-2019 PMLA amendment + PML Rules 2005 Rule 9(3) (research §5.3),
 * the corporate threshold is ≥10% and the trust / partnership threshold is
 * ≥15%. There is NO 25% threshold - that figure is a debunked legacy
 * misattribution (the research §15 risk register calls it out explicitly).
 * Pass `legalForm: 'partnership'` for partnership firms (modeled with
 * party_nature='organization'); otherwise the 10% company threshold applies.
 */
export function requiresEddForBo(
  nature: PartyNature,
  highestBoOwnershipPct: number | string | null,
  legalForm?: LegalForm | null,
): boolean {
  const threshold = boThresholdFor(nature, legalForm);
  if (threshold == null) return false;
  if (highestBoOwnershipPct == null) return false;
  const pct = typeof highestBoOwnershipPct === "string"
    ? Number(highestBoOwnershipPct)
    : highestBoOwnershipPct;
  if (!Number.isFinite(pct)) return false;
  return pct >= threshold;
}

// ---------------------------------------------------------------------------
// Periodic re-KYC periodicity (RBI Master Direction on KYC, FAQ Id=3782).
// low=10yr, medium=8yr, high=2yr. rekyc_due_date = valid_until − lead time so
// the team gets a runway before the record lapses.
// ---------------------------------------------------------------------------

export const RISK_REFRESH_YEARS: Record<KycRisk, number> = {
  low: 10,
  medium: 8,
  high: 2,
};

/** Months of lead time before `valid_until` at which re-KYC becomes due. */
export const RISK_LEAD_TIME_MONTHS: Record<KycRisk, number> = {
  low: 3,
  medium: 3,
  high: 1,
};

/**
 * Default retention horizon for KYC / identity records post-closure (PMLA
 * s.12). Per research §5.2:
 *  - Transaction records: 5 years from the date of the transaction [s.12(3)].
 *  - Identity records (KYC + BO documents, account files, business
 *    correspondence): 5 years after the business relationship ended OR the
 *    account was closed, WHICHEVER IS LATER [s.12(4)].
 * Callers should pass the LATER of {transaction date, relationship-end /
 * account-closure date} as `base` so the computed retention_until honours the
 * "whichever is later" rule. (NOT PML Rules Rule 7 - that rule prescribes the
 * furnishing procedure and carries no retention period; the 10-yr figures in
 * the omitted Rules 6 / 10(3) were deleted by G.S.R. 576(E) dated 27 Aug 2013.)
 */
export const KYC_RETENTION_YEARS = 5;

/**
 * Compute the `valid_until` date for a KYC record from its risk rating and a
 * base date (the CDD/EDD completion date, or today for a new record). Returns
 * an ISO date string (YYYY-MM-DD) suitable for the `date` column.
 */
export function computeValidUntil(
  risk: KycRisk,
  base: Date = new Date(),
): string {
  const years = RISK_REFRESH_YEARS[risk];
  const d = new Date(base);
  d.setFullYear(d.getFullYear() + years);
  return toIsoDate(d);
}

/**
 * Compute the `rekyc_due_date` = `valid_until` − risk-based lead time. The
 * schema marks this column as trigger-maintained; this helper mirrors the
 * trigger logic so Server Actions can populate it on insert/update (and so the
 * UI can show the next-due date before the trigger exists).
 */
export function computeRekycDueDate(
  validUntil: string,
  risk: KycRisk,
): string {
  const d = new Date(validUntil);
  if (!Number.isFinite(d.getTime())) {
    throw new Error(`computeRekycDueDate: invalid valid_until '${validUntil}'`);
  }
  d.setMonth(d.getMonth() - RISK_LEAD_TIME_MONTHS[risk]);
  return toIsoDate(d);
}

/**
 * Compute the retention-until date (PMLA s.12: 5yr from `base`). Pass `base`
 * = the LATER of {transaction date, relationship-end / account-closure date}
 * so the identity-record retention honours s.12(4)'s "whichever is later"
 * rule. See `KYC_RETENTION_YEARS` for the full rule.
 */
export function computeRetentionUntil(
  base: Date = new Date(),
  years: number = KYC_RETENTION_YEARS,
): string {
  const d = new Date(base);
  d.setFullYear(d.getFullYear() + years);
  return toIsoDate(d);
}

// ---------------------------------------------------------------------------
// Status lifecycle.
// ---------------------------------------------------------------------------

/**
 * Allowed forward transitions in the KYC status state machine. A rejected
 * record can be re-opened to in_review (re-submission); an approved record
 * eventually moves to expired → rekyc_due (trigger-driven, but the action can
 * force it). `under_eds_check` is the EDD-specific gate before approval.
 */
export const allowedTransitions: Record<KycStatus, KycStatus[]> = {
  pending: ["in_review"],
  in_review: ["under_eds_check", "approved", "rejected"],
  under_eds_check: ["approved", "rejected", "in_review"],
  approved: ["expired", "rekyc_due"],
  rejected: ["in_review"],
  expired: ["rekyc_due"],
  rekyc_due: ["in_review"],
};

export function canTransition(from: KycStatus, to: KycStatus): boolean {
  return (allowedTransitions[from] ?? []).includes(to);
}

/**
 * Decide whether a record should be routed to EDD (kyc_type='EDD') given its
 * CDD inputs. EDD is required when: any BO crosses the ownership threshold, the
 * principal/BO is a PEP, a sanctions screening match is pending/confirmed, or
 * the risk rating is high. RBI/PMLA §5.8.
 *
 * `legalForm` is forwarded to `requiresEddForBo` so a partnership obligor
 * (modeled with party_nature='organization') is evaluated against the 15%
 * partnership threshold, not the 10% company threshold.
 */
export function shouldEscalateToEdd(input: {
  partyNature: PartyNature;
  highestBoOwnershipPct: number | string | null;
  pepStatus: string | null;
  sanctionsStatus: ScreeningStatus | null;
  riskRating: KycRisk;
  legalForm?: LegalForm | null;
}): boolean {
  if (input.riskRating === "high") return true;
  if (
    requiresEddForBo(
      input.partyNature,
      input.highestBoOwnershipPct,
      input.legalForm,
    )
  ) {
    return true;
  }
  if (input.pepStatus && input.pepStatus !== "none") return true;
  if (
    input.sanctionsStatus &&
    (input.sanctionsStatus === "match" || input.sanctionsStatus === "pending")
  ) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// PEP / sanctions screening — delegates to advanced rule engine (screening.ts).
// ---------------------------------------------------------------------------

/** Sanctions screening seam. */
export function screenSanctions(
  name: string,
  dateOfBirth?: string | null,
  nationality?: string | null,
): ScreeningResult {
  return screenSanctionsAdvanced(name, dateOfBirth, nationality);
}

/** PEP screening seam. */
export function screenPep(
  name: string,
  dateOfBirth?: string | null,
): ScreeningResult {
  return screenPepAdvanced(name, dateOfBirth);
}

// ---------------------------------------------------------------------------
// STR / CTR (research §5.5).
//
// STR: file within 7 working days of forming suspicion to FIU-IND via FINnet
// 2.0 (FINGate) in XML. CTR: auto-aggregate cash & cash-equivalent transactions
// per PAN per month; flag ≥ INR 10 lakh per Rule 3 PML Rules 2005; monthly CTR
// filing. These are policy constants + stub workflow hooks - the actual
// aggregation runs off the transactions subsystem (not yet built).
// ---------------------------------------------------------------------------

export const STR_FILING_DEADLINE_WORKING_DAYS = 7;
export const CTR_MONTHLY_THRESHOLD_INR = 1_000_000; // 10 lakh

// ---------------------------------------------------------------------------
// Internal date helper.
// ---------------------------------------------------------------------------

function toIsoDate(d: Date): string {
  // YYYY-MM-DD in the date's own UTC components - `date` columns are date-only
  // and timezone-naive, so using UTC avoids off-by-one on edge-of-day inputs.
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
