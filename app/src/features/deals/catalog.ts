// Deal-type catalog - the verified Binary Capital / Binary Bonds service map.
//
// Source of truth for "which deal types does this CRM model, and is each one
// business-logic appropriate for BC?": scrape/BUSINESS_CONTEXT.md §2-3 and
// docs/CREDIT_ANALYSIS_SPEC.md / FINANCIAL_MODELING_SPEC.md. The schema enum
// (src/db/schema/enums.ts `dealTypeEnum`) is the DB-level constraint; this
// module is the domain-level catalog that classifies every enum value into a
// product family, brand affinity, credit character, and the execution
// semantics the deals feature needs (whether the deal uses the allocation
// book, whether it carries an issuer instrument, etc.).
//
// Pure constants + types - no DB access - so this is safe to import from both
// Server Components (queries.ts) and Server Actions (actions.ts) and can be
// unit-tested in isolation. The DealType / DealStatus / DealPartyRole /
// AllocEventType unions are derived from the schema enums so they cannot drift
// from the DB.

import {
  allocEventTypeEnum,
  dealPartyRoleEnum,
  dealStatusEnum,
  dealTypeEnum,
} from "@/db/schema";

/** Every deal_type the CRM accepts - derived from the schema enum. */
export type DealType = (typeof dealTypeEnum.enumValues)[number];

/** Every deal_status (pipeline stage + off-pipeline) - derived from the enum. */
export type DealStatus = (typeof dealStatusEnum.enumValues)[number];

/** Every deal_party role - derived from the schema enum. */
export type DealPartyRole = (typeof dealPartyRoleEnum.enumValues)[number];

/** Every allocation_event type - derived from the schema enum. */
export type AllocEventType = (typeof allocEventTypeEnum.enumValues)[number];

// ---------------------------------------------------------------------------
// Product families + brand affinity.
// ---------------------------------------------------------------------------

export type DealFamily =
  | "fixed_income_primary" // bond underwriting / HY / private placement / DCM
  | "gsec" // RBI G-Sec/SDL/T-Bill/SGB auction + secondary
  | "ecm" // equity capital markets
  | "advisory" // M&A, rating advisory, valuation, fairness
  | "structured_credit" // structured finance / supply-chain / project finance
  | "portfolio"; // portfolio management mandate

export type BrandAffinity = "binarycapital" | "binarybonds" | "shared";

/**
 * The credit character a deal type carries - used by the view-layer rating chip
 * and by credit-side logic to decide whether a credit_analysis / internal
 * rating is expected. `none` for non-credit mandates (M&A advisory, valuation,
 * fairness opinion, portfolio mandate, secondary advisory).
 */
export type CreditCharacter =
  | "sovereign" // G-Sec / SDL / T-Bill / SGB - risk-free
  | "investment_grade" // vanilla corp bond underwriting / private placement
  | "high_yield" // sub-IG corp bonds
  | "structured" // structured credit / project finance / SCF (deal-specific)
  | "equity" // ECM
  | "none"; // advisory / valuation / portfolio / secondary

export interface DealTypeSpec {
  /** Stable enum value (DealType). */
  type: DealType;
  /** Human label. */
  label: string;
  /** Product family for grouping. */
  family: DealFamily;
  /** Which BC brand primarily owns this product line. */
  brand: BrandAffinity;
  /** Credit character - drives whether a credit band / rating applies. */
  creditCharacter: CreditCharacter;
  /**
   * True when the deal runs an allocation book (investor indications → orders
   * → allocation → settlement). Bond underwriting, HY, private placement,
   * G-Sec auction, and ECM book-built offers do; pure advisory / valuation /
   * portfolio mandates do not. See allocations.ts.
   */
  usesAllocationBook: boolean;
  /**
   * True when the deal has an issuer + instrument (a security is being issued
   * or placed). False for advisory-only mandates (M&A, valuation, fairness,
   * rating advisory, portfolio mandate, secondary advisory) where BC is not
   * placing a new instrument.
   */
  hasIssuerInstrument: boolean;
  /** One-line business-logic-appropriateness note (auditable). */
  rationale: string;
}

/**
 * The verified catalog. Every schema enum value MUST appear here - the
 * `assertCatalogCoversEnum` call below enforces this at compile time so a
 * future enum addition cannot silently slip past the domain layer.
 */
export const DEAL_TYPE_CATALOG: Record<DealType, DealTypeSpec> = {
  bond_underwriting: {
    type: "bond_underwriting",
    label: "Corporate Bond Underwriting",
    family: "fixed_income_primary",
    brand: "binarybonds",
    creditCharacter: "investment_grade",
    usesAllocationBook: true,
    hasIssuerInstrument: true,
    rationale:
      "Binary Bonds core: underwrite + place corp debt (IG) with institutional investors.",
  },
  high_yield_bond: {
    type: "high_yield_bond",
    label: "High-Yield Bond",
    family: "fixed_income_primary",
    brand: "binarybonds",
    creditCharacter: "high_yield",
    usesAllocationBook: true,
    hasIssuerInstrument: true,
    rationale:
      "Binary Bonds HY desk: sub-IG paper, 200-500bps premium, EDD-weighted.",
  },
  private_placement_debt: {
    type: "private_placement_debt",
    label: "Private Placement (Debt)",
    family: "fixed_income_primary",
    brand: "binarybonds",
    creditCharacter: "investment_grade",
    usesAllocationBook: true,
    hasIssuerInstrument: true,
    rationale:
      "Binary Bonds / Binary Capital private placements (NCDs/CP, listed & unlisted).",
  },
  gsec_auction: {
    type: "gsec_auction",
    label: "G-Sec / SDL / T-Bill / SGB Auction",
    family: "gsec",
    brand: "binarybonds",
    creditCharacter: "sovereign",
    usesAllocationBook: true,
    hasIssuerInstrument: true,
    rationale:
      "Binary Bonds RBI auction participation (GoI dated, SDL, T-Bill, SGB).",
  },
  dcm_advisory: {
    type: "dcm_advisory",
    label: "Debt Capital Markets Advisory",
    family: "fixed_income_primary",
    brand: "binarycapital",
    creditCharacter: "investment_grade",
    usesAllocationBook: false,
    hasIssuerInstrument: false,
    rationale:
      "Binary Capital DCM advisory (bonds/NCDs/CP/green bonds) - advisory altitude, execution via Binary Bonds.",
  },
  ecm_ipo: {
    type: "ecm_ipo",
    label: "ECM: IPO",
    family: "ecm",
    brand: "binarycapital",
    creditCharacter: "equity",
    usesAllocationBook: true,
    hasIssuerInstrument: true,
    rationale: "Binary Capital ECM: initial public offers (book-built).",
  },
  ecm_fpo: {
    type: "ecm_fpo",
    label: "ECM: FPO",
    family: "ecm",
    brand: "binarycapital",
    creditCharacter: "equity",
    usesAllocationBook: true,
    hasIssuerInstrument: true,
    rationale: "Binary Capital ECM: follow-on public offers.",
  },
  ecm_qip: {
    type: "ecm_qip",
    label: "ECM: QIP",
    family: "ecm",
    brand: "binarycapital",
    creditCharacter: "equity",
    usesAllocationBook: true,
    hasIssuerInstrument: true,
    rationale: "Binary Capital ECM: qualified institutions placement.",
  },
  ecm_rights: {
    type: "ecm_rights",
    label: "ECM: Rights Issue",
    family: "ecm",
    brand: "binarycapital",
    creditCharacter: "equity",
    usesAllocationBook: true,
    hasIssuerInstrument: true,
    rationale: "Binary Capital ECM: rights issues.",
  },
  m_and_a: {
    type: "m_and_a",
    label: "M&A Advisory",
    family: "advisory",
    brand: "binarycapital",
    creditCharacter: "none",
    usesAllocationBook: false,
    hasIssuerInstrument: false,
    rationale:
      "Binary Capital M&A (buy-side / sell-side / valuations / PMI) - no instrument placed.",
  },
  rating_advisory: {
    type: "rating_advisory",
    label: "Credit Rating Advisory",
    family: "advisory",
    brand: "binarybonds",
    creditCharacter: "none",
    usesAllocationBook: false,
    hasIssuerInstrument: false,
    rationale:
      "Binary Bonds rating advisory (CRISIL/ICRA/CARE/India Ratings/Acuite/Infomerics) - no instrument placed.",
  },
  valuation: {
    type: "valuation",
    label: "Valuation",
    family: "advisory",
    brand: "binarycapital",
    creditCharacter: "none",
    usesAllocationBook: false,
    hasIssuerInstrument: false,
    rationale: "Binary Capital independent valuations (DCF/comparables/precedent).",
  },
  fairness_opinion: {
    type: "fairness_opinion",
    label: "Fairness Opinion",
    family: "advisory",
    brand: "binarycapital",
    creditCharacter: "none",
    usesAllocationBook: false,
    hasIssuerInstrument: false,
    rationale: "Binary Capital fairness opinions (M&A / related-party transactions).",
  },
  project_finance: {
    type: "project_finance",
    label: "Project Finance",
    family: "structured_credit",
    brand: "binarycapital",
    creditCharacter: "structured",
    usesAllocationBook: false,
    hasIssuerInstrument: false,
    rationale:
      "Binary Capital project finance - non-recourse/limited-recourse SPV financing (no public allocation book).",
  },
  structured_finance: {
    type: "structured_finance",
    label: "Structured Finance / Securitization",
    family: "structured_credit",
    brand: "binarycapital",
    creditCharacter: "structured",
    usesAllocationBook: false,
    hasIssuerInstrument: true,
    rationale:
      "Binary Capital structured finance - ABS/securitization/tranching/credit enhancement.",
  },
  supply_chain_finance: {
    type: "supply_chain_finance",
    label: "Supply-Chain Finance",
    family: "structured_credit",
    brand: "binarycapital",
    creditCharacter: "structured",
    usesAllocationBook: false,
    hasIssuerInstrument: false,
    rationale:
      "Binary Capital SCF - reverse factoring / dynamic discounting / inventory financing.",
  },
  portfolio_management_mandate: {
    type: "portfolio_management_mandate",
    label: "Bond Portfolio Management Mandate",
    family: "portfolio",
    brand: "binarybonds",
    creditCharacter: "none",
    usesAllocationBook: false,
    hasIssuerInstrument: false,
    rationale:
      "Binary Bonds institutional portfolio management (duration/credit/rebalancing) - a mandate, not an issuance.",
  },
  secondary_trading_advisory: {
    type: "secondary_trading_advisory",
    label: "Secondary Trading Advisory",
    family: "gsec",
    brand: "binarybonds",
    creditCharacter: "none",
    usesAllocationBook: false,
    hasIssuerInstrument: false,
    rationale:
      "Binary Bonds secondary trading/market-making advisory - advisory framing is correct given BC's likely non-member (arranger) status; execution clears via sponsoring BSE/NSE member.",
  },
};

// Compile-time guard: the `Record<DealType, DealTypeSpec>` annotation above
// forces TS to require an entry for EVERY schema enum value - adding a new
// deal_type to the enum without a catalog row is a hard type error here.

// ---------------------------------------------------------------------------
// Lookup helpers.
// ---------------------------------------------------------------------------

export function dealTypeSpec(type: DealType): DealTypeSpec {
  return DEAL_TYPE_CATALOG[type];
}

export function isAllocationDealType(type: DealType): boolean {
  return DEAL_TYPE_CATALOG[type].usesAllocationBook;
}

export function isIssuerInstrumentDealType(type: DealType): boolean {
  return DEAL_TYPE_CATALOG[type].hasIssuerInstrument;
}

/** Brand affinity for a deal type (used when a deal row's brand is unset). */
export function defaultBrandForDealType(type: DealType): BrandAffinity {
  return DEAL_TYPE_CATALOG[type].brand;
}

/** Canonical display order - fixed-income core, then G-Sec, then ECM, then
 *  structured credit, then advisory, then portfolio. Mirrors the desk grouping
 *  the board uses so type-swimlane rendering reads as organized desks. */
export const DEAL_TYPE_DISPLAY_ORDER: readonly DealType[] = [
  "bond_underwriting",
  "high_yield_bond",
  "private_placement_debt",
  "dcm_advisory",
  "gsec_auction",
  "secondary_trading_advisory",
  "ecm_ipo",
  "ecm_fpo",
  "ecm_qip",
  "ecm_rights",
  "structured_finance",
  "supply_chain_finance",
  "project_finance",
  "rating_advisory",
  "m_and_a",
  "valuation",
  "fairness_opinion",
  "portfolio_management_mandate",
];
