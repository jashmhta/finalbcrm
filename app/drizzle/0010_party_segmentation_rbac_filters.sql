-- 0010_party_segmentation_rbac_filters.sql
-- Add production CRM segmentation, rating, investor-suitability and ownership
-- fields to party. Additive only; safe to re-run.

ALTER TABLE party ADD COLUMN IF NOT EXISTS assigned_user_id uuid;
ALTER TABLE party ADD COLUMN IF NOT EXISTS data_owner_user_id uuid;
ALTER TABLE party ADD COLUMN IF NOT EXISTS annual_turnover_cr numeric(18,4);
ALTER TABLE party ADD COLUMN IF NOT EXISTS turnover_band text;
ALTER TABLE party ADD COLUMN IF NOT EXISTS industry_sector text;
ALTER TABLE party ADD COLUMN IF NOT EXISTS industry_subsector text;
ALTER TABLE party ADD COLUMN IF NOT EXISTS latest_rating text;
ALTER TABLE party ADD COLUMN IF NOT EXISTS latest_rating_agency text;
ALTER TABLE party ADD COLUMN IF NOT EXISTS latest_rating_year integer;
ALTER TABLE party ADD COLUMN IF NOT EXISTS latest_rating_header text;
ALTER TABLE party ADD COLUMN IF NOT EXISTS investor_type text;
ALTER TABLE party ADD COLUMN IF NOT EXISTS portfolio_size_cr numeric(18,4);
ALTER TABLE party ADD COLUMN IF NOT EXISTS portfolio_size_band text;
ALTER TABLE party ADD COLUMN IF NOT EXISTS risk_appetite text;
ALTER TABLE party ADD COLUMN IF NOT EXISTS high_yield_appetite boolean DEFAULT false;
ALTER TABLE party ADD COLUMN IF NOT EXISTS existing_securities_note text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'party_assigned_user_id_app_user_fk'
  ) THEN
    ALTER TABLE party
      ADD CONSTRAINT party_assigned_user_id_app_user_fk
      FOREIGN KEY (assigned_user_id) REFERENCES app_user(user_id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'party_data_owner_user_id_app_user_fk'
  ) THEN
    ALTER TABLE party
      ADD CONSTRAINT party_data_owner_user_id_app_user_fk
      FOREIGN KEY (data_owner_user_id) REFERENCES app_user(user_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS party_assigned_user_idx
  ON party (assigned_user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS party_turnover_band_idx
  ON party (turnover_band)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS party_industry_sector_idx
  ON party (industry_sector, industry_subsector)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS party_latest_rating_idx
  ON party (latest_rating, latest_rating_agency, latest_rating_year)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS party_investor_suitability_idx
  ON party (investor_type, portfolio_size_band, risk_appetite)
  WHERE deleted_at IS NULL;

