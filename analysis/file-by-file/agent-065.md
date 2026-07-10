# Agent 065 — Extreme detail analysis

Batch files: `src/db/schema/deals.ts`, `src/db/schema/demat.ts`, `src/db/schema/documents.ts`, `src/db/schema/enums.ts`

Deals/instruments trade core, demat accounts, document metadata, and the global enum catalogue (source of truth for domain vocabulary).

---

## `src/db/schema/deals.ts`

- **Lines:** 465 | **Role:** Instrument + mandate + allocation/trade event-sourcing
- **Exports:** `instrument`, `deal`, `dealParty`, `allocationEvent`, `tradeEvent`, relations, types

### `instrument` (§2.16)
- isin char(12), instrument_type, issuer_party_id, issue/maturity dates
- coupon_pct, coupon_type, frequency, face_value, issue_size (multi-currency), currency default INR
- security_package jsonb, listing_exchange, credit_enhancement_provider_id
- Unique isin where not null/deleted; indexes issuer, type, maturity

### `deal` (§2.9)
- deal_code, deal_type (18 enum values — bond_underwriting through secondary_trading_advisory)
- deal_subtype, deal_name, status (stage ladder: lead→…→closed + dropped/on_hold)
- brand: binarycapital | binarybonds | shared
- lead_user_id, credit_analyst_user_id
- target/actual close, target_size, target_tenor_years, currency
- fee_structure jsonb, mandate_letter_document_id, barrier_id, parent_deal_id (plain self-FK)
- Unique deal_code; composite index (deal_type, status, brand)

### `deal_party` (§2.10)
- UQ (deal_id, party_id, role) where not deleted
- role dealPartyRoleEnum (issuer, arranger, underwriter, book_runner, investor, … target, acquirer)
- is_lead, commitment_amount, participation_note
- Partial lead index

### `allocation_event` (§2.11) — **IMMUTABLE INSERT-only**
- deal_id, party_id, event_type: indication | order | revised_order | allocated | withdrawn | oversubscribed_adjusted | settled
- amount, yield_pct, price, price_type clean|dirty|par
- put_call_indicator competitive|non_competitive (G-Sec auction)
- allotment_pct, demat_account_id, event_at, event_by_user_id
- source_channel: phone|email|rfq_platform|ndsom|brokers|ifa
- **No updated_at/deleted_at**; barrier_id; migration trigger for immutability
- Current state = projection over events (allocation_current pattern)

### `trade_event` (§2.23.3) — **IMMUTABLE secondary trades**
- Optional deal_id; party_id; instrument_id; ccil_trade_id unique
- exchange, trade_side buy|sell, amount, currency, price, price_type, yield, quantity
- settlement_date, demat, trade_at, traded_by_user_id, barrier_id
- Feeds exposure snapshot job; CCIL/NDS-OM reportable posture

- **Security:** barrier walls; restrict onDelete for core FKs
- **Coupling:** demat, documents, party, rbac, features/deals/*
- **Risks:** Immutability triggers are migration notes — enforce in ops; compensating events for corrections

---

## `src/db/schema/demat.ts`

- **Lines:** 65 | **Role:** Investor depository accounts
- **Exports:** `dematAccount`, relations, types
- **Shape:** party_id, dp_id char(8), client_id char(8), depository NSDL|CDSL, account_status active|frozen|closed|suspended, verified_at, verification_source
- **Dedup:** unique (dp_id, client_id, depository) WHERE deleted_at IS NULL
- **Business:** NSDL IN… 8-char alphanum DP IDs vs CDSL 8-digit numeric; referenced by allocation_event/trade_event; also party_identifier type demat_dp_client
- **Security:** onDelete restrict on party
- **Risks:** No format CHECK for NSDL vs CDSL pattern in schema

---

## `src/db/schema/documents.ts`

- **Lines:** 114 | **Role:** Document **metadata only** (blob in object storage)
- **Exports:** `document`, relations, types
- **Columns:** nullable anchors deal_id / party_id / contact_id; document_type enum (engagement_letter … other); kyc_category for KYC packs; file_store_ref (S3 key); file_name, mime_type, size_bytes bigint; sha256 char(64); uploaded_by; is_confidential; barrier_id; **is_mnpi** (disables download/copy, forces watermark UI §4.5); retention_until (DPDP clock)
- **Indexes:** deal, party, contact, type, barrier, retention, sha256
- **Business:** KYC docs encryption-at-rest + access-logged separately (ARCHITECTURE §4.3) — not in this table
- **Security / RLS:** barrier + MNPI flags; cascade on deal/party/contact delete
- **Risks:** No CHECK that at least one anchor set (comment says “in practice”)

---

## `src/db/schema/enums.ts`

- **Lines:** 769 | **Role:** **Global domain vocabulary** — all `pgEnum` + citext custom type
- **Exports:** `citext` customType; ~50 pgEnums covering entire CRM
- **Notable enum inventories:**

| Enum | Values (summary) |
|------|------------------|
| party_type | issuer, investor, intermediary, arranger, underwriter, broker, ifa, rating_agency, trustee, registrar, legal_counsel, auditor, escrow_agent, guarantor, credit_enhancement_provider, government, regulator, spv, vendor, internal_staff, prospect |
| party_status | active, dormant, onboarding, blacklisted, closed |
| party_nature | organization, natural_person, spv, trust, government, regulator |
| brand | binarycapital, binarybonds, shared |
| deal_type | 18 products (bond_underwriting … secondary_trading_advisory) |
| deal_status | lead, mandated, in_dd, structuring, rating_marketing, pricing, allocation, settled, closed, dropped, on_hold |
| deal_party_role | 22 roles |
| alloc_event_type | indication…settled |
| instrument_type | corp_bond, ncd, cp, gsec, sdl, tbill, sgb, structured_credit, municipal_bond, eco_bond, equity, preference_share, warrant, convertible |
| financial_ratio | ~35 codes (current_ratio … lnf_to_tnw) |
| score_component | business_risk, financial_risk, management_risk, industry_risk, country_risk, structural_risk, ESG |
| obligor_type | corporate, spv, project, sovereign, state_psu, nbfc, bank |
| rating_agency | CRISIL, ICRA, CARE, India_Ratings, Acuite, Infomerics, Brickwork |
| kyc_status | pending…under_eds_check |
| consent_purpose / dsr_type / dsr_status | DPDP set |
| desk | ib_advisory, bond_underwriting, gsec_trading, secondary_mm, portfolio_mgmt, credit, rating_advisory, operations, compliance, management |
| audit_op | insert, update, delete, merge, approve, reject |
| day_count | ACT_365, ACT_360, thirty_360, ACT_ACT |
| settlement | T0–T3 |

- **citext:** requires `CREATE EXTENSION citext`; used for case-insensitive name/email uniqueness
- **Side effects:** Changing enum values requires Postgres `ALTER TYPE ... ADD VALUE` migrations
- **Coupling:** Every schema module + feature Zod lists must stay in sync (admin DESKS, credit OBLIGOR_TYPES, etc.)
- **Risks / TODOs:** Drift between Zod const arrays and this file; no partnership party_nature (legal form handled in app); kyc_category vs document_type overlap
