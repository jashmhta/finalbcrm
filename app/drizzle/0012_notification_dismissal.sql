-- Persist notification dismissals for multi-device read state.
-- Engine still computes live notifications; this table stores dismissals.

CREATE TABLE IF NOT EXISTS "notification_dismissal" (
  "user_id" uuid NOT NULL REFERENCES "app_user"("user_id") ON DELETE CASCADE,
  "entity_key" text NOT NULL,
  "dismissed_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "notification_dismissal_pk" PRIMARY KEY ("user_id", "entity_key")
);

CREATE INDEX IF NOT EXISTS "notification_dismissal_user_idx"
  ON "notification_dismissal" ("user_id");

CREATE INDEX IF NOT EXISTS "notification_dismissal_at_idx"
  ON "notification_dismissal" ("dismissed_at");
