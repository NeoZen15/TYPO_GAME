-- ============================================================
-- MIGRATION 003 -- users, sessions, user_typeface_state
-- JEUX DE TYPO
-- Requiert : migrations 001, 001b, 002 appliquees
-- PostgreSQL 13+
-- ============================================================

-- ============================================================
-- 1. ENUMS
-- ============================================================

CREATE TYPE app.user_role_enum AS ENUM (
  'guest',
  'player',
  'admin'
);

CREATE TYPE app.session_status_enum AS ENUM (
  'active',
  'completed',
  'abandoned',
  'invalid'
);

CREATE TYPE app.dreyfus_level_enum AS ENUM (
  'N', 'D', 'C', 'A', 'E'
);

-- ============================================================
-- 2. users
-- ============================================================

CREATE TABLE users (
  user_id               uuid                     PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id              text                     UNIQUE,
  role                  app.user_role_enum       NOT NULL DEFAULT 'guest',
  locale                text                     NOT NULL DEFAULT 'fr'
                            CHECK (locale IN ('fr', 'en')),

  -- Progression globale visible
  dreyfus_level         app.dreyfus_level_enum   NOT NULL DEFAULT 'N',
  dreyfus_sub           smallint                 NOT NULL DEFAULT 1
                            CHECK (dreyfus_sub BETWEEN 1 AND 5),

  -- Compteur global de questions, indispensable pour le scheduling
  global_q_index        int                      NOT NULL DEFAULT 0
                            CHECK (global_q_index >= 0),

  -- RGPD
  consent_analytics     boolean                  NOT NULL DEFAULT false,
  consent_at            timestamptz,
  deleted_at            timestamptz,
  anonymized_at         timestamptz,

  -- Merge invite -> compte
  merged_from_guest_id  uuid,

  created_at            timestamptz              NOT NULL DEFAULT now(),
  last_seen_at          timestamptz              NOT NULL DEFAULT now(),

  CONSTRAINT fk_users_merged_from_guest
    FOREIGN KEY (merged_from_guest_id)
    REFERENCES users (user_id)
    ON DELETE SET NULL,

  CONSTRAINT chk_consent_requires_timestamp
    CHECK (consent_analytics = false OR consent_at IS NOT NULL),

  CONSTRAINT chk_clerk_required_for_authenticated_roles
    CHECK (role NOT IN ('player', 'admin') OR clerk_id IS NOT NULL),

  CONSTRAINT chk_anonymized_after_deleted
    CHECK (anonymized_at IS NULL OR deleted_at IS NOT NULL)
);

CREATE INDEX idx_users_clerk_id
  ON users (clerk_id)
  WHERE clerk_id IS NOT NULL;

CREATE INDEX idx_users_deleted
  ON users (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ============================================================
-- 3. sessions
-- ============================================================

CREATE TABLE sessions (
  session_id            uuid                     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid                     NOT NULL
                            REFERENCES users (user_id) ON DELETE RESTRICT,
  mode                  text                     NOT NULL
                            CHECK (mode IN ('training', 'competition', 'expert')),
  status                app.session_status_enum  NOT NULL DEFAULT 'active',
  locale                text                     NOT NULL DEFAULT 'fr'
                            CHECK (locale IN ('fr', 'en')),

  -- Determinisme / version moteur
  seed                  bigint                   NOT NULL,
  engine_version        text                     NOT NULL,

  -- Progression de session
  question_count        int                      NOT NULL DEFAULT 0
                            CHECK (question_count >= 0),
  correct_count         int                      NOT NULL DEFAULT 0
                            CHECK (correct_count >= 0),
  score                 int                      NOT NULL DEFAULT 0
                            CHECK (score >= 0),

  started_global_q_index int                     NOT NULL DEFAULT 0
                            CHECK (started_global_q_index >= 0),

  started_at            timestamptz              NOT NULL DEFAULT now(),
  ended_at              timestamptz,
  duration_ms           int
                            GENERATED ALWAYS AS (
                              CASE
                                WHEN ended_at IS NOT NULL
                                THEN (EXTRACT(EPOCH FROM (ended_at - started_at)) * 1000)::int
                                ELSE NULL
                              END
                            ) STORED,

  client_fingerprint    text,
  integrity_flags       jsonb                    NOT NULL DEFAULT '[]'::jsonb,

  CONSTRAINT chk_correct_lte_total
    CHECK (correct_count <= question_count),

  CONSTRAINT chk_ended_after_started
    CHECK (ended_at IS NULL OR ended_at >= started_at),

  CONSTRAINT chk_score_only_competition
    CHECK (mode = 'competition' OR score = 0),

  CONSTRAINT chk_integrity_flags_is_array
    CHECK (jsonb_typeof(integrity_flags) = 'array')
);

CREATE INDEX idx_sessions_user
  ON sessions (user_id, started_at DESC);

CREATE INDEX idx_sessions_mode_status
  ON sessions (mode, status, started_at DESC);

CREATE INDEX idx_sessions_active
  ON sessions (user_id, status)
  WHERE status = 'active';

-- ============================================================
-- 4. user_typeface_state
-- Etat de maitrise d'une typo pour un utilisateur donne.
-- Une ligne par (user_id, typeface_slug).
-- Mis a jour par le moteur pedagogique. Le mode competition
-- n'applique pas de progression long terme.
-- ============================================================

CREATE TABLE user_typeface_state (
  state_id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid        NOT NULL
                                REFERENCES users (user_id) ON DELETE RESTRICT,
  typeface_slug               text        NOT NULL
                                REFERENCES typefaces_core (typeface_slug) ON DELETE RESTRICT,

  -- Repetition espacee
  mastery_level               smallint    NOT NULL DEFAULT 0
                                CHECK (mastery_level BETWEEN 0 AND 4),
  next_due_after_q            int         NOT NULL DEFAULT 0
                                CHECK (next_due_after_q >= 0),
  last_shown_at_q             int
                                CHECK (last_shown_at_q IS NULL OR last_shown_at_q >= 0),
  interval_questions          int         NOT NULL DEFAULT 0
                                CHECK (interval_questions >= 0),
  paused_until_q              int
                                CHECK (paused_until_q IS NULL OR paused_until_q >= 0),

  -- Historique global
  total_seen                  int         NOT NULL DEFAULT 0
                                CHECK (total_seen >= 0),
  total_correct               int         NOT NULL DEFAULT 0
                                CHECK (total_correct >= 0),
  total_wrong                 int         NOT NULL DEFAULT 0
                                CHECK (total_wrong >= 0),
  consecutive_correct         smallint    NOT NULL DEFAULT 0
                                CHECK (consecutive_correct >= 0),

  -- Etat de session pour Misread / retry
  session_errors              smallint    NOT NULL DEFAULT 0
                                CHECK (session_errors >= 0),
  consecutive_session_errors  smallint    NOT NULL DEFAULT 0
                                CHECK (consecutive_session_errors >= 0),

  -- Coefficient adaptatif
  adaptive_coef               double precision NOT NULL DEFAULT 1.0
                                CHECK (adaptive_coef BETWEEN 0.5 AND 2.0),

  -- Pool actif
  in_active_pool              boolean     NOT NULL DEFAULT false,
  unlocked_at                 timestamptz,

  first_seen_at               timestamptz,
  last_seen_at                timestamptz,
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_user_typeface
    UNIQUE (user_id, typeface_slug),

  CONSTRAINT chk_correct_lte_seen
    CHECK (total_correct <= total_seen),

  CONSTRAINT chk_wrong_lte_seen
    CHECK (total_wrong <= total_seen),

  CONSTRAINT chk_unlocked_requires_pool
    CHECK (unlocked_at IS NULL OR in_active_pool = true)
);

CREATE INDEX idx_uts_pool_due
  ON user_typeface_state (user_id, in_active_pool, next_due_after_q, mastery_level)
  WHERE in_active_pool = true;

CREATE INDEX idx_uts_mastery
  ON user_typeface_state (user_id, mastery_level, updated_at DESC);

-- ============================================================
-- 5. Fonction utilitaire -- initialiser le pool actif
-- Appellee lors de la premiere session d'un utilisateur.
-- Selection deterministe, interleaving par categorie pour
-- favoriser une diversite minimale.
-- ============================================================

CREATE OR REPLACE FUNCTION init_user_pool(p_user_id uuid)
RETURNS int
LANGUAGE plpgsql AS $$
DECLARE
  v_count int := 0;
  v_rows  int := 0;
  v_slug  text;
BEGIN
  FOR v_slug IN
    WITH ranked AS (
      SELECT
        typeface_slug,
        primary_category,
        difficulty_base,
        ROW_NUMBER() OVER (
          PARTITION BY primary_category
          ORDER BY difficulty_base, typeface_slug
        ) AS category_rank
      FROM typefaces_core
      WHERE activation_status = true
        AND dreyfus_tier = 'N'
        AND rarity_tag = 'common'
    )
    SELECT typeface_slug
    FROM ranked
    ORDER BY category_rank, primary_category, difficulty_base, typeface_slug
    LIMIT 30
  LOOP
    INSERT INTO user_typeface_state (
      user_id,
      typeface_slug,
      mastery_level,
      next_due_after_q,
      interval_questions,
      in_active_pool,
      unlocked_at
    ) VALUES (
      p_user_id,
      v_slug,
      0,
      0,
      0,
      true,
      now()
    )
    ON CONFLICT (user_id, typeface_slug) DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_count := v_count + v_rows;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================
-- 6. Vue utilitaire -- etat du pool actif d'un utilisateur
-- ============================================================

CREATE VIEW v_user_pool_summary AS
  SELECT
    u.user_id,
    u.dreyfus_level,
    u.dreyfus_sub,
    u.global_q_index,
    COUNT(uts.state_id)                                   AS pool_size,
    COUNT(*) FILTER (WHERE uts.mastery_level = 4)         AS stabilized,
    COUNT(*) FILTER (WHERE uts.mastery_level = 0)         AS never_seen,
    ROUND(AVG(uts.mastery_level)::numeric, 2)             AS avg_mastery,
    MAX(uts.updated_at)                                   AS last_activity
  FROM users u
  LEFT JOIN user_typeface_state uts
         ON uts.user_id = u.user_id
        AND uts.in_active_pool = true
  WHERE u.deleted_at IS NULL
  GROUP BY u.user_id, u.dreyfus_level, u.dreyfus_sub, u.global_q_index;
