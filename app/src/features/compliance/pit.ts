// SEBI (Prohibition of Insider Trading) Regulations 2015 - Reg 9 + Schedule B.
//
// Research: COMPLIANCE_LEGAL_FEASIBILITY.md §3.7 (PIT / Chinese walls), §7
// item 8 (designated-person & pre-clearance workflow), and §15 risk register
// (PIT / Chinese-wall failure is a HIGH-severity risk for BC given dual
// advisory/corporate-finance + potential secondary-trading activity).
//
// This module encodes the PIT business rules the CRM must enforce:
//   - a designated-person register (BC staff who handle UPSI + their immediate
//     relatives + connected persons), per Reg 2(d) / 9(1);
//   - pre-clearance of trades by designated persons in securities of issuers
//     BC has a relationship/UPSI with, per Reg 9(2) + Schedule B Para 3;
//   - trading-window closures around UPSI events + the quarterly results
//     window (Schedule B Para 1.1: closed from quarter-end until 48 hours
//     after disclosure of results);
//   - the information-barrier interplay - a closed window blocks trade
//     execution regardless of pre-clearance.
//
// The DB schema has no designated-person / trading-window tables (PIT was
// previously missing entirely from the compliance feature). Per the audit
// constraint "no schema changes - fix via migrations + view layer", these are
// PURE domain-logic helpers + type definitions so the rules are encoded,
// unit-testable, and ready for the mutation/view layers (and a future backing
// table) to consume. They are the SEAM: replace the deterministic helpers with
// live registry reads when the tables land.

// ---------------------------------------------------------------------------
// Designated-person register (Reg 2(d), Reg 9(1)).
// ---------------------------------------------------------------------------

/**
 * Category of designated person. BC staff who handle UPSI in advisory /
 * corporate-finance / credit / bond-underwriting roles are insiders; their
 * immediate relatives and other connected persons are designated by
 * association. The trading desk is designated even though it is walled OFF
 * from UPSI (the wall is the defence; designation is the audit surface).
 */
export type DesignatedPersonCategory =
  | "advisory_corporate_finance" // IB advisory / DCM / M&A / ECM - issuer UPSI
  | "credit_analyst" // credit analysis on issuers (issuer financials = UPSI)
  | "bond_underwriting_desk" // bond underwriting / structuring / placement
  | "rating_advisory" // rating advisory (rating-action UPSI pre-publication)
  | "trading_desk" // secondary trading / market-making (walled, but designated)
  | "compliance_finance" // compliance / finance with potential UPSI access
  | "immediate_relative" // immediate relatives of any of the above (Reg 2(d))
  | "connected_person"; // other connected persons per Reg 2(d)

export interface DesignatedPersonEntry {
  /** Internal user (BC staff) - null for non-employee connected persons. */
  appUserId?: string | null;
  /** External party (for connected persons who are not BC staff). */
  partyId?: string | null;
  category: DesignatedPersonCategory;
  /**
   * True when this person has access to UPSI (the insider population). Trades
   * by insiders in walled issuers' securities require pre-clearance and are
   * blocked during closed trading windows.
   */
  isInsider: boolean;
  /** When the designation took effect. */
  designatedAt: Date;
  /** When the designation ended (null = active). */
  deDesignatedAt?: Date | null;
}

/** True when a designation is active as of `now` (not yet de-designated). */
export function isActiveDesignatedPerson(
  entry: DesignatedPersonEntry,
  now: Date = new Date(),
): boolean {
  if (entry.designatedAt > now) return false;
  return entry.deDesignatedAt == null || entry.deDesignatedAt > now;
}

/** True for categories that are BC-staff insiders (not relatives/connected). */
export function isInsiderCategory(
  category: DesignatedPersonCategory,
): boolean {
  switch (category) {
    case "advisory_corporate_finance":
    case "credit_analyst":
    case "bond_underwriting_desk":
    case "rating_advisory":
    case "compliance_finance":
      return true;
    case "trading_desk":
      // The trading desk is designated but WALLED from UPSI; it is not an
      // insider population (the Chinese wall is the defence). isInsider on the
      // entry is the authoritative flag.
      return false;
    case "immediate_relative":
    case "connected_person":
      return false;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// UPSI events that trigger an ad-hoc trading-window closure for an issuer.
// ---------------------------------------------------------------------------

/**
 * The BC deal/credit events that create UPSI in an issuer's securities and
 * therefore close the trading window for that issuer's designated persons
 * until 48 hours after public disclosure.
 */
export type PitUpsiEvent =
  | "mandate" // a new advisory/underwriting mandate with the issuer
  | "structuring" // structuring / term-sheet stage (pricing, coupon, security)
  | "rating_action" // a pending rating action on the issuer
  | "bond_pricing" // bond pricing / book-building
  | "allocation" // allocation of a bond/ECM issue
  | "ma_signing" // M&A signing / SPA
  | "project_finance_close" // project finance financial close
  | "other";

// ---------------------------------------------------------------------------
// Pre-clearance workflow (Reg 9(2) + Schedule B Para 3).
// ---------------------------------------------------------------------------

export type PreClearanceStatus =
  | "pending"
  | "approved"
  | "denied"
  | "withdrawn"
  | "expired"
  | "executed"
  | "closed";

/**
 * Allowed pre-clearance status transitions. A pending request is approved or
 * denied (or withdrawn by the requester). An approval must be EXECUTED within
 * `PRE_CLEARANCE_VALIDITY_DAYS` or it expires; a closed trading window blocks
 * execution. A denial / expiry may be re-submitted (→ pending). An executed
 * trade moves to closed once the trade-confirmation is on file.
 */
export const PRE_CLEARANCE_TRANSITIONS: Record<
  PreClearanceStatus,
  PreClearanceStatus[]
> = {
  pending: ["approved", "denied", "withdrawn"],
  approved: ["executed", "expired", "withdrawn"],
  denied: ["pending"],
  withdrawn: [],
  expired: ["pending"],
  executed: ["closed"],
  closed: [],
};

export function canTransitionPreClearance(
  from: PreClearanceStatus,
  to: PreClearanceStatus,
): boolean {
  return (PRE_CLEARANCE_TRANSITIONS[from] ?? []).includes(to);
}

/**
 * Number of days a pre-clearance approval remains valid for execution. A
 * designated person must execute the trade within this window or re-apply.
 * (Schedule B Para 3 expects pre-clearance to be tightly time-bounded.)
 */
export const PRE_CLEARANCE_VALIDITY_DAYS = 5;

// ---------------------------------------------------------------------------
// Trading window (Schedule B Para 1.1).
// ---------------------------------------------------------------------------

/**
 * Per Schedule B Para 1.1: the trading window is closed from the end of the
 * quarter until 48 hours after the declaration of results. This is the
 * hours-after-disclosure gap before the window re-opens.
 */
export const POST_DISCLOSURE_WINDOW_HOURS = 48;

export type TradingWindowState = "open" | "closed_quarterly" | "closed_event";

export interface TradingWindowClosure {
  /** The issuer whose securities are walled. */
  partyId: string;
  state: TradingWindowState;
  /** When the closure started. */
  closedFrom: Date;
  /**
   * When the closure ends. Null when the closure runs until 48 hours after
   * disclosure (use `disclosedAt` + POST_DISCLOSURE_WINDOW_HOURS).
   */
  closedUntil: Date | null;
  /** For closed_event: the UPSI event that triggered the closure. */
  triggerEvent?: PitUpsiEvent;
  /** When the UPSI was publicly disclosed (null = not yet disclosed). */
  disclosedAt?: Date | null;
}

/**
 * The timestamp at which a closed window re-opens. If `closedUntil` is set,
 * that wins; otherwise the window re-opens 48 hours after `disclosedAt`. If
 * neither is set, the window is closed indefinitely (return null).
 */
export function computeWindowReopen(
  closure: TradingWindowClosure,
): Date | null {
  if (closure.closedUntil) return closure.closedUntil;
  if (closure.disclosedAt) {
    const d = new Date(closure.disclosedAt);
    d.setHours(d.getHours() + POST_DISCLOSURE_WINDOW_HOURS);
    return d;
  }
  return null;
}

/**
 * True when a trading window is currently closed for an issuer - a designated
 * person may NOT trade the issuer's securities while this is true, regardless
 * of pre-clearance. A window is closed iff `now` is within [closedFrom,
 * reopen). `state === "open"` is always open.
 */
export function isTradingWindowClosed(
  closure: TradingWindowClosure,
  now: Date = new Date(),
): boolean {
  if (closure.state === "open") return false;
  if (now < closure.closedFrom) return false;
  const reopen = computeWindowReopen(closure);
  if (!reopen) return true; // closed-ended with no disclosure yet
  return now < reopen;
}

/**
 * Build the standard quarterly closure (Schedule B Para 1.1): the window
 * closes at quarter-end and re-opens 48 hours after the results-disclosure
 * timestamp.
 */
export function quarterlyClosureFor(
  partyId: string,
  quarterEndDate: Date,
  disclosureAt: Date,
): TradingWindowClosure {
  return {
    partyId,
    state: "closed_quarterly",
    closedFrom: quarterEndDate,
    closedUntil: null,
    disclosedAt: disclosureAt,
  };
}

/**
 * Build an ad-hoc event closure for an issuer UPSI event. The window closes
 * immediately (`closedFrom = now`) and re-opens 48 hours after `disclosedAt`
 * (or on the explicit `closedUntil` if provided).
 */
export function eventClosureFor(
  partyId: string,
  trigger: PitUpsiEvent,
  now: Date = new Date(),
  disclosedAt: Date | null = null,
  closedUntil: Date | null = null,
): TradingWindowClosure {
  return {
    partyId,
    state: "closed_event",
    closedFrom: now,
    closedUntil,
    triggerEvent: trigger,
    disclosedAt,
  };
}

// ---------------------------------------------------------------------------
// Pre-clearance decision helpers.
// ---------------------------------------------------------------------------

/**
 * Whether a designated person must pre-clear a trade in `issuerPartyId`'s
 * securities. Per Reg 9(2), an insider must pre-clear trades in securities of
 * issuers BC has a relationship/UPSI with. A closed trading window does NOT
 * remove the pre-clearance requirement - it blocks execution separately (see
 * `canExecutePreClearance`).
 */
export function requiresPreClearance(
  dp: { isInsider: boolean } | null | undefined,
  issuerPartyId: string | null | undefined,
  hasRelationship: boolean,
): boolean {
  if (!issuerPartyId) return false;
  if (!dp?.isInsider) return false;
  return hasRelationship;
}

/**
 * Whether a pre-cleared trade may be EXECUTED now. Requires the request to be
 * `approved`, the trading window for the issuer to be OPEN, and the approval
 * to be within its validity window (`PRE_CLEARANCE_VALIDITY_DAYS`).
 */
export function canExecutePreClearance(input: {
  status: PreClearanceStatus;
  approvedAt: Date | null;
  windowClosed: boolean;
  now?: Date;
}): boolean {
  if (input.status !== "approved") return false;
  if (input.windowClosed) return false;
  if (!input.approvedAt) return false;
  const now = input.now ?? new Date();
  const expiry = new Date(input.approvedAt);
  expiry.setDate(expiry.getDate() + PRE_CLEARANCE_VALIDITY_DAYS);
  return now <= expiry;
}

/**
 * Compute the expiry timestamp of a pre-clearance approval (approvedAt +
 * PRE_CLEARANCE_VALIDITY_DAYS), for storage / UI display.
 */
export function computePreClearanceExpiry(
  approvedAt: Date,
): Date {
  const d = new Date(approvedAt);
  d.setDate(d.getDate() + PRE_CLEARANCE_VALIDITY_DAYS);
  return d;
}
