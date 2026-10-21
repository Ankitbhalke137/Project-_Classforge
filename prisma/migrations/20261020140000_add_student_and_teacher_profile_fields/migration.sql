-- PRD: People & roster — "Add, edit and deactivate students and teachers
-- (name, email, phone, admission number, guardian contact)".
--
-- The roster screens had nowhere to store phone numbers or guardian details.
-- `students.status` mirrors the active enrolment so a row can report its state
-- without joining; the service keeps both in step on deactivate/reactivate.
--
-- `migrate deploy` runs as the table owner with FORCE RLS on both tables, so the
-- backfill is deliberately omitted: an UPDATE without `app.current_tenant_id`
-- would match no rows. The API derives the displayed status from the enrolment,
-- so pre-existing rows still render correctly.

ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "phone" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "guardian_name" VARCHAR(150),
  ADD COLUMN IF NOT EXISTS "guardian_phone" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "teachers"
  ADD COLUMN IF NOT EXISTS "phone" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "qualification" VARCHAR(150),
  ADD COLUMN IF NOT EXISTS "designation" VARCHAR(100);
