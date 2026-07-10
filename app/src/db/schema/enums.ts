// Enums and shared column primitives for the Binary Capital / Binary Bonds CRM schema.
// Source of truth: /home/Jashmhta/crm/docs/DATA_MODEL.md §6 (enumerations) + inline enum
// mentions throughout §2 and §3, plus /home/Jashmhta/crm/docs/CREDIT_ANALYSIS_SPEC.md §13.
//
// NOTE on `citext`: PostgreSQL's case-insensitive text type. Requires
//   `CREATE EXTENSION IF NOT EXISTS citext;`
// in a baseline migration before tables using it are created. The customType below
// emits the literal SQL type `citext` so drizzle-kit generate produces `citext` columns.

import { customType, pgEnum } from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Shared custom types
// ---------------------------------------------------------------------------

/**
 * Case-insensitive text. Used for `party.legal_name`, `contact.full_name`,
 * `contact.primary_email`, `tag.name` - anywhere case-insensitive equality
 * and uniqueness is required (PAN/email/legal-name dedup).
 *
 * Requires `CREATE EXTENSION IF NOT EXISTS citext;` in a baseline migration.
 */
export const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return "citext";
  },
});

// ---------------------------------------------------------------------------
// Party enums (DATA_MODEL §6.1, §2.1)
// ---------------------------------------------------------------------------

export const partyTypeEnum = pgEnum("party_type", [
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
  "escrow_agent",
  "guarantor",
  "credit_enhancement_provider",
  "government",
  "regulator",
  "spv",
  "vendor",
  "internal_staff",
  "prospect",
]);

export const partyStatusEnum = pgEnum("party_status", [
  "active",
  "dormant",
  "onboarding",
  "blacklisted",
  "closed",
]);

export const partyNatureEnum = pgEnum("party_nature", [
  "organization",
  "natural_person",
  "spv",
  "trust",
  "government",
  "regulator",
]);

export const brandEnum = pgEnum("brand", [
  "binarycapital",
  "binarybonds",
  "shared",
]);

export const dataSourceEnum = pgEnum("data_source", [
  "manual",
  "capital_markets_import",
  "bond_desk_import",
  "website_lead",
  "broker_feed",
]);

// ---------------------------------------------------------------------------
// Identifier / registration enums (§2.3, §3)
// ---------------------------------------------------------------------------

export const identifierTypeEnum = pgEnum("identifier_type", [
  "PAN",
  "LEI",
  "CIN",
  "LLPIN",
  "GSTIN",
  "TAN",
  "demat_dp_client",
  "SEBI_regn",
  "NSDL",
  "CDSL",
  "ISIN",
  "CRN",
]);

export const regnCategoryEnum = pgEnum("regn_category", [
  "merchant_banker_cat1",
  "stock_broker",
  "investment_adviser",
  "debenture_trustee",
  "registrar_to_issue",
  "research_analyst",
  "underwriter",
  "nbfc",
  "arranger",
]);

// ---------------------------------------------------------------------------
// Relationship enum (§2.6)
// ---------------------------------------------------------------------------

export const relationshipTypeEnum = pgEnum("relationship_type", [
  "wholly_owned",
  "subsidiary",
  "associate",
  "jv",
  "promoter",
  "beneficial_owner",
  "guarantor",
  "sister_concern",
  "management_control",
]);

// ---------------------------------------------------------------------------
// Demat (§2.23.1)
// ---------------------------------------------------------------------------

export const depositoryEnum = pgEnum("depository", ["NSDL", "CDSL"]);

export const dematStatusEnum = pgEnum("demat_status", [
  "active",
  "frozen",
  "closed",
  "suspended",
]);

// ---------------------------------------------------------------------------
// Deal enums (§6.2, §2.9, §6.10)
// ---------------------------------------------------------------------------

export const dealTypeEnum = pgEnum("deal_type", [
  "bond_underwriting",
  "gsec_auction",
  "high_yield_bond",
  "rating_advisory",
  "m_and_a",
  "project_finance",
  "structured_finance",
  "supply_chain_finance",
  "ecm_ipo",
  "ecm_fpo",
  "ecm_qip",
  "ecm_rights",
  "dcm_advisory",
  "private_placement_debt",
  "valuation",
  "fairness_opinion",
  "portfolio_management_mandate",
  "secondary_trading_advisory",
]);

export const dealStatusEnum = pgEnum("deal_status", [
  "lead",
  "mandated",
  "in_dd",
  "structuring",
  "rating_marketing",
  "pricing",
  "allocation",
  "settled",
  "closed",
  "dropped",
  "on_hold",
]);

export const dealPartyRoleEnum = pgEnum("deal_party_role", [
  "issuer",
  "arranger",
  "co_arranger",
  "underwriter",
  "book_runner",
  "lead_manager",
  "syndicate_member",
  "investor",
  "allocator",
  "guarantor",
  "trustee",
  "registrar",
  "rating_agency",
  "legal_counsel",
  "auditor",
  "escrow_agent",
  "selling_broker",
  "buy_side_advisor",
  "sell_side_advisor",
  "target",
  "acquirer",
]);

// ---------------------------------------------------------------------------
// Allocation event enums (§2.11)
// ---------------------------------------------------------------------------

export const allocEventTypeEnum = pgEnum("alloc_event_type", [
  "indication",
  "order",
  "revised_order",
  "allocated",
  "withdrawn",
  "oversubscribed_adjusted",
  "settled",
]);

export const priceTypeEnum = pgEnum("price_type", ["clean", "dirty", "par"]);

export const auctionBidTypeEnum = pgEnum("auction_bid_type", [
  "competitive",
  "non_competitive",
]);

export const allocSourceChannelEnum = pgEnum("alloc_source_channel", [
  "phone",
  "email",
  "rfq_platform",
  "ndsom",
  "brokers",
  "ifa",
]);

// ---------------------------------------------------------------------------
// Instrument enums (§6.12, §6.11, §2.16)
// ---------------------------------------------------------------------------

export const instrumentTypeEnum = pgEnum("instrument_type", [
  "corp_bond",
  "ncd",
  "cp",
  "gsec",
  "sdl",
  "tbill",
  "sgb",
  "structured_credit",
  "municipal_bond",
  "eco_bond",
  "equity",
  "preference_share",
  "warrant",
  "convertible",
]);

export const exchangeEnum = pgEnum("exchange", [
  "BSE",
  "NSE",
  "BSE_NSE",
  "MSE",
  "Other",
  "Offshore",
]);

export const couponTypeEnum = pgEnum("coupon_type", [
  "fixed",
  "floating",
  "zero",
  "step_up",
  "step_down",
  "linked",
]);

export const frequencyEnum = pgEnum("frequency", [
  "annual",
  "semi_annual",
  "monthly",
]);

// Day-count convention (bond pricing). Not explicitly enumerated in DATA_MODEL
// but referenced by FINANCIAL_MODELING_SPEC - Indian bond market conventions.
export const dayCountEnum = pgEnum("day_count", [
  "ACT_365",
  "ACT_360",
  "thirty_360",
  "ACT_ACT",
]);

// Settlement cycle. Indian bond market: T+1 standard for corp bonds, T+0/T+1 for G-Sec.
export const settlementEnum = pgEnum("settlement", ["T0", "T1", "T2", "T3"]);

export const tradeSideEnum = pgEnum("trade_side", ["buy", "sell"]);

// ---------------------------------------------------------------------------
// KYC enums (§6.7, §6.8, §2.20)
// ---------------------------------------------------------------------------

export const kycStatusEnum = pgEnum("kyc_status", [
  "pending",
  "in_review",
  "approved",
  "rejected",
  "expired",
  "rekyc_due",
  "under_eds_check",
]);

export const kycTypeEnum = pgEnum("kyc_type", ["CDD", "EDD", "simplified"]);

export const kycRiskEnum = pgEnum("kyc_risk", ["low", "medium", "high"]);

export const kycCategoryEnum = pgEnum("kyc_category", [
  "id_proof",
  "address_proof",
  "pan",
  "bo_declaration",
  "pep_declaration",
  "source_of_funds",
  "authority_letter",
]);

// PEP status (PMLA). §2.4 references `pep` enum without listing values; these
// are the standard PEP categories under PMLA Rules.
export const pepEnum = pgEnum("pep", [
  "none",
  "suspected",
  "confirmed",
  "family_member",
  "close_associate",
]);

// ---------------------------------------------------------------------------
// Consent / DPDP enums (§6.9, §2.21)
// ---------------------------------------------------------------------------

export const consentPurposeEnum = pgEnum("consent_purpose", [
  "marketing",
  "advisory_engagement",
  "kyc_processing",
  "credit_analysis",
  "data_sharing_with_rating_agency",
  "data_sharing_with_investors",
  "regulatory_reporting",
  "portfolio_management",
  "secondary_trading_contact",
]);

export const consentMethodEnum = pgEnum("consent_method", [
  "digital_sign",
  "checkbox_email",
  "physical_signed",
  "verbal_recorded",
]);

export const dsrTypeEnum = pgEnum("dsr_type", [
  "access",
  "erasure",
  "rectification",
  "restriction",
  "portability",
  "withdraw_consent",
]);

export const dsrStatusEnum = pgEnum("dsr_status", [
  "received",
  "in_review",
  "fulfilled",
  "rejected",
  "cancelled",
]);

// ---------------------------------------------------------------------------
// Financial modeling enums (§6.5)
// ---------------------------------------------------------------------------

export const modelTypeEnum = pgEnum("model_type", [
  "bond_pricing",
  "project_finance",
  "securitization",
  "dcf",
  "m_and_a",
  "lbo",
  "valuation",
  "portfolio_construction",
  "scenario_stress",
]);

// ---------------------------------------------------------------------------
// Credit enums (§6.6, §2.14, §2.12, §2.15, §6.3, §6.4, §6.13, §2.23.6)
// ---------------------------------------------------------------------------

export const financialRatioEnum = pgEnum("financial_ratio", [
  "current_ratio",
  "quick_ratio",
  "debt_equity",
  "debt_ebitda",
  "interest_coverage",
  "iscr",
  "dscr",
  "llcr",
  "plcr",
  "roce",
  "roe",
  "roa",
  "nim",
  "gnpa_pct",
  "nnpa_pct",
  "credit_cost_pct",
  "tier1_ratio",
  "crar",
  "gnpa_coverage_ratio",
  "liii_ratio",
  "provision_coverage_ratio",
  "debt_to_tangible_nw",
  "operating_margin",
  "ebitda_margin",
  "pat_margin",
  "ev_ebitda",
  "p_e",
  "p_b",
  "dividend_payout",
  "fcfo",
  "cfads",
  "working_capital_days",
  "creditor_days",
  "debtor_days",
  "inventory_days",
  "lnf_to_tnw",
]);

export const scoreComponentEnum = pgEnum("score_component", [
  "business_risk",
  "financial_risk",
  "management_risk",
  "industry_risk",
  "country_risk",
  "structural_risk",
  "ESG",
]);

export const obligorTypeEnum = pgEnum("obligor_type", [
  "corporate",
  "spv",
  "project",
  "sovereign",
  "state_psu",
  "nbfc",
  "bank",
]);

export const creditAnalysisTypeEnum = pgEnum("credit_analysis_type", [
  "origination",
  "annual_surveillance",
  "event_driven",
  "watchlist_trigger",
  "rating_presentation_support",
]);

export const internalRatingActionEnum = pgEnum("internal_rating_action", [
  "assign",
  "maintain",
  "upgrade",
  "downgrade",
  "watch_negative",
  "watch_positive",
]);

export const outlookEnum = pgEnum("outlook", [
  "stable",
  "positive",
  "negative",
  "developing",
  "credit_watch",
]);

export const ratingActionEnum = pgEnum("rating_action", [
  "initial",
  "affirm",
  "upgrade",
  "downgrade",
  "withdraw",
  "rating_solicited",
]);

export const ratingAgencyEnum = pgEnum("rating_agency", [
  "CRISIL",
  "ICRA",
  "CARE",
  "India_Ratings",
  "Acuite",
  "Infomerics",
  "Brickwork",
]);

export const ratingScaleEnum = pgEnum("rating_scale", [
  "long_term",
  "short_term",
  "structured",
  "sovereign",
  "state_guaranteed",
]);

export const exposureTypeEnum = pgEnum("exposure_type", [
  "underwriting_unsold",
  "secondary_inventory",
  "portfolio_holding",
  "advisory_fee_at_risk",
  "settlement_counterparty",
  "repo",
]);

export const limitTypeEnum = pgEnum("limit_type", [
  "issuer_underwriting",
  "secondary_inventory",
  "single_name",
  "group",
  "sector",
  "tenor",
  "country",
  "counterparty_concentration",
]);

export const scorecardStatusEnum = pgEnum("scorecard_status", [
  "draft",
  "approved",
  "retired",
]);

// ---------------------------------------------------------------------------
// Financial statement enums (§2.13)
// ---------------------------------------------------------------------------

export const periodTypeEnum = pgEnum("period_type", [
  "annual",
  "half_year",
  "quarter",
  "month",
]);

export const statementTypeEnum = pgEnum("statement_type", [
  "balance_sheet",
  "profit_loss",
  "cash_flow",
  "standalone",
  "consolidated",
]);

export const unitsEnum = pgEnum("units", [
  "absolute",
  "lakhs",
  "crores",
  "millions",
]);

export const fsSourceEnum = pgEnum("fs_source", [
  "audited",
  "limited_review",
  "management_provisional",
  "rating_agency_filing",
]);

export const fsLinkRoleEnum = pgEnum("fs_link_role", [
  "primary_basis",
  "supporting",
  "prior_period",
  "peer",
]);

// ---------------------------------------------------------------------------
// Interaction enums (§2.18)
// ---------------------------------------------------------------------------

export const interactionChannelEnum = pgEnum("interaction_channel", [
  "meeting",
  "call",
  "email",
  "whatsapp",
  "rfq",
  "ndsom_chat",
  "site_visit",
  "management_presentation",
]);

export const interactionDirectionEnum = pgEnum("interaction_direction", [
  "inbound",
  "outbound",
]);

export const attendeeRoleEnum = pgEnum("attendee_role", [
  "host",
  "chair",
  "presenter",
  "issuer_side",
  "investor_side",
  "advisor",
  "observer",
  "other",
]);

// ---------------------------------------------------------------------------
// Document enum (§2.20)
// ---------------------------------------------------------------------------

export const documentTypeEnum = pgEnum("document_type", [
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
]);

// ---------------------------------------------------------------------------
// Task enums (§2.19 - values not explicitly listed in DATA_MODEL)
// ---------------------------------------------------------------------------

export const taskStatusEnum = pgEnum("task_status", [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
  "blocked",
  "deferred",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

// ---------------------------------------------------------------------------
// Contact / address enums (§2.4, §2.5, §2.23.9)
// ---------------------------------------------------------------------------

export const salutationEnum = pgEnum("salutation", [
  "Mr",
  "Ms",
  "Mrs",
  "Dr",
  "Prof",
  "Shri",
  "Smt",
  "Col",
  "Capt",
  "other",
]);

export const contactRoleEnum = pgEnum("contact_role", [
  "director",
  "promoter",
  "md_ceo",
  "cfo",
  "treasurer",
  "compliance",
  "rm_broker",
  "ifa",
  "relationship_manager",
  "authorised_signatory",
  "beneficial_owner",
  "other",
]);

export const addressTypeEnum = pgEnum("address_type", [
  "registered",
  "branch",
  "correspondence",
  "residential",
  "operational",
]);

// ---------------------------------------------------------------------------
// Taxonomy / tag enums (§2.23.10, §2.23.11)
// ---------------------------------------------------------------------------

export const tagCategoryEnum = pgEnum("tag_category", [
  "party",
  "deal",
  "contact",
  "general",
]);

export const tagTargetEnum = pgEnum("tag_target", [
  "party",
  "deal",
  "contact",
  "instrument",
  "interaction",
]);

export const segmentClassEnum = pgEnum("segment_class", [
  "sector",
  "sub_sector",
  "geography",
  "deal_category",
]);

// ---------------------------------------------------------------------------
// RBAC / desk enum (§2.8)
// ---------------------------------------------------------------------------

export const deskEnum = pgEnum("desk", [
  "ib_advisory",
  "bond_underwriting",
  "gsec_trading",
  "secondary_mm",
  "portfolio_mgmt",
  "credit",
  "rating_advisory",
  "operations",
  "compliance",
  "management",
]);

// ---------------------------------------------------------------------------
// Audit / dedup enums (§2.22, §2.23.5)
// ---------------------------------------------------------------------------

export const auditOpEnum = pgEnum("audit_op", [
  "insert",
  "update",
  "delete",
  "merge",
  "approve",
  "reject",
]);

export const dedupStatusEnum = pgEnum("dedup_status", [
  "open",
  "confirmed_merge",
  "rejected_merge",
  "deferred",
]);

// ---------------------------------------------------------------------------
// FEMA / NRI (§3)
// ---------------------------------------------------------------------------

export const femaResidentialStatusEnum = pgEnum("fema_residential_status", [
  "resident",
  "nri",
  "oci",
  "foreign_national",
]);
