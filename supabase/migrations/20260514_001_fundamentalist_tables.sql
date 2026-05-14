-- ═══════════════════════════════════════════════════════════
-- Migration: Agente Fundamentalista — tabelas de suporte
-- Created: 2026-05-14
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════════════

-- ── 1. asset_prices ──────────────────────────────────────
-- Série histórica de preços. Nunca deletar — apenas acumular.
CREATE TABLE IF NOT EXISTS asset_prices (
  id            BIGSERIAL PRIMARY KEY,
  ticker        TEXT NOT NULL,
  isin          TEXT,
  date          DATE NOT NULL,
  close         NUMERIC(12,4) NOT NULL,
  open          NUMERIC(12,4),
  high          NUMERIC(12,4),
  low           NUMERIC(12,4),
  volume        BIGINT,
  source        TEXT,   -- 'brapi', 'yahoo', 'manual'
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, date)
);
CREATE INDEX IF NOT EXISTS idx_asset_prices_ticker_date ON asset_prices(ticker, date DESC);

-- ── 2. asset_cache ───────────────────────────────────────
-- Dados fundamentais com TTL. Um registro por (identifier, data_type, reference_period).
CREATE TABLE IF NOT EXISTS asset_cache (
  id               BIGSERIAL PRIMARY KEY,
  identifier       TEXT NOT NULL,          -- ticker ou ISIN
  data_type        TEXT NOT NULL,          -- 'dre', 'balanco', 'dfc', 'escritura', 'setor', 'noticias', 'indicadores'
  data             JSONB NOT NULL,
  source           TEXT,                   -- 'dadosdemercado', 'cvm', 'anbima', 'b3', 'web'
  reference_period TEXT,                   -- ex: '2024-Q4', '2024-anual'
  fetched_at       TIMESTAMPTZ DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL,
  UNIQUE(identifier, data_type, reference_period)
);
CREATE INDEX IF NOT EXISTS idx_asset_cache_identifier ON asset_cache(identifier, data_type);
CREATE INDEX IF NOT EXISTS idx_asset_cache_expires    ON asset_cache(expires_at);

-- ── 3. asset_memory ──────────────────────────────────────
-- Memória analítica do agente — versionada, nunca sobrescreve.
CREATE TABLE IF NOT EXISTS asset_memory (
  id                 BIGSERIAL PRIMARY KEY,
  identifier         TEXT NOT NULL,        -- ticker ou ISIN
  asset_type         TEXT NOT NULL,        -- 'equity' | 'credit'
  asset_name         TEXT,

  thesis             TEXT,
  rating             TEXT,

  key_metrics        JSONB,
  risks              JSONB,
  opportunities      JSONB,

  price_at_analysis  NUMERIC(12,4),
  analysis_version   INT DEFAULT 1,
  analyzed_at        TIMESTAMPTZ DEFAULT NOW(),
  data_period        TEXT
);
CREATE INDEX IF NOT EXISTS idx_asset_memory_identifier ON asset_memory(identifier, analyzed_at DESC);

-- ── 4. asset_track_record ────────────────────────────────
-- Previsão × realidade para avaliar qualidade das análises.
CREATE TABLE IF NOT EXISTS asset_track_record (
  id                  BIGSERIAL PRIMARY KEY,
  identifier          TEXT NOT NULL,
  asset_type          TEXT NOT NULL,

  memory_id           BIGINT REFERENCES asset_memory(id),
  prediction_rating   TEXT,
  prediction_target   NUMERIC(12,4),
  prediction_date     DATE NOT NULL,
  prediction_horizon  TEXT,               -- '3m', '6m', '12m'

  actual_price        NUMERIC(12,4),
  actual_date         DATE,
  direction_correct   BOOLEAN,
  target_hit          BOOLEAN,
  notes               TEXT,
  evaluated_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_asset_track_record_identifier ON asset_track_record(identifier, prediction_date DESC);
