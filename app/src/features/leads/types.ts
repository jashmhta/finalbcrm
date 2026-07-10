// Lead & Opportunity Management - shared types + domain constants.
//
// A lead is a prospect relationship the firm is qualifying toward a mandate.
// Storage: a JSONB `lead_meta` column on party (migration 0006_leads.sql).
// A party is a lead iff party.lead_meta IS NOT NULL. See the migration header
// for the full design rationale (single source of truth = party master; the
// JSONB blob carries the lead-specific state the frozen party schema lacks).
//
// Domain (Indian bond house / IB):
//   Lead        → a new contact/company that might become a client.
//   Qualify     → BANT (Budget / Authority / Need / Timeline).
//   Opportunity → a qualified lead with a concrete deal potential.
//   Convert     → lead → opportunity → deal (won). Lost leads carry a reason.
//
// The lead funnel stages are DISTINCT from the deal execution pipeline
// (deal_status: lead/mandated/in_dd/…/closed/dropped) - a lead stays in
// lead_meta until it is WON, at which point a real deal row is created and
// linked back via convertedDealId. The Deals module is never polluted by
// pre-mandate leads.

/** Lead funnel stage. The board's kanban columns, in canonical order. */
export type LeadStage = "new" | "qualified" | "opportunity" | "won" | "lost";

/** How the lead entered the pipeline. Drives the by-source conversion view. */
export type LeadSource =
  | "referral"
  | "website"
  | "event"
  | "cold_call"
  | "existing_client";

/** Potential deal type a lead is being qualified for. A subset of the
 *  deal_type enum that matches the firm's service umbrella (bond house + IB).
 *  Stored as the enum string in lead_meta.dealType so a won lead can flow
 *  straight into a real deal row with the same deal_type. */
export type LeadDealType =
  | "bond_underwriting"
  | "gsec_auction"
  | "high_yield_bond"
  | "rating_advisory"
  | "m_and_a"
  | "project_finance"
  | "structured_finance"
  | "supply_chain_finance"
  | "dcm_advisory"
  | "private_placement_debt"
  | "portfolio_management_mandate"
  | "secondary_trading_advisory";

/** BANT qualification. Each criterion is a boolean toggle on the detail page. */
export interface BantQualification {
  budget: boolean;
  authority: boolean;
  need: boolean;
  timeline: boolean;
}

/** The lead_meta JSONB shape stored on party.lead_meta. */
export interface LeadMeta {
  stage: LeadStage;
  source: LeadSource;
  dealType: LeadDealType;
  /** Estimated deal size in ₹ Cr (face value / mandate size). */
  estSizeCr: number | null;
  /** Win probability 0–100. */
  probability: number;
  /** Expected close / mandate date (ISO yyyy-mm-dd) or null. */
  expectedClose: string | null;
  /** Assigned RM - app_user.user_id (uuid as text) or null (unassigned). */
  assignedRm: string | null;
  /** Primary contact captured with the lead. */
  contactName: string | null;
  contactTitle: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  bant: BantQualification;
  notes: string | null;
  /** Reason recorded when a lead is lost. */
  lossReason: string | null;
  /** deal.deal_id (uuid as text) created when the lead is won, else null. */
  convertedDealId: string | null;
  /** ISO timestamp recorded when the lead was won or lost, else null. Drives
   *  the conversions-over-time chart on the pipeline dashboard. */
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Canonical orderings + display labels (single source of truth for the UI).
// ---------------------------------------------------------------------------

/** Board column order - the qualification funnel, terminal states last. */
export const LEAD_STAGE_ORDER: LeadStage[] = [
  "new",
  "qualified",
  "opportunity",
  "won",
  "lost",
];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  qualified: "Qualified",
  opportunity: "Opportunity",
  won: "Won",
  lost: "Lost",
};

/** One-line hint under each column header - what the stage means. */
export const LEAD_STAGE_HINTS: Record<LeadStage, string> = {
  new: "Freshly captured - awaiting first qualification.",
  qualified: "BANT cleared - a real financing need.",
  opportunity: "Concrete deal potential - in active pursuit.",
  won: "Converted to a mandate.",
  lost: "Closed without a mandate.",
};

/** Default probability by stage - used on create / stage promotion so the
 *  probability bar reads sensibly before the RM tunes it. */
export const LEAD_STAGE_DEFAULT_PROBABILITY: Record<LeadStage, number> = {
  new: 10,
  qualified: 30,
  opportunity: 50,
  won: 100,
  lost: 0,
};

/** Semantic tone for a stage - maps to the brand Badge variants. */
export const LEAD_STAGE_TONE: Record<
  LeadStage,
  "neutral" | "info" | "gold" | "emerald" | "down"
> = {
  new: "info",
  qualified: "neutral",
  opportunity: "gold",
  won: "emerald",
  lost: "down",
};

export const LEAD_SOURCE_ORDER: LeadSource[] = [
  "referral",
  "website",
  "event",
  "cold_call",
  "existing_client",
];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  referral: "Referral",
  website: "Website",
  event: "Event",
  cold_call: "Cold call",
  existing_client: "Existing client",
};

export const LEAD_DEAL_TYPE_ORDER: LeadDealType[] = [
  "bond_underwriting",
  "high_yield_bond",
  "private_placement_debt",
  "gsec_auction",
  "structured_finance",
  "supply_chain_finance",
  "project_finance",
  "dcm_advisory",
  "rating_advisory",
  "m_and_a",
  "portfolio_management_mandate",
  "secondary_trading_advisory",
];

export const LEAD_DEAL_TYPE_LABELS: Record<LeadDealType, string> = {
  bond_underwriting: "Bond Underwriting",
  high_yield_bond: "High-Yield Bond",
  private_placement_debt: "Private Placement",
  gsec_auction: "G-Sec Auction",
  structured_finance: "Structured Finance",
  supply_chain_finance: "Supply-Chain Finance",
  project_finance: "Project Finance",
  dcm_advisory: "DCM Advisory",
  rating_advisory: "Rating Advisory",
  m_and_a: "M&A Advisory",
  portfolio_management_mandate: "Portfolio Mandate",
  secondary_trading_advisory: "Secondary Advisory",
};

/** Short label for dense cards / chips. */
export const LEAD_DEAL_TYPE_SHORT: Record<LeadDealType, string> = {
  bond_underwriting: "Bond UW",
  high_yield_bond: "HY Bond",
  private_placement_debt: "PP Debt",
  gsec_auction: "G-Sec",
  structured_finance: "Struct Fin",
  supply_chain_finance: "SCF",
  project_finance: "Proj Fin",
  dcm_advisory: "DCM",
  rating_advisory: "Rating",
  m_and_a: "M&A",
  portfolio_management_mandate: "PMS",
  secondary_trading_advisory: "Secondary",
};

/** Canonical BANT criteria - the qualification checklist order. */
export const BANT_CRITERIA = [
  "budget",
  "authority",
  "need",
  "timeline",
] as const;

export type BantCriterion = (typeof BANT_CRITERIA)[number];

export const BANT_LABELS: Record<BantCriterion, string> = {
  budget: "Budget",
  authority: "Authority",
  need: "Need",
  timeline: "Timeline",
};

export const BANT_HINTS: Record<BantCriterion, string> = {
  budget: "Can they afford the fee / ticket size for this mandate?",
  authority: "Is the contact a decision-maker on the mandate?",
  need: "Is there a real, current financing need?",
  timeline: "Is there a defined timeline to act?",
};

/** Loss reasons - the closed-lost vocabulary for an Indian bond house / IB. */
export const LEAD_LOSS_REASONS = [
  "pricing_uncompetitive",
  "competitor_selected",
  "deal_deferred",
  "client_withdrew",
  "failed_kyc",
  "no_budget",
  "lost_to_in_house",
  "other",
] as const;

export type LeadLossReason = (typeof LEAD_LOSS_REASONS)[number];

export const LEAD_LOSS_REASON_LABELS: Record<LeadLossReason, string> = {
  pricing_uncompetitive: "Pricing uncompetitive",
  competitor_selected: "Competitor selected",
  deal_deferred: "Deal deferred",
  client_withdrew: "Client withdrew",
  failed_kyc: "KYC / compliance failed",
  no_budget: "No budget",
  lost_to_in_house: "Lost to in-house",
  other: "Other",
};

/** A lead is fully BANT-qualified when all four criteria are met. */
export function isQualified(bant: BantQualification): boolean {
  return bant.budget && bant.authority && bant.need && bant.timeline;
}

/** Count of met BANT criteria (0–4) - drives the qualification progress ring. */
export function bantScore(bant: BantQualification): number {
  return (
    Number(bant.budget) +
    Number(bant.authority) +
    Number(bant.need) +
    Number(bant.timeline)
  );
}
