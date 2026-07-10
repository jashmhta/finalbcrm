-- 0005_indexes.sql — Database performance pass (hot query-path indexes).
--
-- Idempotent: every statement uses CREATE INDEX IF NOT EXISTS so re-running
-- (or running where the Drizzle schema already created an index of the same
-- name) is a no-op. This migration is schema-only — no table/column changes,
-- so it is safe alongside src/db/schema/* (which is owned by the schema layer).
--
-- CONTEXT (important): the Drizzle schema already created a comprehensive set
-- of indexes for this DB. This migration therefore (a) no-ops on the indexes
-- that already exist by reusing their EXACT names, and (b) adds the handful
-- that are genuinely missing and useful for the hottest read paths. A few
-- entries from the optimization spec are deliberately omitted with an inline
-- comment where an existing composite already covers the access path or the
-- referenced column does not exist on the table.
--
-- Apply with:
--   sudo -u postgres psql -d binary_crm -f drizzle/0005_indexes.sql

-- pg_trgm is required for the ILIKE / %q% trigram GIN indexes. Already
-- installed in this DB; IF NOT EXISTS keeps this portable + safe.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- party  (list explorer + dashboard total + relationship graph lookups)
-- ============================================================================

-- Fuzzy ILIKE search on legal_name (listParties `q`). GIN trigram already
-- exists under this exact name → no-op, kept for documentation + portability.
CREATE INDEX IF NOT EXISTS party_legal_name_trgm_idx
  ON party USING gin (legal_name gin_trgm_ops);

-- Soft-delete ordering / "recently deleted" admin scans. NOTE: the actual
-- `WHERE deleted_at IS NULL` filter on party is already served by the partial
-- indexes party_soft_delete_idx (party_id) and party_legal_name_country_uidx
-- (legal_name, country) — both partial WHERE deleted_at IS NULL — so a plain
-- btree on deleted_at is low-selectivity for that filter but cheap and useful
-- for deleted-at ordering; added per the optimization spec.
CREATE INDEX IF NOT EXISTS party_deleted_at_idx ON party (deleted_at);

-- created_at ordering (recent-party scans / default sort fallback).
CREATE INDEX IF NOT EXISTS party_created_at_idx ON party (created_at);

-- (party_identifier partial unique already exists from the schema — skipped.)

-- ============================================================================
-- deal  (dashboard open-deal filter+group + pipeline board)
-- ============================================================================

-- Dashboard "open deals by stage": WHERE deleted_at IS NULL AND status IN (…)
-- GROUP BY status. The existing deal_type_status_brand_idx composite has
-- status as its 2nd column, so it CANNOT serve a status-only filter. This
-- PARTIAL index on (status) restricted to live deals is the hot path for the
-- command center stage strip + the deal pipeline board.
CREATE INDEX IF NOT EXISTS deal_status_idx
  ON deal (status) WHERE deleted_at IS NULL;

-- deal_type is the LEADING column of deal_type_status_brand_idx, so a separate
-- deal_type index would be a redundant duplicate (covered by the composite's
-- leftmost prefix). Skipped to avoid duplicate write overhead.

-- Soft-delete filter for the deal pipeline (WHERE deleted_at IS NULL). Same
-- caveat as party: the live-deal filter is partially covered by
-- deal_deal_code_uidx (partial WHERE deleted_at IS NULL); this plain btree
-- covers deleted-at ordering and is added per the spec.
CREATE INDEX IF NOT EXISTS deal_deleted_at_idx ON deal (deleted_at);

-- ============================================================================
-- credit_analysis  (credit list + dashboard "credit in progress")
-- ============================================================================

-- party_id index already exists as credit_analysis_party_idx → no-op here.
CREATE INDEX IF NOT EXISTS credit_analysis_party_idx
  ON credit_analysis (party_id);

-- NOTE: credit_analysis has NO `status` column — analysis lifecycle is modelled
-- via valid_to / superseded_by, and the dashboard "credit in progress" filter
-- (valid_to IS NULL AND superseded_by IS NULL AND deleted_at IS NULL) is served
-- by the partial credit_analysis_current_idx (party_id, valid_to). The spec's
-- "btree on status" is therefore not applicable to this table — skipped.

-- ============================================================================
-- kyc_record  (KYC list + dashboard "KYC expiring soon")
-- ============================================================================

-- All three already exist → no-ops, kept for documentation. The KYC list
-- ORDER BY rekyc_due_date + the dashboard expiring-soon filter rely on these.
CREATE INDEX IF NOT EXISTS kyc_record_status_idx  ON kyc_record (status);
CREATE INDEX IF NOT EXISTS kyc_record_rekyc_idx   ON kyc_record (rekyc_due_date);
CREATE INDEX IF NOT EXISTS kyc_record_party_idx   ON kyc_record (party_id);

-- ============================================================================
-- audit_log  (entity history panels)
-- ============================================================================

-- occurred_at already indexed (audit_log_occurred_at_idx) → no-op. audit_log is
-- NOT partitioned in this DB (verified); the btree helps the within-table
-- ORDER BY occurred_at scans used by the KYC / entity history panels.
CREATE INDEX IF NOT EXISTS audit_log_occurred_at_idx ON audit_log (occurred_at);

-- entity_type is the LEADING column of audit_log_entity_idx (entity_type,
-- entity_id), so a standalone entity_type index is covered by that composite's
-- leftmost prefix → skipped to avoid a redundant duplicate.

-- ============================================================================
-- interaction  (timeline + dashboard recent-activity rail)
-- ============================================================================

-- Both already exist → no-ops. The dashboard recent-activity DISTINCT-ON(day)
-- ORDER BY occurred_at DESC relies on interaction_occurred_at_idx.
CREATE INDEX IF NOT EXISTS interaction_occurred_at_idx ON interaction (occurred_at);
CREATE INDEX IF NOT EXISTS interaction_party_idx       ON interaction (party_id);

-- ============================================================================
-- task  (worklist + my-tasks views)
-- ============================================================================

-- All three already exist → no-ops. task_open_idx (partial) is the open-
-- worklist hot path; these plain btrees back the status / assignee / due-date
-- filters.
CREATE INDEX IF NOT EXISTS task_status_idx   ON task (status);
CREATE INDEX IF NOT EXISTS task_assignee_idx ON task (assignee_user_id);
CREATE INDEX IF NOT EXISTS task_due_date_idx ON task (due_date);

-- ============================================================================
-- document  (document explorer)
-- ============================================================================

-- Both already exist → no-ops.
CREATE INDEX IF NOT EXISTS document_type_idx ON document (document_type);
CREATE INDEX IF NOT EXISTS document_deal_idx ON document (deal_id);

-- ============================================================================
-- financial_model  (modeling library)
-- ============================================================================

-- Both already exist → no-ops.
CREATE INDEX IF NOT EXISTS financial_model_type_idx ON financial_model (model_type);
CREATE INDEX IF NOT EXISTS financial_model_deal_idx ON financial_model (deal_id);

-- ============================================================================
-- exposure  (credit detail exposure panel)
-- ============================================================================

-- party_id is the LEADING column of exposure_party_date_idx (party_id,
-- as_of_date), so a standalone exposure(party_id) index is covered by that
-- composite's leftmost prefix → skipped to avoid a redundant duplicate.
