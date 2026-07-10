
# Batch 002

## `drizzle/0003_rls.sql`

- **Lines:** 382 | **Bytes:** 16435
- **Kind:** SQL migration
- **Security signals:** rbac/rls, india-compliance
- **Domain terms:** barrier, credit_analysis, party
- **ALTER TABLE:** allocation_event, audit_log, consent_record, credit_analysis, credit_limit, deal, deal_party, document, exposure, external_rating, financial_model, interaction, interaction_attendee, kyc_record, party, trade_event
- **CREATE POLICY:** IF, party_rls, deal_rls, deal_party_rls, interaction_rls, interaction_attendee_rls, document_rls, credit_analysis_rls, financial_model_rls, allocation_event_rls, trade_event_rls, kyc_record_rls, consent_record_rls, external_rating_rls, exposure_rls, credit_limit_rls, audit_log_insert_rls
- **RLS mentions:** 35

## `drizzle/0004_rls_fix.sql`

- **Lines:** 111 | **Bytes:** 5784
- **Kind:** SQL migration
- **Security signals:** rbac/rls, india-compliance
- **Domain terms:** barrier, credit_analysis, mandate, party
- **CREATE POLICY:** audit_log_select_rls, audit_log_select_rls

## `drizzle/0005_indexes.sql`

- **Lines:** 146 | **Bytes:** 8098
- **Kind:** SQL migration
- **Security signals:** rbac/rls, india-compliance
- **Domain terms:** KYC, credit_analysis, party

## `drizzle/0006_leads.sql`

- **Lines:** 62 | **Bytes:** 3576
- **Kind:** SQL migration
- **Security signals:** rbac/rls
- **Domain terms:** investor, issuer, mandate, party
- **ALTER TABLE:** party
