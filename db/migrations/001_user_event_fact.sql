-- ============================================================
-- MIGRATION 001 — user_event_fact
-- JEUX DE TYPO — append-only event log
-- PostgreSQL 13+
-- ============================================================

-- Extensions and schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS app;

-- 1) Idempotency guard table.
-- Duplicate/invalid requests are tracked here (not in user_event_fact).
CREATE TABLE event_ingestion_guard (
  idempotency_key       text        NOT NULL,
  user_id               uuid        NOT NULL,
  session_id            uuid        NOT NULL,
  received_at_utc       timestamptz NOT NULL DEFAULT now(),
  ingestion_status      text        NOT NULL
                          CHECK (ingestion_status IN ('accepted', 'duplicate', 'invalid')),
  duplicate_of_event_id uuid,
  rejection_reason      text,
  PRIMARY KEY (user_id, session_id, idempotency_key)
);

CREATE INDEX idx_eig_received_at
  ON event_ingestion_guard (received_at_utc DESC);

-- 2) Enum reason_code (fixed set, no free text).
CREATE TYPE app.reason_code_enum AS ENUM (
  'correct_first_try',
  'correct_after_retry',
  'wrong_first_try',
  'wrong_retry',
  'timeout',
  'invalid_answer'
);

-- 3) Fact table partitioned by month.
CREATE TABLE user_event_fact (
  event_id            uuid                 NOT NULL DEFAULT gen_random_uuid(),
  idempotency_key     text                 NOT NULL,
  event_ts_utc        timestamptz          NOT NULL DEFAULT now(),
  ingested_at_utc     timestamptz          NOT NULL DEFAULT now(),

  user_id             uuid                 NOT NULL,
  session_id          uuid                 NOT NULL,
  mode                text                 NOT NULL
                            CHECK (mode IN ('training', 'competition', 'expert')),

  global_q_index      int                  NOT NULL CHECK (global_q_index >= 0),
  question_id         uuid                 NOT NULL,
  attempt_index       int                  NOT NULL CHECK (attempt_index >= 1),

  typeface_slug       text                 NOT NULL,
  answer_slug         text,

  is_correct          boolean              NOT NULL,
  is_retry            boolean              NOT NULL
                            GENERATED ALWAYS AS (attempt_index > 1) STORED,

  response_time_ms    int                  NOT NULL CHECK (response_time_ms >= 0),
  mastery_before      smallint             NOT NULL CHECK (mastery_before BETWEEN 0 AND 4),
  mastery_after       smallint             NOT NULL CHECK (mastery_after BETWEEN 0 AND 4),

  misread_shown       boolean              NOT NULL DEFAULT false,
  reading_shown       boolean              NOT NULL DEFAULT false,

  display_word        text                 NOT NULL,
  reason_code         app.reason_code_enum NOT NULL,
  seed                bigint               NOT NULL,
  engine_version      text                 NOT NULL,

  CONSTRAINT chk_answer_slug CHECK (
    (reason_code IN ('timeout', 'invalid_answer') AND answer_slug IS NULL)
    OR
    (reason_code NOT IN ('timeout', 'invalid_answer') AND answer_slug IS NOT NULL)
  ),

  CONSTRAINT chk_reason_coherence CHECK (
    (reason_code = 'correct_first_try'   AND attempt_index = 1 AND is_correct = true)  OR
    (reason_code = 'correct_after_retry' AND attempt_index > 1 AND is_correct = true)  OR
    (reason_code = 'wrong_first_try'     AND attempt_index = 1 AND is_correct = false) OR
    (reason_code = 'wrong_retry'         AND attempt_index > 1 AND is_correct = false) OR
    (reason_code = 'timeout'             AND is_correct = false) OR
    (reason_code = 'invalid_answer'      AND is_correct = false)
  )
) PARTITION BY RANGE (event_ts_utc);

-- 4) Indexes.
-- Unique index on partitioned table must include partition key.
CREATE UNIQUE INDEX uq_event_id
  ON user_event_fact (event_id, event_ts_utc);

CREATE INDEX idx_uef_user_time
  ON user_event_fact (user_id, event_ts_utc DESC);

CREATE INDEX idx_uef_session
  ON user_event_fact (session_id, global_q_index);

CREATE INDEX idx_uef_typeface
  ON user_event_fact (typeface_slug, event_ts_utc DESC);

CREATE INDEX idx_uef_mode_user
  ON user_event_fact (mode, user_id, event_ts_utc DESC);

-- 5) Monthly partitions.
CREATE TABLE uef_2026_03 PARTITION OF user_event_fact
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE uef_2026_04 PARTITION OF user_event_fact
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE uef_2026_05 PARTITION OF user_event_fact
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE uef_default PARTITION OF user_event_fact DEFAULT;

-- 6) API mapping notes (non-executable):
-- attempt_index = 1 AND is_correct = true  -> correct_first_try
-- attempt_index > 1 AND is_correct = true  -> correct_after_retry
-- attempt_index = 1 AND is_correct = false -> wrong_first_try
-- attempt_index > 1 AND is_correct = false -> wrong_retry
-- response timeout                          -> timeout
-- invalid API payload                       -> invalid_answer

-- 7) Misread policy note (non-executable):
-- This field must be set by backend only, never by frontend.
