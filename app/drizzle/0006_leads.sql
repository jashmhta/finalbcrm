-- 0006_leads.sql — Lead & Opportunity Management
-- ===========================================================================
-- Track Leads / CRM. Owns: drizzle/0006_leads.sql.
--
-- DESIGN (per the Leads domain brief). A lead is a prospect relationship the
-- firm is qualifying toward a mandate. The CRM's party master is the single
-- source of truth for entities, so a lead lives ON party as a flexible JSONB
-- column rather than a parallel table. This keeps the lead in sync with party
-- RLS, dedup, identifiers and the relationship graph, and avoids a duplicate
-- entity store. The lead_meta blob carries the lead-specific state that the
-- frozen party schema does not have columns for:
--
--   stage           new | qualified | opportunity | won | lost
--   source          referral | website | event | cold_call | existing_client
--   dealType        a deal_type enum value (bond_underwriting, m_and_a, …)
--   estSizeCr       estimated deal size in ₹ Cr (numeric)
--   probability     0–100 (int)
--   expectedClose   ISO date (yyyy-mm-dd) or null
--   assignedRm      app_user.user_id (uuid as text) or null
--   contactName / contactTitle / contactEmail / contactPhone
--   bant            { budget, authority, need, timeline } booleans
--   notes           free text
--   lossReason      text (lost only)
--   convertedDealId deal.deal_id (uuid as text) created on win, else null
--   createdAt / updatedAt  ISO timestamps
--
-- A party is a lead iff lead_meta IS NOT NULL. This cleanly separates leads
-- from every other party role without forcing party_type='prospect' (an
-- existing client can surface a new lead — source='existing_client' — and
-- remains type issuer/investor). The Deals module is untouched: a won lead
-- promotes to a real deal row on conversion (winLead), linked back via
-- convertedDealId; until then no deal row exists, so the Deals board is never
-- polluted by pre-mandate leads.
--
-- ADDITIVE ONLY: a single nullable column + two indexes. No existing column
-- is changed, no data is touched, party RLS policies are unaffected (the
-- column rides on party's existing policies). Safe to re-run.
--
-- Apply with:
--   psql "postgresql://crm:crm@127.0.0.1:5432/binary_crm" -f drizzle/0006_leads.sql

-- ── 1. lead_meta column on party ───────────────────────────────────────────
-- Nullable JSONB. NULL for every existing party (so existing rows are leads
-- only when the leads feature writes the blob). No NOT NULL default, no
-- backfill — the leads seed owns populating it.
ALTER TABLE party
  ADD COLUMN IF NOT EXISTS lead_meta jsonb;

-- ── 2. Indexes ─────────────────────────────────────────────────────────────
-- Partial index: only parties that ARE leads carry a non-null lead_meta, so a
-- WHERE lead_meta IS NOT NULL predicate makes the index tiny and the pipeline
-- query (the hottest lead read) index-only over the lead set.
CREATE INDEX IF NOT EXISTS party_lead_meta_present_idx
  ON party (party_id)
  WHERE lead_meta IS NOT NULL AND deleted_at IS NULL;

-- Expression index on the stage key so the kanban grouping (GROUP BY stage,
-- ORDER BY funnel) and the stage-filter in the command bar hit an index
-- instead of a full JSONB scan.
CREATE INDEX IF NOT EXISTS party_lead_stage_idx
  ON party ((lead_meta->>'stage'))
  WHERE lead_meta IS NOT NULL AND deleted_at IS NULL;
