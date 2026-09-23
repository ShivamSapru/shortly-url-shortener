CREATE TABLE IF NOT EXISTS urls (
  id            BIGSERIAL PRIMARY KEY,
  short_code    VARCHAR(16) NOT NULL UNIQUE,
  long_url      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clicks (
  id            BIGSERIAL PRIMARY KEY,
  url_id        BIGINT NOT NULL REFERENCES urls (id) ON DELETE CASCADE,
  clicked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  referrer      TEXT,
  user_agent    TEXT
);
