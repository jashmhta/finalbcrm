-- 0007_onboarding.sql — Client Onboarding
-- ===========================================================================
-- Track Client Onboarding. Owns: drizzle/0007_onboarding.sql.
--
-- DESIGN (per the Onboarding domain brief). Client onboarding is the workflow
-- that turns a prospect into an active, KYC-cleared, compliance-approved client
-- of the bond house / IB. The CRM's party master is the single source of truth
-- for entities, so onboarding lives ON party as a flexible JSONB column rather
-- than a parallel table — identical in spirit to lead_meta (0006). This keeps
-- the onboarding case in sync with party RLS, dedup, identifiers and the
-- relationship graph, and avoids a duplicate entity store.
--
-- The onboarding_meta blob carries the onboarding-specific state the frozen
-- party schema does not have columns for:
--
--   stage             initiated | profile_created | documents_collected |
--                     kyc_verified | compliance_approved | active
--   clientType        the intended party role (issuer | investor | intermediary |
--                     arranger | underwriter | broker | ifa | rating_agency |
--                     trustee | registrar | legal_counsel | auditor | guarantor |
--                     government | spv | vendor) — stored as the enum string so
--                     activation can flow into a real party_type_assignment.
--   assignedRm        app_user.user_id (uuid as text) or null
--   contactName / contactTitle / contactEmail / contactPhone
--                     the primary authorized signatory captured in the wizard
--   pan / cin / gstin / state / city
--                     company identifiers + registered-office geography
--   documents[]       the 7-document checklist (incorporation certificate, PAN
--                     card, board resolution, authorized signatory KYC,
--                     financial statements, beneficial ownership declaration,
--                     consent form). Each item: { key, status
--                     pending|uploaded, verification pending|verified|rejected,
--                     documentId, uploadedAt, verifiedAt, verifiedBy,
--                     rejectionReason }.
--   kycRecordId       kyc_record.kyc_record_id (uuid as text) created/linked by
--                     the onboarding flow, else null. The live KYC status is
--                     read from kyc_record (denormalized on read, not stored) so
--                     it can never go stale.
--   complianceApprovedBy / complianceApprovedAt
--   complianceRejectedBy / complianceRejectedAt / complianceNote
--   stageHistory[]    { stage, enteredAt } — the per-stage entry timestamps that
--                     drive the SLA clocks (documents 3d, KYC 7d, compliance 2d).
--   rejectionReason   text (whole-case rejection, if any)
--   createdAt / updatedAt   ISO timestamps
--
-- A party is an onboarding case iff onboarding_meta IS NOT NULL. This cleanly
-- separates onboarding from every other party role. The party row's own
-- status column tracks prospect→active (status='onboarding' while the case is
-- open, flipped to 'active' by activateClient); onboarding_meta carries the
-- fine-grained stage + checklist + SLA state.
--
-- ADDITIVE ONLY: a single nullable column + two indexes. No existing column
-- is changed, no data is touched, party RLS policies are unaffected (the
-- column rides on party's existing policies). Safe to re-run.
--
-- Apply with:
--   psql "postgresql://crm:crm@127.0.0.1:5432/binary_crm" -f drizzle/0007_onboarding.sql

-- ── 1. onboarding_meta column on party ────────────────────────────────────
-- Nullable JSONB. NULL for every existing party (so existing rows are
-- onboarding cases only when the onboarding feature writes the blob). No NOT
-- NULL default, no backfill — the onboarding seed owns populating it.
ALTER TABLE party
  ADD COLUMN IF NOT EXISTS onboarding_meta jsonb;

-- ── 2. Indexes ─────────────────────────────────────────────────────────────
-- Partial index: only parties that ARE onboarding cases carry a non-null
-- onboarding_meta, so a WHERE onboarding_meta IS NOT NULL predicate makes the
-- index tiny and the pipeline query (the hottest onboarding read) index-only
-- over the onboarding set.
CREATE INDEX IF NOT EXISTS party_onboarding_meta_present_idx
  ON party (party_id)
  WHERE onboarding_meta IS NOT NULL AND deleted_at IS NULL;

-- Expression index on the stage key so the kanban grouping (GROUP BY stage,
-- ORDER BY funnel) and the stage-filter in the command bar hit an index
-- instead of a full JSONB scan.
CREATE INDEX IF NOT EXISTS party_onboarding_stage_idx
  ON party ((onboarding_meta->>'stage'))
  WHERE onboarding_meta IS NOT NULL AND deleted_at IS NULL;
