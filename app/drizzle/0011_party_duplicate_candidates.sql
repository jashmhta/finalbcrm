-- 0011_party_duplicate_candidates.sql
-- Human-reviewed duplicate queue for party master imports and manual creates.
-- Uses the existing dedup_status enum from the baseline migration.

CREATE TABLE IF NOT EXISTS party_duplicate_candidate (
  duplicate_candidate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_party_id uuid NOT NULL REFERENCES party(party_id) ON DELETE CASCADE,
  candidate_party_id uuid NOT NULL REFERENCES party(party_id) ON DELETE CASCADE,
  match_rule text NOT NULL,
  match_score numeric(5,4) NOT NULL,
  status dedup_status NOT NULL DEFAULT 'open',
  evidence jsonb,
  created_by_user_id uuid REFERENCES app_user(user_id) ON DELETE SET NULL,
  resolved_by_user_id uuid REFERENCES app_user(user_id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT party_duplicate_candidate_no_self
    CHECK (source_party_id <> candidate_party_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS party_duplicate_candidate_pair_uidx
  ON party_duplicate_candidate (source_party_id, candidate_party_id, match_rule)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS party_duplicate_candidate_status_idx
  ON party_duplicate_candidate (status, created_at);

CREATE INDEX IF NOT EXISTS party_duplicate_candidate_source_idx
  ON party_duplicate_candidate (source_party_id);

CREATE INDEX IF NOT EXISTS party_duplicate_candidate_candidate_idx
  ON party_duplicate_candidate (candidate_party_id);

