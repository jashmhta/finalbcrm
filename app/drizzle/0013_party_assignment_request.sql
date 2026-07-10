-- Party assignment approval queue (employee requests → super-admin approves).
-- One open request per party; cannot assign the same staff who already owns it.

CREATE TABLE IF NOT EXISTS party_assignment_request (
  request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES party(party_id) ON DELETE CASCADE,
  from_user_id uuid REFERENCES app_user(user_id) ON DELETE SET NULL,
  to_user_id uuid NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  requested_by_user_id uuid NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  note text,
  reviewed_by_user_id uuid REFERENCES app_user(user_id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS party_assignment_request_party_idx
  ON party_assignment_request (party_id);

CREATE INDEX IF NOT EXISTS party_assignment_request_to_user_idx
  ON party_assignment_request (to_user_id);

CREATE INDEX IF NOT EXISTS party_assignment_request_status_idx
  ON party_assignment_request (status);

-- At most one pending request per party
CREATE UNIQUE INDEX IF NOT EXISTS party_assignment_request_open_party_uidx
  ON party_assignment_request (party_id)
  WHERE status = 'pending';

-- No duplicate pending request for the same party → same assignee
CREATE UNIQUE INDEX IF NOT EXISTS party_assignment_request_open_pair_uidx
  ON party_assignment_request (party_id, to_user_id)
  WHERE status = 'pending';
