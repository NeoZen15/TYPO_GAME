-- Rollback de la migration 023.
DROP TABLE IF EXISTS access_requests;
DROP TYPE IF EXISTS app.access_request_status_enum;
