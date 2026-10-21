-- Exams were missing the term, pass mark and publish state the results screen
-- exposes; marks had no room for a teacher's remark.

ALTER TYPE "ExamStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';

ALTER TABLE "exams"
  ADD COLUMN IF NOT EXISTS "term" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "pass_marks" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMP(6);

ALTER TABLE "marks"
  ADD COLUMN IF NOT EXISTS "remarks" VARCHAR(300);
