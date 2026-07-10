
# Batch 065

## `src/db/schema/deals.ts`

- **Lines:** 464 | **Bytes:** 17216
- **Kind:** Drizzle DB schema; Schema tables: instrument, deal, deal_party, allocation_event, trade_event
- **Header intent:** Deals: instrument, deal, deal_party, allocation_event, trade_event. DATA_MODEL §2.9-2.11, §2.16, §2.23.3. Allocation and trade events are IMMUTABLE append-only (§1.3, §2.11, §2.23.3) - post-pricing rows are frozen; corrections append a new compensating event. This is the regulator-grade trade-record pattern for CCIL/NDS-OM reportable trades (§2.11).
- **Exported const:** instrument, deal, dealParty, allocationEvent, tradeEvent, instrumentRelations, dealRelations, dealPartyRelations, allocationEventRelations, tradeEventRelations
- **Exported types:** Instrument, InstrumentInsert, Deal, DealInsert, DealParty, DealPartyInsert, AllocationEvent, AllocationEventInsert, TradeEvent, TradeEventInsert
- **pgTable:** instrument, deal, deal_party, allocation_event, trade_event
- **DB ops patterns:** where
- **Security signals:** rbac/rls, india-compliance
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (6):** ./enums, ./rbac, ./party, ./information_barrier, ./demat, ./documents
- **Domain terms:** Allocation, Underwriting, barrier, demat, investor, issuer, mandate, party

## `src/db/schema/demat.ts`

- **Lines:** 64 | **Bytes:** 2108
- **Kind:** Drizzle DB schema; Schema tables: demat_account
- **Header intent:** Demat account - investor depository account (§2.23.1, §3). NSDL `IN...` 8-char alphanumeric DP IDs vs CDSL 8-digit numeric. The dedup key is (dp_id, client_id, depository) WHERE deleted_at IS NULL. Referenced by allocation_event.demat_account_id and by party_identifier(identifier_type='demat_dp_client').
- **Exported const:** dematAccount, dematAccountRelations
- **Exported types:** DematAccount, DematAccountInsert
- **pgTable:** demat_account
- **DB ops patterns:** where
- **Security signals:** india-compliance
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (2):** ./enums, ./party
- **Domain terms:** Demat, demat, investor, party

## `src/db/schema/documents.ts`

- **Lines:** 113 | **Bytes:** 3798
- **Kind:** Drizzle DB schema; Schema tables: document
- **Header intent:** document - metadata only (§2.20). The file blob lives in S3-compatible object storage with a reference; KYC documents are encryption-at-rest + access-logged separately (ARCHITECTURE §4.3). barrier_id is the information-wall tag for RLS (§1.7).
- **Exported const:** document, documentRelations
- **Exported types:** Document, DocumentInsert
- **pgTable:** document
- **Security signals:** rbac/rls, india-compliance
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (6):** ./enums, ./rbac, ./party, ./contact, ./deals, ./information_barrier
- **Domain terms:** KYC, barrier, party

## `src/db/schema/enums.ts`

- **Lines:** 768 | **Bytes:** 17146
- **Kind:** Drizzle DB schema; Enums: party_type, party_status, party_nature, brand, data_source, identifier_type, regn_category, relationship_type, depository, demat_status, deal_type, deal_status
- **Header intent:** Enums and shared column primitives for the Binary Capital / Binary Bonds CRM schema. Source of truth: /home/Jashmhta/crm/docs/DATA_MODEL.md §6 (enumerations) + inline enum mentions throughout §2 and §3, plus /home/Jashmhta/crm/docs/CREDIT_ANALYSIS_SPEC.md §13.  NOTE on `citext`: PostgreSQL's case-insensitive text type. Requires `CREATE EXTENSION IF NOT EXISTS citext;` in a baseline migration before tables using it are created. The customType below emits the literal SQL type `citext` so drizzle-k
- **Exported const:** citext, partyTypeEnum, partyStatusEnum, partyNatureEnum, brandEnum, dataSourceEnum, identifierTypeEnum, regnCategoryEnum, relationshipTypeEnum, depositoryEnum, dematStatusEnum, dealTypeEnum, dealStatusEnum, dealPartyRoleEnum, allocEventTypeEnum, priceTypeEnum, auctionBidTypeEnum, allocSourceChannelEnum, instrumentTypeEnum, exchangeEnum, couponTypeEnum, frequencyEnum, dayCountEnum, settlementEnum, tradeSideEnum, kycStatusEnum, kycTypeEnum, kycRiskEnum, kycCategoryEnum, pepEnum…
- **pgEnum:** party_type, party_status, party_nature, brand, data_source, identifier_type, regn_category, relationship_type, depository, demat_status, deal_type, deal_status, deal_party_role, alloc_event_type, price_type, auction_bid_type, alloc_source_channel, instrument_type, exchange, coupon_type, frequency, day_count, settlement, trade_side, kyc_status, kyc_type, kyc_risk, kyc_category, pep, consent_purpose, consent_method, dsr_type, dsr_status, model_type, financial_ratio, score_component, obligor_type, credit_analysis_type, internal_rating_action, outlook, rating_action, rating_agency, rating_scale, exposure_type, limit_type, scorecard_status, period_type, statement_type, units, fs_source, fs_link_role, interaction_channel, interaction_direction, attendee_role, document_type, task_status, task_priority, salutation, contact_role, address_type, tag_category, tag_target, segment_class, desk, audit_op, dedup_status, fema_residential_status
- **Security signals:** india-compliance
- **External deps:** drizzle-orm/pg-core
- **Domain terms:** Allocation, Demat, KYC, Party, allocation, binarybonds, binarycapital, bond, credit_analysis, deal_status, gsec, investor, issuer, onboarding, party
