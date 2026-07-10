
# Batch 001

## `drizzle.config.ts`

- **Lines:** 12 | **Bytes:** 255
- **Kind:** Application module
- **Default export:** yes
- **External deps:** drizzle-kit

## `drizzle/0000_minor_kitty_pryde.sql`

- **Lines:** 995 | **Bytes:** 75318
- **Kind:** SQL migration
- **Security signals:** rbac/rls, credentials, india-compliance
- **Domain terms:** allocation, binarybonds, binarycapital, credit_analysis, deal_status, gsec, investor, issuer, onboarding, party, scorecard
- **CREATE TABLE:** app_user, permission, role, role_permission, user_role, information_barrier, address, party, party_identifier, party_type_assignment, contact, party_contact, relationship, demat_account, allocation_event, deal, deal_party, instrument, trade_event, credit_analysis, credit_analysis_fs_link, credit_limit, credit_score, exposure, external_rating, financial_statement, kyc_beneficial_owner, kyc_record, rating_ladder, ratio_result, scorecard, scorecard_template, sector_code, financial_model, consent_record, data_subject_request, interaction, interaction_attendee, task, task_dependency, document, audit_log
- **ALTER TABLE:** address, allocation_event, app_user, audit_log, consent_record, contact, credit_analysis, credit_analysis_fs_link, credit_limit, credit_score, data_subject_request, deal, deal_party, demat_account, document, exposure, external_rating, financial_model, financial_statement, information_barrier, instrument, interaction, interaction_attendee, kyc_beneficial_owner, kyc_record, party, party_contact, party_identifier, party_type_assignment, ratio_result, relationship, role_permission, scorecard, scorecard_template, sector_code, task, task_dependency, trade_event, user_role

## `drizzle/0001_easy_scarlet_spider.sql`

- **Lines:** 64 | **Bytes:** 2686
- **Kind:** SQL migration
- **Security signals:** rbac/rls
- **CREATE TABLE:** accounts, authenticators, sessions, users, verification_tokens
- **ALTER TABLE:** accounts, app_user, authenticators, information_barrier, sector_code, sessions

## `drizzle/0002_auth.sql`

- **Lines:** 22 | **Bytes:** 1166
- **Kind:** SQL migration
- **Security signals:** credentials
- **ALTER TABLE:** app_user
