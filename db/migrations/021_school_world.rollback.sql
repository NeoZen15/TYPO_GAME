-- Rollback de la migration 021. A jouer APRES le rollback 022, qui reference
-- assignments.
DROP TABLE IF EXISTS assignment_recipients;
DROP TABLE IF EXISTS assignment_targets;
DROP TABLE IF EXISTS assignments;
DROP TABLE IF EXISTS invitations;
DROP TABLE IF EXISTS class_members;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS school_members;
DROP TABLE IF EXISTS schools;
DROP TYPE IF EXISTS app.assignment_state_enum;
DROP TYPE IF EXISTS app.exigence_enum;
DROP TYPE IF EXISTS app.assignment_kind_enum;
DROP TYPE IF EXISTS app.invitation_status_enum;
DROP TYPE IF EXISTS app.school_role_enum;
