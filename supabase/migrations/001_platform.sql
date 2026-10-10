-- NEW isolated PostgreSQL/Supabase project only. Run as the migration owner.
-- Runtime intentionally uses a serialized aggregate for the first single-studio release.
-- Database exclusion and uniqueness constraints defend allocation/ledger invariants.
BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
CREATE TABLE app_private.platform_state (id boolean PRIMARY KEY DEFAULT true CHECK(id), payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'));
CREATE TABLE app_private.allocations (
  id uuid PRIMARY KEY, customer_id text NOT NULL, retry_key text NOT NULL,
  bay integer NOT NULL CHECK(bay BETWEEN 1 AND 20), occupied tstzrange NOT NULL CHECK(NOT isempty(occupied)),
  active boolean NOT NULL, UNIQUE(customer_id,retry_key),
  EXCLUDE USING gist (bay WITH =, occupied WITH &&) WHERE(active)
);
CREATE TABLE app_private.entitlement_ledger (reference text PRIMARY KEY, package_id uuid NOT NULL, units integer NOT NULL CHECK(units<>0));
ALTER TABLE app_private.platform_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.entitlement_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA app_private FROM PUBLIC, anon, authenticated;
-- DATABASE_URL must be a server-only role with rights to app_private.
-- Do not expose this schema via PostgREST or grant client roles access.
COMMIT;
