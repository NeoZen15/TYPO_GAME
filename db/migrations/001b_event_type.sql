-- ============================================================
-- MIGRATION 001b -- ajout event_type sur user_event_fact
-- JEUX DE TYPO
-- Requiert : migration 001 appliquee
-- PostgreSQL 13+
-- ============================================================

-- 1. ENUM event_type dans le schema app.
CREATE TYPE app.event_type_enum AS ENUM (
  'answer',
  'session_start',
  'session_end',
  'card_shown',
  'pool_unlocked'
);

-- 2. Ajout de la colonne event_type.
-- Valeur par defaut "answer" pour ne pas casser les lignes existantes.
ALTER TABLE user_event_fact
  ADD COLUMN event_type app.event_type_enum NOT NULL DEFAULT 'answer';

-- 3. Rendre nullable les champs qui n'ont pas de sens
-- pour tous les types d'evenements.
ALTER TABLE user_event_fact
  ALTER COLUMN question_id DROP NOT NULL,
  ALTER COLUMN typeface_slug DROP NOT NULL,
  ALTER COLUMN answer_slug DROP NOT NULL,
  ALTER COLUMN attempt_index DROP NOT NULL,
  ALTER COLUMN is_correct DROP NOT NULL,
  ALTER COLUMN response_time_ms DROP NOT NULL,
  ALTER COLUMN mastery_before DROP NOT NULL,
  ALTER COLUMN mastery_after DROP NOT NULL,
  ALTER COLUMN display_word DROP NOT NULL,
  ALTER COLUMN reason_code DROP NOT NULL,
  ALTER COLUMN seed DROP NOT NULL;

-- 4. is_retry depend de attempt_index.
-- Il doit rester false quand attempt_index est null
-- (session_start/session_end/card_shown/pool_unlocked).
ALTER TABLE user_event_fact
  DROP COLUMN is_retry;

ALTER TABLE user_event_fact
  ADD COLUMN is_retry boolean
    GENERATED ALWAYS AS (COALESCE(attempt_index > 1, false)) STORED;

-- 5. Contraintes de coherence par event_type.
ALTER TABLE user_event_fact
  ADD CONSTRAINT chk_answer_fields_required
    CHECK (
      event_type <> 'answer' OR (
        question_id IS NOT NULL AND
        typeface_slug IS NOT NULL AND
        attempt_index IS NOT NULL AND
        is_correct IS NOT NULL AND
        response_time_ms IS NOT NULL AND
        mastery_before IS NOT NULL AND
        mastery_after IS NOT NULL AND
        display_word IS NOT NULL AND
        reason_code IS NOT NULL AND
        seed IS NOT NULL
      )
    ),

  ADD CONSTRAINT chk_card_shown_fields
    CHECK (
      event_type <> 'card_shown' OR (
        typeface_slug IS NOT NULL AND
        (misread_shown = true OR reading_shown = true)
      )
    ),

  ADD CONSTRAINT chk_pool_unlocked_fields
    CHECK (
      event_type <> 'pool_unlocked' OR
      typeface_slug IS NOT NULL
    ),

  ADD CONSTRAINT chk_reason_only_on_answer
    CHECK (
      reason_code IS NULL OR event_type = 'answer'
    );

-- 6. Index event_type pour dashboard / analytics.
CREATE INDEX idx_uef_event_type
  ON user_event_fact (event_type, user_id, event_ts_utc DESC);

-- 7. Retirer le default temporaire.
ALTER TABLE user_event_fact
  ALTER COLUMN event_type DROP DEFAULT;

-- 8. Notes de coherence:
-- - answer_slug reste gouverne par chk_answer_slug de la migration 001.
--   Il peut etre null pour timeout / invalid_answer.
-- - engine_version reste obligatoire sur tous les events.
