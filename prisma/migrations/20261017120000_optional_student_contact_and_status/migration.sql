-- ==============================================================================
-- UNAPPLIED MIGRATION FOR REVIEW: Optional Student Contact and Status Fields
-- ==============================================================================
-- PRD Requirement (Functional Modules -> People & roster):
-- "Add, edit and deactivate students and teachers (name, email, phone, admission number, guardian contact)"
--
-- Currently in schema.prisma, Student table has:
-- (id, tenant_id, user_id, admission_no, first_name, last_name, date_of_birth, created_at).
-- Student status is managed via Enrolment (status: ACTIVE / WITHDRAWN) and Membership (ACTIVE / INACTIVE).
--
-- If the team decides to persist phone, guardian contact, and explicit student status directly
-- on the students table, apply this migration:
-- ==============================================================================

-- AlterTable
ALTER TABLE "students"
ADD COLUMN IF NOT EXISTS "phone" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "guardian_name" VARCHAR(150),
ADD COLUMN IF NOT EXISTS "guardian_phone" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

-- Note: RLS is already ENABLED and FORCED on the students table from migration 20261011085940_init.
-- The existing policy "tenant_isolation" automatically covers these added columns.
