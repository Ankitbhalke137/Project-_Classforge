-- Allow a user to hold multiple roles in the same school (e.g. both TEACHER
-- and SCHOOL_ADMIN) by including role in the membership primary key.
-- A user can also belong to many schools (one membership row per school).
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_pkey";
ALTER TABLE "memberships" ADD PRIMARY KEY ("tenant_id", "user_id", "role");
