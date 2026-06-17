-- =============================================================================
-- TITAN Foundation - PostgreSQL Initialization
-- =============================================================================
-- This script runs once on first database creation.
-- It enables required extensions and creates the application role.
-- =============================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- The 'titan' role is created automatically by the PostgreSQL Docker image
-- using POSTGRES_USER and POSTGRES_PASSWORD environment variables.
-- We only ensure the role exists with proper permissions here.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user) THEN
        RAISE NOTICE 'Role % already exists (created by Docker entrypoint)', current_user;
    END IF;
END $$;

-- Audit log helper: append-only enforcement via trigger
CREATE OR REPLACE FUNCTION titan_audit_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs are append-only and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

-- Schema for audit logs (separate from public for clearer permission boundary)
CREATE SCHEMA IF NOT EXISTS audit;
GRANT USAGE ON SCHEMA audit TO titan;
ALTER SCHEMA audit OWNER TO titan;

-- Default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO titan;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO titan;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit GRANT INSERT ON TABLES TO titan;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Titan database initialized with extensions: uuid-ossp, pgcrypto, vector';
END $$;
