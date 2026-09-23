-- One composite index serves every stats query (count, per-day, referrers):
-- all filter on url_id first, and clicked_at second gives time-ordered rows.
-- It also covers the FK, so ON DELETE CASCADE doesn't scan all of clicks.
CREATE INDEX IF NOT EXISTS clicks_url_id_clicked_at_idx ON clicks (url_id, clicked_at);

-- Superseded: url_id alone is a prefix of the composite index, and nothing
-- queries clicked_at across all URLs. Each extra index slows the redirect insert.
DROP INDEX IF EXISTS clicks_url_id_idx;
DROP INDEX IF EXISTS clicks_clicked_at_idx;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'urls_long_url_len') THEN
    ALTER TABLE urls ADD CONSTRAINT urls_long_url_len CHECK (char_length(long_url) <= 2048);
  END IF;
END $$;
