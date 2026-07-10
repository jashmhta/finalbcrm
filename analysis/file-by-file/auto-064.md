
# Batch 064

## `src/db/schema/auth.ts`

- **Lines:** 159 | **Bytes:** 7058
- **Kind:** Drizzle DB schema; Schema tables: users, accounts, sessions, verification_tokens, authenticators
- **Header intent:** Auth.js v5 identity tables (users / accounts / sessions / verificationTokens / authenticators) - the standard @auth/drizzle-adapter shape.  LINKAGE DESIGN (app_user ↔ users): the 1:1 link is `users.app_user_id` → `app_user.user_id`. The column is declared here as a plain `uuid` (NOT via Drizzle `references()`) and the FK constraint is added via raw SQL in a migration - see the MIGRATION NOTE below. Reason: `app_user` participates in a mutual FK cycle with `contact` (contact.created_by_user_id → 
- **Exported const:** users, accounts, sessions, verificationTokens, authenticators
- **Exported types:** AuthUser, AuthUserInsert, AuthAccount, AuthAccountInsert, AuthSession, AuthSessionInsert, AuthVerificationToken, AuthVerificationTokenInsert, Authenticator, AuthenticatorInsert
- **pgTable:** users, accounts, sessions, verification_tokens, authenticators
- **Security signals:** rbac/rls, credentials
- **External deps:** drizzle-orm/pg-core

## `src/db/schema/compliance.ts`

- **Lines:** 175 | **Bytes:** 6299
- **Kind:** Drizzle DB schema; Schema tables: consent_record, data_subject_request
- **Header intent:** Compliance: consent_record (DPDP Act 2023) + data_subject_request. DATA_MODEL §2.21, §2.23.8. Consent is purpose-bound - a marketing consent does not authorize sharing data with a rating agency; that requires its own consent_record. Withdrawal triggers a data_subject_request workflow.
- **Exported const:** consentRecord, dataSubjectRequest, consentRecordRelations, dataSubjectRequestRelations
- **Exported types:** ConsentRecord, ConsentRecordInsert, DataSubjectRequest, DataSubjectRequestInsert
- **pgTable:** consent_record, data_subject_request
- **DB ops patterns:** where
- **Security signals:** india-compliance
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (4):** ./enums, ./rbac, ./party, ./contact
- **Domain terms:** party

## `src/db/schema/contact.ts`

- **Lines:** 179 | **Bytes:** 6641
- **Kind:** Drizzle DB schema; Schema tables: contact, party_contact
- **Header intent:** Contact (natural person) + party_contact (role link with interval). DATA_MODEL §2.4-2.5. Contacts are decoupled from parties; roles are the link. We never delete a contact when they leave a firm - we close the PartyContact interval (§1.2).
- **Exported const:** contact, partyContact, contactRelations, partyContactRelations
- **Exported types:** Contact, ContactInsert, PartyContact, PartyContactInsert
- **pgTable:** contact, party_contact
- **DB ops patterns:** where
- **Security signals:** india-compliance
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (3):** ./enums, ./rbac, ./party
- **Domain terms:** party

## `src/db/schema/credit.ts`

- **Lines:** 989 | **Bytes:** 38016
- **Kind:** Drizzle DB schema; Schema tables: sector_code, credit_analysis, financial_statement, credit_analysis_fs_link, ratio_result, scorecard_template, scorecard, credit_score, external_rating, rating_ladder, exposure, credit_limit, kyc_record, kyc_beneficial_owner
- **Header intent:** Credit analysis subsystem. DATA_MODEL §2.12-2.16, §2.20, §2.23.6-2.23.7. CREDIT_ANALYSIS_SPEC §13.  Tables: sector_code, credit_analysis, financial_statement, credit_analysis_fs_link (junction), ratio_result, credit_score, scorecard, scorecard_template, external_rating, rating_ladder, exposure, credit_limit, kyc_record, kyc_beneficial_owner (junction).  Interpretation note: DATA_MODEL §2.23.6 `scorecard` carries factor_weights (a template), while CREDIT_ANALYSIS_SPEC §13 distinguishes `Scorecard
- **Exported const:** sectorCode, creditAnalysis, financialStatement, creditAnalysisFsLink, ratioResult, scorecardTemplate, scorecard, creditScore, externalRating, ratingLadder, exposure, creditLimit, kycRecord, kycBeneficialOwner, sectorCodeRelations, creditAnalysisRelations, financialStatementRelations, creditAnalysisFsLinkRelations, ratioResultRelations, scorecardTemplateRelations, scorecardRelations, creditScoreRelations, externalRatingRelations, ratingLadderRelations, exposureRelations, creditLimitRelations, kycRecordRelations, kycBeneficialOwnerRelations
- **Exported types:** SectorCode, SectorCodeInsert, CreditAnalysis, CreditAnalysisInsert, FinancialStatement, FinancialStatementInsert, CreditAnalysisFsLink, CreditAnalysisFsLinkInsert, RatioResult, RatioResultInsert, ScorecardTemplate, ScorecardTemplateInsert, Scorecard, ScorecardInsert, CreditScore, CreditScoreInsert, ExternalRating, ExternalRatingInsert, RatingLadder, RatingLadderInsert, Exposure, ExposureInsert, CreditLimit, CreditLimitInsert, KycRecord, KycRecordInsert, KycBeneficialOwner, KycBeneficialOwnerInsert
- **pgTable:** sector_code, credit_analysis, financial_statement, credit_analysis_fs_link, ratio_result, scorecard_template, scorecard, credit_score, external_rating, rating_ladder, exposure, credit_limit, kyc_record, kyc_beneficial_owner
- **DB ops patterns:** where
- **Security signals:** rbac/rls, india-compliance
- **External deps:** drizzle-orm, drizzle-orm/pg-core
- **Internal imports (8):** ./enums, ./rbac, ./party, ./deals, ./deals, ./information_barrier, ./contact, ./documents
- **Domain terms:** KYC, Scorecard, barrier, credit_analysis, issuer, mandate, party, scorecard
