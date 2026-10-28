-- Add missing composite index for membership lookups by tenant + role
-- Used by school admin roster and role-based access checks.
CREATE INDEX IF NOT EXISTS "memberships_tenant_id_role_idx"
  ON "memberships"("tenant_id", "role");
