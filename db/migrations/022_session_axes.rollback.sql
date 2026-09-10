-- Rollback de la migration 022. Les colonnes partent avec leurs contraintes et
-- leurs index. Aucune donnee de jeu n'est perdue : ces colonnes ne portent que
-- le pourquoi d'une session, pas ce qui s'y est passe.
DROP INDEX IF EXISTS idx_uef_assignment;
ALTER TABLE user_event_fact
  DROP CONSTRAINT IF EXISTS chk_fact_assignment_requires_context;
ALTER TABLE user_event_fact
  DROP COLUMN IF EXISTS assignment_id,
  DROP COLUMN IF EXISTS progression_policy,
  DROP COLUMN IF EXISTS context;

DROP INDEX IF EXISTS idx_sessions_assignment;
DROP INDEX IF EXISTS uq_sessions_one_per_assignment;
ALTER TABLE sessions
  DROP CONSTRAINT IF EXISTS chk_session_competition_never_writes_mastery,
  DROP CONSTRAINT IF EXISTS chk_session_assignment_requires_context;
ALTER TABLE sessions
  DROP COLUMN IF EXISTS assignment_id,
  DROP COLUMN IF EXISTS progression_policy,
  DROP COLUMN IF EXISTS context;

DROP TYPE IF EXISTS app.progression_policy_enum;
DROP TYPE IF EXISTS app.session_context_enum;
