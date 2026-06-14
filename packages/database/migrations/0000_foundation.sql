-- =============================================================================
-- 0000 - Foundation: Extensions, Schemas, and Shared Functions
-- =============================================================================
-- This migration is idempotent and safe to run on any PostgreSQL instance.
-- It sets up everything that init.sql would normally provide when using
-- the official Docker Postgres image with a custom init script.
-- =============================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Audit schema (separate from public for clearer permission boundary)
CREATE SCHEMA IF NOT EXISTS audit;

-- Audit immutability trigger function (used by migration 0003)
CREATE OR REPLACE FUNCTION public.titan_audit_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs are append-only and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;
