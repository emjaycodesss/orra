-- Verifiable reading draws (mirrors chain + local enrichment; optional server sync).
-- PostgreSQL 14+. Run after 001.

CREATE TABLE IF NOT EXISTS orra_readings (
  id TEXT PRIMARY KEY,
  chain_id INTEGER NOT NULL DEFAULT 84532,
  wallet_address TEXT NOT NULL,
  sequence_number NUMERIC NOT NULL,
  card_index SMALLINT NOT NULL,
  is_reversed BOOLEAN NOT NULL,
  feed_id INTEGER NOT NULL,
  oracle_snapshot_hash TEXT NOT NULL,
  random_number TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  block_timestamp TIMESTAMPTZ,
  callback_tx_hash TEXT NOT NULL,
  request_tx_hash TEXT,
  realm TEXT,
  stance TEXT,
  timeframe TEXT,
  truth TEXT,
  interpretation TEXT,
  raw_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chain_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_orra_readings_wallet ON orra_readings (wallet_address);
CREATE INDEX IF NOT EXISTS idx_orra_readings_created ON orra_readings (created_at DESC);
