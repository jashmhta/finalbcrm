// Per-deal-type deal_party roles + the lead role for each deal type.
//
// The schema's `deal_party_role` enum is a flat superset of every role across
// every deal type (issuer, arranger, underwriter, investor, book_runner,
// lead_manager, syndicate_member, allocator, guarantor, trustee, registrar,
// rating_agency, legal_counsel, auditor, escrow_agent, selling_broker,
// buy_side_advisor, sell_side_advisor, target, acquirer, co_arranger). A flat
// superset is fine at the DB level but is NOT business-logic appropriate on
// its own: an M&A mandate has no "issuer"/"underwriter"/"book_runner", and a
// bond underwriting has no "target"/"acquirer"/"buy_side_advisor". This module
// encodes, per deal_type, the subset of roles that are valid for that mandate
// type plus the role that the lead (primary client) party plays.
//
// Verified against scrape/BUSINESS_CONTEXT.md §2-3 (BC/Binary Bonds service
// roles) and the role list specified for this audit (issuer, arranger,
// underwriter, investor, book_runner, lead_manager, syndicate_member,
// allocator). All eight required roles are present in the schema enum and are
// assigned to the appropriate deal types below.
//
// Pure helpers - no DB access.

import type { DealPartyRole, DealType } from "./catalog";

// Reusable role groups (the deal_party_role subsets that recur across types).
const FIXED_INCOME_SYNDICATE: readonly DealPartyRole[] = [
  "arranger",
  "co_arranger",
  "underwriter",
  "book_runner",
  "lead_manager",
  "syndicate_member",
  "allocator",
  "selling_broker",
];
const BOND_FIDUCIARY: readonly DealPartyRole[] = [
  "trustee",
  "registrar",
  "escrow_agent",
  "guarantor",
];
const ADVISORY_PROFESSIONALS: readonly DealPartyRole[] = [
  "rating_agency",
  "legal_counsel",
  "auditor",
];
const M_AND_A_ROLES: readonly DealPartyRole[] = [
  "target",
  "acquirer",
  "buy_side_advisor",
  "sell_side_advisor",
  "legal_counsel",
  "auditor",
  "rating_agency",
];

export interface DealRoleSpec {
  /** Roles valid for this deal type (the lead role is included). */
  roles: readonly DealPartyRole[];
  /**
   * The role the lead (primary client) party plays. For issuance deals this is
   * `issuer`; for G-Sec / secondary / portfolio mandates it is `investor`
   * (BC's client is the buy-side, or BC itself is the buyer); for M&A
   * sell-side it is `target` (buy-side engagements lead with `acquirer`); for
   * valuation it is `target`; for fairness opinion it is the party being
   * advised (commonly `target`).
   */
  leadRole: DealPartyRole;
}

function uniq<T>(arr: readonly T[]): readonly T[] {
  return Array.from(new Set(arr));
}

export const DEAL_TYPE_ROLES: Record<DealType, DealRoleSpec> = {
  bond_underwriting: {
    roles: uniq([
      "issuer",
      ...FIXED_INCOME_SYNDICATE,
      "investor",
      ...BOND_FIDUCIARY,
      ...ADVISORY_PROFESSIONALS,
    ]),
    leadRole: "issuer",
  },
  high_yield_bond: {
    roles: uniq([
      "issuer",
      ...FIXED_INCOME_SYNDICATE,
      "investor",
      ...BOND_FIDUCIARY,
      ...ADVISORY_PROFESSIONALS,
    ]),
    leadRole: "issuer",
  },
  private_placement_debt: {
    roles: uniq([
      "issuer",
      "arranger",
      "co_arranger",
      "underwriter",
      "lead_manager",
      "allocator",
      "selling_broker",
      "investor",
      "trustee",
      "registrar",
      "escrow_agent",
      "guarantor",
      "rating_agency",
      "legal_counsel",
      "auditor",
    ]),
    leadRole: "issuer",
  },
  dcm_advisory: {
    // Advisory altitude - no investor / trustee / registrar (execution is
    // owned by Binary Bonds, not this advisory mandate).
    roles: uniq([
      "issuer",
      "arranger",
      "lead_manager",
      "rating_agency",
      "legal_counsel",
      "auditor",
    ]),
    leadRole: "issuer",
  },
  gsec_auction: {
    // BC bids in the RBI auction as participant / on behalf of clients. The
    // "issuer" is the GoI / RBI (not a party row); the lead party is the
    // investor (BC's client, or BC itself).
    roles: uniq(["investor", "arranger", "selling_broker"]),
    leadRole: "investor",
  },
  secondary_trading_advisory: {
    roles: uniq(["investor", "arranger", "selling_broker"]),
    leadRole: "investor",
  },
  ecm_ipo: {
    roles: uniq([
      "issuer",
      "arranger",
      "co_arranger",
      "underwriter",
      "book_runner",
      "lead_manager",
      "syndicate_member",
      "registrar",
      "escrow_agent",
      "investor",
      "selling_broker",
      "legal_counsel",
      "auditor",
      "rating_agency",
    ]),
    leadRole: "issuer",
  },
  ecm_fpo: {
    roles: uniq([
      "issuer",
      "arranger",
      "co_arranger",
      "underwriter",
      "book_runner",
      "lead_manager",
      "syndicate_member",
      "registrar",
      "escrow_agent",
      "investor",
      "selling_broker",
      "legal_counsel",
      "auditor",
      "rating_agency",
    ]),
    leadRole: "issuer",
  },
  ecm_qip: {
    roles: uniq([
      "issuer",
      "arranger",
      "co_arranger",
      "underwriter",
      "book_runner",
      "lead_manager",
      "syndicate_member",
      "registrar",
      "escrow_agent",
      "investor",
      "selling_broker",
      "legal_counsel",
      "auditor",
      "rating_agency",
    ]),
    leadRole: "issuer",
  },
  ecm_rights: {
    roles: uniq([
      "issuer",
      "arranger",
      "co_arranger",
      "underwriter",
      "book_runner",
      "lead_manager",
      "syndicate_member",
      "registrar",
      "escrow_agent",
      "investor",
      "selling_broker",
      "legal_counsel",
      "auditor",
      "rating_agency",
    ]),
    leadRole: "issuer",
  },
  structured_finance: {
    roles: uniq([
      "issuer",
      "arranger",
      "lead_manager",
      "investor",
      "trustee",
      "registrar",
      "escrow_agent",
      "guarantor",
      "rating_agency",
      "legal_counsel",
      "auditor",
    ]),
    leadRole: "issuer",
  },
  supply_chain_finance: {
    // The anchor buyer is the primary client (modeled as `issuer` of the
    // program); suppliers are modeled as `investor` (beneficiaries of the
    // early-payment program).
    roles: uniq([
      "issuer",
      "arranger",
      "investor",
      "guarantor",
      "legal_counsel",
      "auditor",
    ]),
    leadRole: "issuer",
  },
  project_finance: {
    roles: uniq([
      "issuer",
      "arranger",
      "lead_manager",
      "investor",
      "guarantor",
      "trustee",
      "rating_agency",
      "legal_counsel",
      "auditor",
    ]),
    leadRole: "issuer",
  },
  m_and_a: {
    roles: M_AND_A_ROLES,
    // Sell-side default (BC's most common M&A engagement). Buy-side
    // engagements lead with `acquirer` + `buy_side_advisor`.
    leadRole: "target",
  },
  rating_advisory: {
    roles: uniq(["issuer", "arranger", "rating_agency", "legal_counsel", "auditor"]),
    leadRole: "issuer",
  },
  valuation: {
    roles: uniq([
      "target",
      "buy_side_advisor",
      "sell_side_advisor",
      "legal_counsel",
      "auditor",
      "rating_agency",
    ]),
    leadRole: "target",
  },
  fairness_opinion: {
    roles: uniq([
      "target",
      "acquirer",
      "buy_side_advisor",
      "sell_side_advisor",
      "legal_counsel",
      "auditor",
      "rating_agency",
    ]),
    leadRole: "target",
  },
  portfolio_management_mandate: {
    // BC manages an institutional client's bond portfolio; the client is the
    // investor (lead).
    roles: uniq(["investor", "legal_counsel", "auditor"]),
    leadRole: "investor",
  },
};

/** All roles valid for a deal type (includes the lead role). */
export function validRolesForDealType(dealType: DealType): readonly DealPartyRole[] {
  return DEAL_TYPE_ROLES[dealType].roles;
}

/** The role the lead (primary client) party plays for a deal type. */
export function leadRoleForDealType(dealType: DealType): DealPartyRole {
  return DEAL_TYPE_ROLES[dealType].leadRole;
}

/** True when `role` is a valid deal_party role for the given deal type. */
export function isValidRoleForDealType(
  dealType: DealType,
  role: DealPartyRole | string | null | undefined,
): boolean {
  if (!role) return false;
  return (
    DEAL_TYPE_ROLES[dealType].roles as readonly string[]
  ).includes(role);
}
