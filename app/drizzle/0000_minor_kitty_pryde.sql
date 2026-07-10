CREATE TYPE "public"."address_type" AS ENUM('registered', 'branch', 'correspondence', 'residential', 'operational');--> statement-breakpoint
CREATE TYPE "public"."alloc_event_type" AS ENUM('indication', 'order', 'revised_order', 'allocated', 'withdrawn', 'oversubscribed_adjusted', 'settled');--> statement-breakpoint
CREATE TYPE "public"."alloc_source_channel" AS ENUM('phone', 'email', 'rfq_platform', 'ndsom', 'brokers', 'ifa');--> statement-breakpoint
CREATE TYPE "public"."attendee_role" AS ENUM('host', 'chair', 'presenter', 'issuer_side', 'investor_side', 'advisor', 'observer', 'other');--> statement-breakpoint
CREATE TYPE "public"."auction_bid_type" AS ENUM('competitive', 'non_competitive');--> statement-breakpoint
CREATE TYPE "public"."audit_op" AS ENUM('insert', 'update', 'delete', 'merge', 'approve', 'reject');--> statement-breakpoint
CREATE TYPE "public"."brand" AS ENUM('binarycapital', 'binarybonds', 'shared');--> statement-breakpoint
CREATE TYPE "public"."consent_method" AS ENUM('digital_sign', 'checkbox_email', 'physical_signed', 'verbal_recorded');--> statement-breakpoint
CREATE TYPE "public"."consent_purpose" AS ENUM('marketing', 'advisory_engagement', 'kyc_processing', 'credit_analysis', 'data_sharing_with_rating_agency', 'data_sharing_with_investors', 'regulatory_reporting', 'portfolio_management', 'secondary_trading_contact');--> statement-breakpoint
CREATE TYPE "public"."contact_role" AS ENUM('director', 'promoter', 'md_ceo', 'cfo', 'treasurer', 'compliance', 'rm_broker', 'ifa', 'relationship_manager', 'authorised_signatory', 'beneficial_owner', 'other');--> statement-breakpoint
CREATE TYPE "public"."coupon_type" AS ENUM('fixed', 'floating', 'zero', 'step_up', 'step_down', 'linked');--> statement-breakpoint
CREATE TYPE "public"."credit_analysis_type" AS ENUM('origination', 'annual_surveillance', 'event_driven', 'watchlist_trigger', 'rating_presentation_support');--> statement-breakpoint
CREATE TYPE "public"."data_source" AS ENUM('manual', 'capital_markets_import', 'bond_desk_import', 'website_lead', 'broker_feed');--> statement-breakpoint
CREATE TYPE "public"."day_count" AS ENUM('ACT_365', 'ACT_360', 'thirty_360', 'ACT_ACT');--> statement-breakpoint
CREATE TYPE "public"."deal_party_role" AS ENUM('issuer', 'arranger', 'co_arranger', 'underwriter', 'book_runner', 'lead_manager', 'syndicate_member', 'investor', 'allocator', 'guarantor', 'trustee', 'registrar', 'rating_agency', 'legal_counsel', 'auditor', 'escrow_agent', 'selling_broker', 'buy_side_advisor', 'sell_side_advisor', 'target', 'acquirer');--> statement-breakpoint
CREATE TYPE "public"."deal_status" AS ENUM('lead', 'mandated', 'in_dd', 'structuring', 'rating_marketing', 'pricing', 'allocation', 'settled', 'closed', 'dropped', 'on_hold');--> statement-breakpoint
CREATE TYPE "public"."deal_type" AS ENUM('bond_underwriting', 'gsec_auction', 'high_yield_bond', 'rating_advisory', 'm_and_a', 'project_finance', 'structured_finance', 'supply_chain_finance', 'ecm_ipo', 'ecm_fpo', 'ecm_qip', 'ecm_rights', 'dcm_advisory', 'private_placement_debt', 'valuation', 'fairness_opinion', 'portfolio_management_mandate', 'secondary_trading_advisory');--> statement-breakpoint
CREATE TYPE "public"."dedup_status" AS ENUM('open', 'confirmed_merge', 'rejected_merge', 'deferred');--> statement-breakpoint
CREATE TYPE "public"."demat_status" AS ENUM('active', 'frozen', 'closed', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."depository" AS ENUM('NSDL', 'CDSL');--> statement-breakpoint
CREATE TYPE "public"."desk" AS ENUM('ib_advisory', 'bond_underwriting', 'gsec_trading', 'secondary_mm', 'portfolio_mgmt', 'credit', 'rating_advisory', 'operations', 'compliance', 'management');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('engagement_letter', 'mandate_letter', 'rating_rationale', 'offering_circular', 'drhp', 'information_memorandum', 'term_sheet', 'security_document', 'trustee_deed', 'kyc_pack', 'pan_card', 'aadhaar', 'board_resolution', 'form60', 'form61', 'financial_statement', 'financial_model_file', 'credit_memo', 'valuation_report', 'legal_dd_report', 'site_report', 'consent_form', 'other');--> statement-breakpoint
CREATE TYPE "public"."dsr_status" AS ENUM('received', 'in_review', 'fulfilled', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."dsr_type" AS ENUM('access', 'erasure', 'rectification', 'restriction', 'portability', 'withdraw_consent');--> statement-breakpoint
CREATE TYPE "public"."exchange" AS ENUM('BSE', 'NSE', 'BSE_NSE', 'MSE', 'Other', 'Offshore');--> statement-breakpoint
CREATE TYPE "public"."exposure_type" AS ENUM('underwriting_unsold', 'secondary_inventory', 'portfolio_holding', 'advisory_fee_at_risk', 'settlement_counterparty', 'repo');--> statement-breakpoint
CREATE TYPE "public"."fema_residential_status" AS ENUM('resident', 'nri', 'oci', 'foreign_national');--> statement-breakpoint
CREATE TYPE "public"."financial_ratio" AS ENUM('current_ratio', 'quick_ratio', 'debt_equity', 'debt_ebitda', 'interest_coverage', 'iscr', 'dscr', 'llcr', 'plcr', 'roce', 'roe', 'roa', 'nim', 'gnpa_pct', 'nnpa_pct', 'credit_cost_pct', 'tier1_ratio', 'crar', 'gnpa_coverage_ratio', 'liii_ratio', 'provision_coverage_ratio', 'debt_to_tangible_nw', 'operating_margin', 'ebitda_margin', 'pat_margin', 'ev_ebitda', 'p_e', 'p_b', 'dividend_payout', 'fcfo', 'cfads', 'working_capital_days', 'creditor_days', 'debtor_days', 'inventory_days', 'lnf_to_tnw');--> statement-breakpoint
CREATE TYPE "public"."frequency" AS ENUM('annual', 'semi_annual', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."fs_link_role" AS ENUM('primary_basis', 'supporting', 'prior_period', 'peer');--> statement-breakpoint
CREATE TYPE "public"."fs_source" AS ENUM('audited', 'limited_review', 'management_provisional', 'rating_agency_filing');--> statement-breakpoint
CREATE TYPE "public"."identifier_type" AS ENUM('PAN', 'LEI', 'CIN', 'LLPIN', 'GSTIN', 'TAN', 'demat_dp_client', 'SEBI_regn', 'NSDL', 'CDSL', 'ISIN', 'CRN');--> statement-breakpoint
CREATE TYPE "public"."instrument_type" AS ENUM('corp_bond', 'ncd', 'cp', 'gsec', 'sdl', 'tbill', 'sgb', 'structured_credit', 'municipal_bond', 'eco_bond', 'equity', 'preference_share', 'warrant', 'convertible');--> statement-breakpoint
CREATE TYPE "public"."interaction_channel" AS ENUM('meeting', 'call', 'email', 'whatsapp', 'rfq', 'ndsom_chat', 'site_visit', 'management_presentation');--> statement-breakpoint
CREATE TYPE "public"."interaction_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."internal_rating_action" AS ENUM('assign', 'maintain', 'upgrade', 'downgrade', 'watch_negative', 'watch_positive');--> statement-breakpoint
CREATE TYPE "public"."kyc_category" AS ENUM('id_proof', 'address_proof', 'pan', 'bo_declaration', 'pep_declaration', 'source_of_funds', 'authority_letter');--> statement-breakpoint
CREATE TYPE "public"."kyc_risk" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('pending', 'in_review', 'approved', 'rejected', 'expired', 'rekyc_due', 'under_eds_check');--> statement-breakpoint
CREATE TYPE "public"."kyc_type" AS ENUM('CDD', 'EDD', 'simplified');--> statement-breakpoint
CREATE TYPE "public"."limit_type" AS ENUM('issuer_underwriting', 'secondary_inventory', 'single_name', 'group', 'sector', 'tenor', 'country', 'counterparty_concentration');--> statement-breakpoint
CREATE TYPE "public"."model_type" AS ENUM('bond_pricing', 'project_finance', 'securitization', 'dcf', 'm_and_a', 'lbo', 'valuation', 'portfolio_construction', 'scenario_stress');--> statement-breakpoint
CREATE TYPE "public"."obligor_type" AS ENUM('corporate', 'spv', 'project', 'sovereign', 'state_psu', 'nbfc', 'bank');--> statement-breakpoint
CREATE TYPE "public"."outlook" AS ENUM('stable', 'positive', 'negative', 'developing', 'credit_watch');--> statement-breakpoint
CREATE TYPE "public"."party_nature" AS ENUM('organization', 'natural_person', 'spv', 'trust', 'government', 'regulator');--> statement-breakpoint
CREATE TYPE "public"."party_status" AS ENUM('active', 'dormant', 'onboarding', 'blacklisted', 'closed');--> statement-breakpoint
CREATE TYPE "public"."party_type" AS ENUM('issuer', 'investor', 'intermediary', 'arranger', 'underwriter', 'broker', 'ifa', 'rating_agency', 'trustee', 'registrar', 'legal_counsel', 'auditor', 'escrow_agent', 'guarantor', 'credit_enhancement_provider', 'government', 'regulator', 'spv', 'vendor', 'internal_staff', 'prospect');--> statement-breakpoint
CREATE TYPE "public"."pep" AS ENUM('none', 'suspected', 'confirmed', 'family_member', 'close_associate');--> statement-breakpoint
CREATE TYPE "public"."period_type" AS ENUM('annual', 'half_year', 'quarter', 'month');--> statement-breakpoint
CREATE TYPE "public"."price_type" AS ENUM('clean', 'dirty', 'par');--> statement-breakpoint
CREATE TYPE "public"."rating_action" AS ENUM('initial', 'affirm', 'upgrade', 'downgrade', 'withdraw', 'rating_solicited');--> statement-breakpoint
CREATE TYPE "public"."rating_agency" AS ENUM('CRISIL', 'ICRA', 'CARE', 'India_Ratings', 'Acuite', 'Infomerics', 'Brickwork');--> statement-breakpoint
CREATE TYPE "public"."rating_scale" AS ENUM('long_term', 'short_term', 'structured', 'sovereign', 'state_guaranteed');--> statement-breakpoint
CREATE TYPE "public"."regn_category" AS ENUM('merchant_banker_cat1', 'stock_broker', 'investment_adviser', 'debenture_trustee', 'registrar_to_issue', 'research_analyst', 'underwriter', 'nbfc', 'arranger');--> statement-breakpoint
CREATE TYPE "public"."relationship_type" AS ENUM('wholly_owned', 'subsidiary', 'associate', 'jv', 'promoter', 'beneficial_owner', 'guarantor', 'sister_concern', 'management_control');--> statement-breakpoint
CREATE TYPE "public"."salutation" AS ENUM('Mr', 'Ms', 'Mrs', 'Dr', 'Prof', 'Shri', 'Smt', 'Col', 'Capt', 'other');--> statement-breakpoint
CREATE TYPE "public"."score_component" AS ENUM('business_risk', 'financial_risk', 'management_risk', 'industry_risk', 'country_risk', 'structural_risk', 'ESG');--> statement-breakpoint
CREATE TYPE "public"."scorecard_status" AS ENUM('draft', 'approved', 'retired');--> statement-breakpoint
CREATE TYPE "public"."segment_class" AS ENUM('sector', 'sub_sector', 'geography', 'deal_category');--> statement-breakpoint
CREATE TYPE "public"."settlement" AS ENUM('T0', 'T1', 'T2', 'T3');--> statement-breakpoint
CREATE TYPE "public"."statement_type" AS ENUM('balance_sheet', 'profit_loss', 'cash_flow', 'standalone', 'consolidated');--> statement-breakpoint
CREATE TYPE "public"."tag_category" AS ENUM('party', 'deal', 'contact', 'general');--> statement-breakpoint
CREATE TYPE "public"."tag_target" AS ENUM('party', 'deal', 'contact', 'instrument', 'interaction');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled', 'blocked', 'deferred');--> statement-breakpoint
CREATE TYPE "public"."trade_side" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TYPE "public"."units" AS ENUM('absolute', 'lakhs', 'crores', 'millions');--> statement-breakpoint
CREATE TABLE "app_user" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_party_id" uuid,
	"contact_id" uuid,
	"email" "citext" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"desk" "desk",
	"barrier_clearance" text[],
	"last_login_at" timestamp with time zone,
	"mfa_enrolled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "permission" (
	"permission_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "role" (
	"role_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"desk" "desk",
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permission_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "user_role" (
	"user_role_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"assigned_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "information_barrier" (
	"barrier_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"deal_id" uuid,
	"party_id" uuid,
	"restricted_role_set" text[] NOT NULL,
	"restricted_desk" "desk"[],
	"reason" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"erected_at" timestamp with time zone,
	"lifted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by_user_id" uuid,
	"deleted_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "information_barrier_scope_check" CHECK ("information_barrier"."deal_id" IS NOT NULL OR "information_barrier"."party_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "address" (
	"address_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid,
	"contact_id" uuid,
	"line1" text NOT NULL,
	"line2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"pincode" char(6),
	"country" char(2) NOT NULL,
	"address_type" "address_type" NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "address_principal_check" CHECK ("address"."party_id" IS NOT NULL OR "address"."contact_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "party" (
	"party_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_seq" numeric(20),
	"legal_name" "citext" NOT NULL,
	"display_name" text,
	"name_phonetic" text,
	"party_nature" "party_nature" NOT NULL,
	"country_of_incorporation" char(2) DEFAULT 'IN' NOT NULL,
	"domicile_state" text,
	"ultimate_parent_party_id" uuid,
	"is_listed" boolean DEFAULT false NOT NULL,
	"listing_exchange" text,
	"ticker" text,
	"industry_segment_id" uuid,
	"crisil_sector_code" text,
	"group_exposure_inr" numeric(18, 4),
	"is_kyc_complete" boolean DEFAULT false,
	"is_kyc_stale" boolean DEFAULT false,
	"barrier_id" uuid,
	"kyc_risk_rating" "kyc_risk",
	"status" "party_status" NOT NULL,
	"brand_origin" "brand" NOT NULL,
	"source" "data_source",
	"source_ref" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by_user_id" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "party_identifier" (
	"party_identifier_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid NOT NULL,
	"identifier_type" "identifier_type" NOT NULL,
	"identifier_value" text NOT NULL,
	"is_primary" boolean DEFAULT false,
	"verified_at" timestamp with time zone,
	"verification_source" text,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"regn_category" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "party_type_assignment" (
	"party_id" uuid NOT NULL,
	"party_type" "party_type" NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now(),
	"assigned_by_user_id" uuid,
	"confidence" numeric(3, 2),
	"evidence_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "party_type_assignment_party_id_party_type_pk" PRIMARY KEY("party_id","party_type")
);
--> statement-breakpoint
CREATE TABLE "contact" (
	"contact_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" "citext" NOT NULL,
	"salutation" "salutation",
	"primary_email" "citext",
	"primary_phone" text,
	"designation" text,
	"linkedin_url" text,
	"is_kyc_individual" boolean DEFAULT false,
	"pan" char(10),
	"pep_status" "pep",
	"pep_verified_at" timestamp with time zone,
	"is_nri" boolean DEFAULT false,
	"fema_residential_status" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by_user_id" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "party_contact" (
	"party_contact_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"role" "contact_role" NOT NULL,
	"is_primary" boolean DEFAULT false,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"reporting_to_party_contact_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "relationship" (
	"relationship_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_party_id" uuid NOT NULL,
	"child_party_id" uuid NOT NULL,
	"relationship_type" "relationship_type" NOT NULL,
	"ownership_pct" numeric(5, 2),
	"voting_rights_pct" numeric(5, 2),
	"is_publicly_disclosed" boolean DEFAULT false,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"evidence_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "demat_account" (
	"demat_account_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid NOT NULL,
	"dp_id" char(8) NOT NULL,
	"client_id" char(8) NOT NULL,
	"depository" "depository" NOT NULL,
	"account_status" "demat_status" NOT NULL,
	"verified_at" timestamp with time zone,
	"verification_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "allocation_event" (
	"allocation_event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"event_type" "alloc_event_type" NOT NULL,
	"amount" numeric(18, 4),
	"yield_pct" numeric(6, 4),
	"price" numeric(12, 6),
	"price_type" "price_type",
	"put_call_indicator" "auction_bid_type",
	"allotment_pct" numeric(5, 2),
	"demat_account_id" uuid,
	"event_at" timestamp with time zone NOT NULL,
	"event_by_user_id" uuid,
	"source_channel" "alloc_source_channel",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"barrier_id" uuid
);
--> statement-breakpoint
CREATE TABLE "deal" (
	"deal_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_code" text,
	"deal_type" "deal_type" NOT NULL,
	"deal_subtype" text,
	"deal_name" text,
	"status" "deal_status",
	"brand" "brand" NOT NULL,
	"lead_user_id" uuid,
	"credit_analyst_user_id" uuid,
	"target_close_date" date,
	"actual_close_date" date,
	"target_size" numeric(18, 4),
	"target_tenor_years" numeric(6, 2),
	"currency_code" char(3) DEFAULT 'INR',
	"fee_structure" jsonb,
	"mandate_letter_document_id" uuid,
	"barrier_id" uuid,
	"parent_deal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deal_party" (
	"deal_party_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"role" "deal_party_role" NOT NULL,
	"is_lead" boolean DEFAULT false,
	"commitment_amount" numeric(18, 4),
	"participation_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "instrument" (
	"instrument_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"isin" char(12),
	"instrument_type" "instrument_type" NOT NULL,
	"issuer_party_id" uuid NOT NULL,
	"issue_date" date,
	"maturity_date" date,
	"coupon_pct" numeric(6, 4),
	"coupon_type" "coupon_type",
	"frequency" "frequency",
	"face_value" numeric(12, 4),
	"issue_size" numeric(18, 4),
	"currency_code" char(3) DEFAULT 'INR',
	"security_package" jsonb,
	"listing_exchange" "exchange",
	"credit_enhancement_provider_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "trade_event" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid,
	"party_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"ccil_trade_id" text,
	"exchange" "exchange" NOT NULL,
	"trade_side" "trade_side" NOT NULL,
	"amount" numeric(18, 4) NOT NULL,
	"currency_code" char(3) DEFAULT 'INR' NOT NULL,
	"price" numeric(12, 6) NOT NULL,
	"price_type" "price_type" NOT NULL,
	"yield_pct" numeric(6, 4),
	"quantity" numeric(18, 4),
	"settlement_date" date NOT NULL,
	"demat_account_id" uuid,
	"trade_at" timestamp with time zone NOT NULL,
	"traded_by_user_id" uuid,
	"barrier_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_analysis" (
	"credit_analysis_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid,
	"party_id" uuid NOT NULL,
	"obligor_type" "obligor_type" NOT NULL,
	"analyst_user_id" uuid,
	"reviewer_user_id" uuid,
	"analysis_type" "credit_analysis_type",
	"internal_rating_short" text,
	"internal_rating_long" text,
	"internal_rating_action" "internal_rating_action",
	"pd_1y" numeric(6, 4),
	"pd_5y" numeric(6, 4),
	"lgd_pct" numeric(5, 2),
	"ead" numeric(18, 4),
	"expected_loss" numeric(18, 4) GENERATED ALWAYS AS (pd_1y * lgd_pct / 100.0 * ead) STORED,
	"recovery_rate_pct" numeric(5, 2),
	"current_credit_score" numeric(5, 2),
	"recommendation" text,
	"watchlist_flag" boolean DEFAULT false,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"superseded_by" uuid,
	"barrier_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "credit_analysis_fs_link" (
	"credit_analysis_id" uuid NOT NULL,
	"financial_statement_id" uuid NOT NULL,
	"link_role" "fs_link_role",
	"linked_at" timestamp with time zone DEFAULT now(),
	"linked_by_user_id" uuid,
	CONSTRAINT "credit_analysis_fs_link_credit_analysis_id_financial_statement_id_pk" PRIMARY KEY("credit_analysis_id","financial_statement_id")
);
--> statement-breakpoint
CREATE TABLE "credit_limit" (
	"credit_limit_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid NOT NULL,
	"limit_type" "limit_type" NOT NULL,
	"currency_code" char(3) DEFAULT 'INR' NOT NULL,
	"limit_amount" numeric(18, 4),
	"utilized" numeric(18, 4) DEFAULT '0',
	"available" numeric(18, 4) GENERATED ALWAYS AS (limit_amount - utilized) STORED,
	"utilized_as_of" date,
	"is_stale" boolean DEFAULT false,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"approved_by_user_id" uuid,
	"review_due_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "credit_score" (
	"credit_score_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_analysis_id" uuid NOT NULL,
	"scorecard_id" uuid,
	"component_code" "score_component" NOT NULL,
	"component_score" numeric(5, 2),
	"component_weight" numeric(5, 2),
	"weighted_score" numeric(7, 4) GENERATED ALWAYS AS (component_score * component_weight) STORED,
	"override_flag" boolean DEFAULT false,
	"override_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "exposure" (
	"exposure_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid NOT NULL,
	"instrument_id" uuid,
	"exposure_type" "exposure_type" NOT NULL,
	"currency_code" char(3) DEFAULT 'INR' NOT NULL,
	"gross_exposure" numeric(18, 4),
	"net_exposure" numeric(18, 4),
	"as_of_date" date NOT NULL,
	"maturity_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "external_rating" (
	"external_rating_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid NOT NULL,
	"instrument_id" uuid,
	"agency" "rating_agency" NOT NULL,
	"rating_scale" "rating_scale" NOT NULL,
	"rating_value" text,
	"rating_rank" smallint,
	"outlook" "outlook",
	"rating_action" "rating_action",
	"effective_date" date NOT NULL,
	"withdrawn_date" date,
	"rationale_url" text,
	"deal_id" uuid,
	"is_solicited" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "financial_statement" (
	"financial_statement_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid NOT NULL,
	"period_type" "period_type",
	"period_end_date" date NOT NULL,
	"period_start_date" date,
	"statement_type" "statement_type",
	"currency_code" char(3),
	"units" "units",
	"source" "fs_source",
	"is_consolidated" boolean DEFAULT false,
	"auditor_id" uuid,
	"raw_payload" jsonb,
	"line_items" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "kyc_beneficial_owner" (
	"kyc_beneficial_owner_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kyc_record_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"ownership_pct" numeric(5, 2),
	"declared_at" timestamp with time zone,
	"declaration_document_id" uuid,
	"relationship_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "kyc_record" (
	"kyc_record_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid NOT NULL,
	"contact_id" uuid,
	"kyc_type" "kyc_type",
	"status" "kyc_status",
	"risk_rating" "kyc_risk",
	"cdd_done_at" timestamp with time zone,
	"edd_reason" text,
	"highest_bo_ownership_pct" numeric(5, 2),
	"source_of_funds_verified" boolean DEFAULT false,
	"source_of_wealth_verified" boolean DEFAULT false,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"valid_until" date,
	"rekyc_due_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rating_ladder" (
	"ladder_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency" "rating_agency" NOT NULL,
	"scale" "rating_scale" NOT NULL,
	"symbol" text NOT NULL,
	"rank" smallint NOT NULL,
	"definition" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ratio_result" (
	"ratio_result_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"financial_statement_id" uuid NOT NULL,
	"ratio_code" "financial_ratio" NOT NULL,
	"ratio_value" numeric(14, 4),
	"formula_snapshot" text,
	"computed_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scorecard" (
	"scorecard_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_analysis_id" uuid NOT NULL,
	"template_id" uuid,
	"template_version" integer,
	"total_score" numeric(5, 2),
	"band" text,
	"computed_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scorecard_template" (
	"template_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	"obligor_type" "obligor_type" NOT NULL,
	"sector_code" text,
	"factor_weights" jsonb NOT NULL,
	"benchmark_overrides" jsonb,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"status" "scorecard_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sector_code" (
	"sector_code_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"nic_code" text,
	"rbi_sectoral_deployment_code" text,
	"label" text NOT NULL,
	"parent_sector_code_id" uuid,
	"segment_class" "segment_class",
	"level" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "financial_model" (
	"financial_model_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid,
	"credit_analysis_id" uuid,
	"party_id" uuid,
	"model_type" "model_type" NOT NULL,
	"version" integer NOT NULL,
	"parent_model_id" uuid,
	"currency_code" char(3),
	"params" jsonb,
	"outputs" jsonb,
	"assumptions_doc" text,
	"scenario_tag" text,
	"engine_version" text,
	"computed_at" timestamp with time zone,
	"computed_by_user_id" uuid,
	"approved_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "consent_record" (
	"consent_record_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid,
	"contact_id" uuid,
	"purpose" "consent_purpose" NOT NULL,
	"purpose_description" text,
	"consent_given_at" timestamp with time zone,
	"consent_withdrawn_at" timestamp with time zone,
	"consent_method" "consent_method",
	"data_categories" text[],
	"retention_until" date,
	"version_of_policy" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "data_subject_request" (
	"dsr_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid,
	"contact_id" uuid,
	"request_type" "dsr_type" NOT NULL,
	"status" "dsr_status" NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"notes" text,
	"handled_by_user_id" uuid,
	"triggering_consent_record_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "dsr_principal_check" CHECK ("data_subject_request"."party_id" IS NOT NULL OR "data_subject_request"."contact_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "interaction" (
	"interaction_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" uuid,
	"deal_id" uuid,
	"contact_id" uuid,
	"channel" "interaction_channel",
	"direction" "interaction_direction",
	"subject" text,
	"body" text,
	"occurred_at" timestamp with time zone,
	"duration_min" integer,
	"primary_contact_id" uuid,
	"user_id" uuid,
	"barrier_id" uuid,
	"contains_mnpi" boolean DEFAULT false NOT NULL,
	"next_action" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "interaction_anchor_check" CHECK (num_nonnulls("interaction"."party_id", "interaction"."deal_id", "interaction"."contact_id") >= 1)
);
--> statement-breakpoint
CREATE TABLE "interaction_attendee" (
	"interaction_attendee_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interaction_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"role_at_meeting" "attendee_role",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "task" (
	"task_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid,
	"party_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"assignee_user_id" uuid,
	"due_date" date,
	"priority" "task_priority" DEFAULT 'medium',
	"status" "task_status" DEFAULT 'pending',
	"parent_task_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by_user_id" uuid,
	"completed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "task_dependency" (
	"task_id" uuid NOT NULL,
	"depends_on_task_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_dependency_task_id_depends_on_task_id_pk" PRIMARY KEY("task_id","depends_on_task_id")
);
--> statement-breakpoint
CREATE TABLE "document" (
	"document_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid,
	"party_id" uuid,
	"contact_id" uuid,
	"document_type" "document_type",
	"kyc_category" "kyc_category",
	"file_store_ref" text,
	"file_name" text,
	"mime_type" text,
	"size_bytes" bigint,
	"sha256" char(64),
	"uploaded_by_user_id" uuid,
	"is_confidential" boolean DEFAULT false,
	"barrier_id" uuid,
	"is_mnpi" boolean DEFAULT false,
	"retention_until" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"audit_log_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"field_name" text,
	"old_value" jsonb,
	"new_value" jsonb,
	"operation" "audit_op" NOT NULL,
	"actor_user_id" uuid,
	"actor_role_at_time" text,
	"barrier_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"correlation_id" uuid,
	"prev_hash" char(64),
	"row_hash" char(64)
);
--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_employee_party_id_party_party_id_fk" FOREIGN KEY ("employee_party_id") REFERENCES "public"."party"("party_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_contact_id_contact_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("contact_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_role_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("role_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_permission_permission_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permission"("permission_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_app_user_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_role_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("role_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_assigned_by_user_id_app_user_user_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "information_barrier" ADD CONSTRAINT "information_barrier_deal_id_deal_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("deal_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "information_barrier" ADD CONSTRAINT "information_barrier_party_id_party_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("party_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "information_barrier" ADD CONSTRAINT "information_barrier_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_party_id_party_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("party_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party" ADD CONSTRAINT "party_barrier_id_information_barrier_barrier_id_fk" FOREIGN KEY ("barrier_id") REFERENCES "public"."information_barrier"("barrier_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party" ADD CONSTRAINT "party_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party" ADD CONSTRAINT "party_updated_by_user_id_app_user_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_identifier" ADD CONSTRAINT "party_identifier_party_id_party_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("party_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_type_assignment" ADD CONSTRAINT "party_type_assignment_party_id_party_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("party_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_type_assignment" ADD CONSTRAINT "party_type_assignment_assigned_by_user_id_app_user_user_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_updated_by_user_id_app_user_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_contact" ADD CONSTRAINT "party_contact_party_id_party_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("party_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_contact" ADD CONSTRAINT "party_contact_contact_id_contact_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("contact_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship" ADD CONSTRAINT "relationship_parent_party_id_party_party_id_fk" FOREIGN KEY ("parent_party_id") REFERENCES "public"."party"("party_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship" ADD CONSTRAINT "relationship_child_party_id_party_party_id_fk" FOREIGN KEY ("child_party_id") REFERENCES "public"."party"("party_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demat_account" ADD CONSTRAINT "demat_account_party_id_party_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("party_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_event" ADD CONSTRAINT "allocation_event_deal_id_deal_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("deal_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_event" ADD CONSTRAINT "allocation_event_party_id_party_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("party_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_event" ADD CONSTRAINT "allocation_event_demat_account_id_demat_account_demat_account_id_fk" FOREIGN KEY ("demat_account_id") REFERENCES "public"."demat_account"("demat_account_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_event" ADD CONSTRAINT "allocation_event_event_by_user_id_app_user_user_id_fk" FOREIGN KEY ("event_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_event" ADD CONSTRAINT "allocation_event_barrier_id_information_barrier_barrier_id_fk" FOREIGN KEY ("barrier_id") REFERENCES "public"."information_barrier"("barrier_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_lead_user_id_app_user_user_id_fk" FOREIGN KEY ("lead_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_credit_analyst_user_id_app_user_user_id_fk" FOREIGN KEY ("credit_analyst_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_barrier_id_information_barrier_barrier_id_fk" FOREIGN KEY ("barrier_id") REFERENCES "public"."information_barrier"("barrier_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_updated_by_user_id_app_user_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_party" ADD CONSTRAINT "deal_party_deal_id_deal_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("deal_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_party" ADD CONSTRAINT "deal_party_party_id_party_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("party_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instrument" ADD CONSTRAINT "instrument_issuer_party_id_party_party_id_fk" FOREIGN KEY ("issuer_party_id") REFERENCES "public"."party"("party_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_event" ADD CONSTRAINT "trade_event_deal_id_deal_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("deal_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_event" ADD CONSTRAINT "trade_event_party_id_party_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("party_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_event" ADD CONSTRAINT "trade_event_instrument_id_instrument_instrument_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instrument"("instrument_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_event" ADD CONSTRAINT "trade_event_demat_account_id_demat_account_demat_account_id_fk" FOREIGN KEY ("demat_account_id") REFERENCES "public"."demat_account"("demat_account_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_event" ADD CONSTRAINT "trade_event_traded_by_user_id_app_user_user_id_fk" FOREIGN KEY ("traded_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_event" ADD CONSTRAINT "trade_event_barrier_id_information_barrier_barrier_id_fk" FOREIGN KEY ("barrier_id") REFERENCES "public"."information_barrier"("barrier_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_analysis" ADD CONSTRAINT "credit_analysis_deal_id_deal_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("deal_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_analysis" ADD CONSTRAINT "credit_analysis_party_id_party_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("party_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_analysis" ADD CONSTRAINT "credit_analysis_analyst_user_id_app_user_user_id_fk" FOREIGN KEY ("analyst_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_analysis" ADD CONSTRAINT "credit_analysis_reviewer_user_id_app_user_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_analysis" ADD CONSTRAINT "credit_analysis_barrier_id_information_barrier_barrier_id_fk" FOREIGN KEY ("barrier_id") REFERENCES "public"."information_barrier"("barrier_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_analysis" ADD CONSTRAINT "credit_analysis_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_analysis" ADD CONSTRAINT "credit_analysis_updated_by_user_id_app_user_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_analysis_fs_link" ADD CONSTRAINT "credit_analysis_fs_link_credit_analysis_id_credit_analysis_credit_analysis_id_fk" FOREIGN KEY ("credit_analysis_id") REFERENCES "public"."credit_analysis"("credit_analysis_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_analysis_fs_link" ADD CONSTRAINT "credit_analysis_fs_link_financial_statement_id_financial_statement_financial_statement_id_fk" FOREIGN KEY ("financial_statement_id") REFERENCES "public"."financial_statement"("financial_statement_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_analysis_fs_link" ADD CONSTRAINT "credit_analysis_fs_link_linked_by_user_id_app_user_user_id_fk" FOREIGN KEY ("linked_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_limit" ADD CONSTRAINT "credit_limit_party_id_party_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("party_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_limit" ADD CONSTRAINT "credit_limit_approved_by_user_id_app_user_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_score" ADD CONSTRAINT "credit_score_credit_analysis_id_credit_analysis_credit_analysis_id_fk" FOREIGN KEY ("credit_analysis_id") REFERENCES "public"."credit_analysis"("credit_analysis_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_score" ADD CONSTRAINT "credit_score_scorecard_id_scorecard_scorecard_id_fk" FOREIGN KEY ("scorecard_id") REFERENCES "public"."scorecard"("scorecard_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exposure" ADD CONSTRAINT "exposure_party_id_party_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("party_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exposure" ADD CONSTRAINT "exposure_instrument_id_instrument_instrument_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instrument"("instrument_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_rating" ADD CONSTRAINT "external_rating_party_id_party_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("party_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_rating" ADD CONSTRAINT "external_rating_instrument_id_instrument_instrument_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instrument"("instrument_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_rating" ADD CONSTRAINT "external_rating_deal_id_deal_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("deal_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_statement" ADD CONSTRAINT "financial_statement_party_id_party_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("party_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_statement" ADD CONSTRAINT "financial_statement_auditor_id_party_party_id_fk" FOREIGN KEY ("auditor_id") REFERENCES "public"."party"("party_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_beneficial_owner" ADD CONSTRAINT "kyc_beneficial_owner_kyc_record_id_kyc_record_kyc_record_id_fk" FOREIGN KEY ("kyc_record_id") REFERENCES "public"."kyc_record"("kyc_record_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_beneficial_owner" ADD CONSTRAINT "kyc_beneficial_owner_contact_id_contact_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("contact_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_record" ADD CONSTRAINT "kyc_record_party_id_party_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("party_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_record" ADD CONSTRAINT "kyc_record_contact_id_contact_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("contact_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_record" ADD CONSTRAINT "kyc_record_approved_by_user_id_app_user_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratio_result" ADD CONSTRAINT "ratio_result_financial_statement_id_financial_statement_financial_statement_id_fk" FOREIGN KEY ("financial_statement_id") REFERENCES "public"."financial_statement"("financial_statement_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard" ADD CONSTRAINT "scorecard_credit_analysis_id_credit_analysis_credit_analysis_id_fk" FOREIGN KEY ("credit_analysis_id") REFERENCES "public"."credit_analysis"("credit_analysis_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard" ADD CONSTRAINT "scorecard_template_id_scorecard_template_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."scorecard_template"("template_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_template" ADD CONSTRAINT "scorecard_template_approved_by_user_id_app_user_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sector_code" ADD CONSTRAINT "sector_code_parent_sector_code_id_sector_code_sector_code_id_fk" FOREIGN KEY ("parent_sector_code_id") REFERENCES "public"."sector_code"("sector_code_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_model" ADD CONSTRAINT "financial_model_deal_id_deal_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("deal_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_model" ADD CONSTRAINT "financial_model_party_id_party_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("party_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_model" ADD CONSTRAINT "financial_model_computed_by_user_id_app_user_user_id_fk" FOREIGN KEY ("computed_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_model" ADD CONSTRAINT "financial_model_approved_by_user_id_app_user_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_record" ADD CONSTRAINT "consent_record_party_id_party_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("party_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_record" ADD CONSTRAINT "consent_record_contact_id_contact_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("contact_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_subject_request" ADD CONSTRAINT "data_subject_request_party_id_party_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("party_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_subject_request" ADD CONSTRAINT "data_subject_request_contact_id_contact_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("contact_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_subject_request" ADD CONSTRAINT "data_subject_request_handled_by_user_id_app_user_user_id_fk" FOREIGN KEY ("handled_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_party_id_party_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("party_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_deal_id_deal_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("deal_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_contact_id_contact_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("contact_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_primary_contact_id_contact_contact_id_fk" FOREIGN KEY ("primary_contact_id") REFERENCES "public"."contact"("contact_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_user_id_app_user_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_barrier_id_information_barrier_barrier_id_fk" FOREIGN KEY ("barrier_id") REFERENCES "public"."information_barrier"("barrier_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_attendee" ADD CONSTRAINT "interaction_attendee_interaction_id_interaction_interaction_id_fk" FOREIGN KEY ("interaction_id") REFERENCES "public"."interaction"("interaction_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_attendee" ADD CONSTRAINT "interaction_attendee_contact_id_contact_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("contact_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_deal_id_deal_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("deal_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_party_id_party_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("party_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_user_id_app_user_user_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_created_by_user_id_app_user_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependency" ADD CONSTRAINT "task_dependency_task_id_task_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("task_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependency" ADD CONSTRAINT "task_dependency_depends_on_task_id_task_task_id_fk" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."task"("task_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_deal_id_deal_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("deal_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_party_id_party_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."party"("party_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_contact_id_contact_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("contact_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_uploaded_by_user_id_app_user_user_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_barrier_id_information_barrier_barrier_id_fk" FOREIGN KEY ("barrier_id") REFERENCES "public"."information_barrier"("barrier_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_app_user_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_barrier_id_information_barrier_barrier_id_fk" FOREIGN KEY ("barrier_id") REFERENCES "public"."information_barrier"("barrier_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_user_email_uidx" ON "app_user" USING btree ("email") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "app_user_active_idx" ON "app_user" USING btree ("is_active","desk") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "permission_code_uidx" ON "permission" USING btree ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "role_name_uidx" ON "role" USING btree ("name") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_role_current_uidx" ON "user_role" USING btree ("user_id","role_id") WHERE valid_to IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "user_role_user_idx" ON "user_role" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_role_role_idx" ON "user_role" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "information_barrier_deal_idx" ON "information_barrier" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "information_barrier_party_idx" ON "information_barrier" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "information_barrier_active_idx" ON "information_barrier" USING btree ("is_active") WHERE deleted_at IS NULL AND lifted_at IS NULL;--> statement-breakpoint
CREATE INDEX "address_party_current_idx" ON "address" USING btree ("party_id") WHERE is_current AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "address_state_idx" ON "address" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "party_legal_name_country_uidx" ON "party" USING btree ("legal_name","country_of_incorporation") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "party_ultimate_parent_idx" ON "party" USING btree ("ultimate_parent_party_id");--> statement-breakpoint
CREATE INDEX "party_status_brand_idx" ON "party" USING btree ("status","brand_origin");--> statement-breakpoint
CREATE INDEX "party_barrier_idx" ON "party" USING btree ("barrier_id");--> statement-breakpoint
CREATE INDEX "party_soft_delete_idx" ON "party" USING btree ("party_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "party_identifier_dedup_uidx" ON "party_identifier" USING btree ("identifier_type","identifier_value") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "party_identifier_party_idx" ON "party_identifier" USING btree ("party_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_email_uidx" ON "contact" USING btree ("primary_email") WHERE primary_email IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "contact_pan_uidx" ON "contact" USING btree ("pan") WHERE pan IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "contact_name_idx" ON "contact" USING btree ("full_name");--> statement-breakpoint
CREATE UNIQUE INDEX "party_contact_primary_uidx" ON "party_contact" USING btree ("party_id","role") WHERE is_primary AND valid_to IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "party_contact_party_idx" ON "party_contact" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "party_contact_contact_idx" ON "party_contact" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "party_contact_current_idx" ON "party_contact" USING btree ("party_id","role") WHERE valid_to IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "relationship_edge_uidx" ON "relationship" USING btree ("parent_party_id","child_party_id","relationship_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "relationship_parent_idx" ON "relationship" USING btree ("parent_party_id");--> statement-breakpoint
CREATE INDEX "relationship_child_idx" ON "relationship" USING btree ("child_party_id");--> statement-breakpoint
CREATE INDEX "relationship_bo_ownership_idx" ON "relationship" USING btree ("child_party_id","ownership_pct") WHERE relationship_type = 'beneficial_owner' AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "demat_account_dedup_uidx" ON "demat_account" USING btree ("dp_id","client_id","depository") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "demat_account_party_idx" ON "demat_account" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "allocation_event_deal_party_idx" ON "allocation_event" USING btree ("deal_id","party_id");--> statement-breakpoint
CREATE INDEX "allocation_event_event_at_idx" ON "allocation_event" USING btree ("event_at");--> statement-breakpoint
CREATE INDEX "allocation_event_type_idx" ON "allocation_event" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_deal_code_uidx" ON "deal" USING btree ("deal_code") WHERE deal_code IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "deal_type_status_brand_idx" ON "deal" USING btree ("deal_type","status","brand");--> statement-breakpoint
CREATE INDEX "deal_lead_idx" ON "deal" USING btree ("lead_user_id");--> statement-breakpoint
CREATE INDEX "deal_barrier_idx" ON "deal" USING btree ("barrier_id");--> statement-breakpoint
CREATE INDEX "deal_parent_idx" ON "deal" USING btree ("parent_deal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_party_role_uidx" ON "deal_party" USING btree ("deal_id","party_id","role") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "deal_party_deal_idx" ON "deal_party" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "deal_party_party_idx" ON "deal_party" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "deal_party_lead_idx" ON "deal_party" USING btree ("deal_id") WHERE is_lead AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "instrument_isin_uidx" ON "instrument" USING btree ("isin") WHERE isin IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "instrument_issuer_idx" ON "instrument" USING btree ("issuer_party_id");--> statement-breakpoint
CREATE INDEX "instrument_type_idx" ON "instrument" USING btree ("instrument_type");--> statement-breakpoint
CREATE INDEX "instrument_maturity_idx" ON "instrument" USING btree ("maturity_date");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_event_ccil_trade_id_uidx" ON "trade_event" USING btree ("ccil_trade_id") WHERE ccil_trade_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "trade_event_party_idx" ON "trade_event" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "trade_event_instrument_idx" ON "trade_event" USING btree ("instrument_id");--> statement-breakpoint
CREATE INDEX "trade_event_trade_at_idx" ON "trade_event" USING btree ("trade_at");--> statement-breakpoint
CREATE INDEX "trade_event_settlement_idx" ON "trade_event" USING btree ("settlement_date");--> statement-breakpoint
CREATE INDEX "credit_analysis_party_idx" ON "credit_analysis" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "credit_analysis_deal_idx" ON "credit_analysis" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "credit_analysis_analyst_idx" ON "credit_analysis" USING btree ("analyst_user_id");--> statement-breakpoint
CREATE INDEX "credit_analysis_superseded_idx" ON "credit_analysis" USING btree ("superseded_by");--> statement-breakpoint
CREATE INDEX "credit_analysis_barrier_idx" ON "credit_analysis" USING btree ("barrier_id");--> statement-breakpoint
CREATE INDEX "credit_analysis_current_idx" ON "credit_analysis" USING btree ("party_id","valid_to") WHERE valid_to IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "credit_limit_party_type_idx" ON "credit_limit" USING btree ("party_id","limit_type");--> statement-breakpoint
CREATE INDEX "credit_limit_current_idx" ON "credit_limit" USING btree ("party_id","limit_type") WHERE effective_to IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "credit_limit_review_idx" ON "credit_limit" USING btree ("review_due_date");--> statement-breakpoint
CREATE INDEX "credit_score_analysis_idx" ON "credit_score" USING btree ("credit_analysis_id");--> statement-breakpoint
CREATE INDEX "credit_score_scorecard_idx" ON "credit_score" USING btree ("scorecard_id");--> statement-breakpoint
CREATE INDEX "credit_score_component_idx" ON "credit_score" USING btree ("component_code");--> statement-breakpoint
CREATE INDEX "exposure_party_date_idx" ON "exposure" USING btree ("party_id","as_of_date");--> statement-breakpoint
CREATE INDEX "exposure_instrument_idx" ON "exposure" USING btree ("instrument_id");--> statement-breakpoint
CREATE INDEX "exposure_type_idx" ON "exposure" USING btree ("exposure_type");--> statement-breakpoint
CREATE INDEX "external_rating_party_idx" ON "external_rating" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "external_rating_instrument_idx" ON "external_rating" USING btree ("instrument_id");--> statement-breakpoint
CREATE INDEX "external_rating_deal_idx" ON "external_rating" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "external_rating_rank_idx" ON "external_rating" USING btree ("rating_rank") WHERE rating_rank IS NOT NULL;--> statement-breakpoint
CREATE INDEX "financial_statement_party_period_idx" ON "financial_statement" USING btree ("party_id","period_end_date");--> statement-breakpoint
CREATE INDEX "financial_statement_type_idx" ON "financial_statement" USING btree ("statement_type","is_consolidated");--> statement-breakpoint
CREATE UNIQUE INDEX "kyc_beneficial_owner_uidx" ON "kyc_beneficial_owner" USING btree ("kyc_record_id","contact_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "kyc_beneficial_owner_kyc_idx" ON "kyc_beneficial_owner" USING btree ("kyc_record_id");--> statement-breakpoint
CREATE INDEX "kyc_beneficial_owner_contact_idx" ON "kyc_beneficial_owner" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "kyc_record_party_idx" ON "kyc_record" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "kyc_record_contact_idx" ON "kyc_record" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "kyc_record_status_idx" ON "kyc_record" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kyc_record_rekyc_idx" ON "kyc_record" USING btree ("rekyc_due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "rating_ladder_uidx" ON "rating_ladder" USING btree ("agency","scale","symbol") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "rating_ladder_scale_rank_idx" ON "rating_ladder" USING btree ("scale","rank");--> statement-breakpoint
CREATE INDEX "ratio_result_statement_idx" ON "ratio_result" USING btree ("financial_statement_id");--> statement-breakpoint
CREATE INDEX "ratio_result_code_idx" ON "ratio_result" USING btree ("ratio_code");--> statement-breakpoint
CREATE INDEX "scorecard_analysis_idx" ON "scorecard" USING btree ("credit_analysis_id");--> statement-breakpoint
CREATE INDEX "scorecard_template_idx" ON "scorecard" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scorecard_template_uidx" ON "scorecard_template" USING btree ("obligor_type","sector_code","version") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "scorecard_template_status_idx" ON "scorecard_template" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "sector_code_code_uidx" ON "sector_code" USING btree ("code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "sector_code_parent_idx" ON "sector_code" USING btree ("parent_sector_code_id");--> statement-breakpoint
CREATE INDEX "financial_model_deal_idx" ON "financial_model" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "financial_model_party_idx" ON "financial_model" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "financial_model_type_idx" ON "financial_model" USING btree ("model_type");--> statement-breakpoint
CREATE INDEX "financial_model_parent_idx" ON "financial_model" USING btree ("parent_model_id");--> statement-breakpoint
CREATE INDEX "consent_record_party_idx" ON "consent_record" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "consent_record_contact_idx" ON "consent_record" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "consent_record_purpose_idx" ON "consent_record" USING btree ("purpose");--> statement-breakpoint
CREATE INDEX "consent_record_active_idx" ON "consent_record" USING btree ("purpose") WHERE consent_withdrawn_at IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "dsr_status_idx" ON "data_subject_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dsr_party_idx" ON "data_subject_request" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "dsr_contact_idx" ON "data_subject_request" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "interaction_party_idx" ON "interaction" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "interaction_deal_idx" ON "interaction" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "interaction_contact_idx" ON "interaction" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "interaction_occurred_at_idx" ON "interaction" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "interaction_attendee_uidx" ON "interaction_attendee" USING btree ("interaction_id","contact_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "interaction_attendee_interaction_idx" ON "interaction_attendee" USING btree ("interaction_id");--> statement-breakpoint
CREATE INDEX "interaction_attendee_contact_idx" ON "interaction_attendee" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "task_assignee_idx" ON "task" USING btree ("assignee_user_id");--> statement-breakpoint
CREATE INDEX "task_deal_idx" ON "task" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "task_party_idx" ON "task" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "task_due_date_idx" ON "task" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "task_status_idx" ON "task" USING btree ("status");--> statement-breakpoint
CREATE INDEX "task_parent_idx" ON "task" USING btree ("parent_task_id");--> statement-breakpoint
CREATE INDEX "task_open_idx" ON "task" USING btree ("assignee_user_id","due_date") WHERE status NOT IN ('completed','cancelled') AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "document_deal_idx" ON "document" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "document_party_idx" ON "document" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "document_contact_idx" ON "document" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "document_type_idx" ON "document" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "document_barrier_idx" ON "document" USING btree ("barrier_id");--> statement-breakpoint
CREATE INDEX "document_retention_idx" ON "document" USING btree ("retention_until");--> statement-breakpoint
CREATE INDEX "document_sha256_idx" ON "document" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "audit_log_occurred_at_idx" ON "audit_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_log_correlation_idx" ON "audit_log" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "audit_log_barrier_idx" ON "audit_log" USING btree ("barrier_id");