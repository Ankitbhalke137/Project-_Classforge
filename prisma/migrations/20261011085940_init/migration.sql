-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('SCHOOL_ADMIN', 'TEACHER', 'STUDENT');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AcademicYearStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EnrolmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'TRANSFERRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platform_role" "PlatformRole",

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("tenant_id","user_id")
);

-- CreateTable
CREATE TABLE "academic_years" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "AcademicYearStatus" NOT NULL DEFAULT 'UPCOMING',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(30),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "admission_no" VARCHAR(50) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "date_of_birth" DATE,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "employee_no" VARCHAR(50),
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrolments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "status" "EnrolmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolled_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrolments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teaching_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teaching_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "attendance_date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "marked_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "exam_date" DATE NOT NULL,
    "max_marks" INTEGER NOT NULL,
    "status" "ExamStatus" NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "exam_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "score" DECIMAL(7,2) NOT NULL,
    "graded_by" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "marks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "section_id" UUID,
    "created_by" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "published_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "memberships_user_id_status_idx" ON "memberships"("user_id", "status");

-- CreateIndex
CREATE INDEX "academic_years_tenant_id_status_idx" ON "academic_years"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_tenant_id_id_key" ON "academic_years"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_tenant_id_name_key" ON "academic_years"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "classes_tenant_id_academic_year_id_idx" ON "classes"("tenant_id", "academic_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "classes_tenant_id_id_key" ON "classes"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "classes_tenant_id_academic_year_id_name_key" ON "classes"("tenant_id", "academic_year_id", "name");

-- CreateIndex
CREATE INDEX "sections_tenant_id_class_id_idx" ON "sections"("tenant_id", "class_id");

-- CreateIndex
CREATE UNIQUE INDEX "sections_tenant_id_id_key" ON "sections"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "sections_tenant_id_class_id_name_key" ON "sections"("tenant_id", "class_id", "name");

-- CreateIndex
CREATE INDEX "subjects_tenant_id_class_id_idx" ON "subjects"("tenant_id", "class_id");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_tenant_id_id_key" ON "subjects"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_tenant_id_class_id_name_key" ON "subjects"("tenant_id", "class_id", "name");

-- CreateIndex
CREATE INDEX "students_tenant_id_last_name_idx" ON "students"("tenant_id", "last_name");

-- CreateIndex
CREATE UNIQUE INDEX "students_tenant_id_id_key" ON "students"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "students_tenant_id_admission_no_key" ON "students"("tenant_id", "admission_no");

-- CreateIndex
CREATE UNIQUE INDEX "students_tenant_id_user_id_key" ON "students"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "teachers_tenant_id_last_name_idx" ON "teachers"("tenant_id", "last_name");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_tenant_id_id_key" ON "teachers"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_tenant_id_user_id_key" ON "teachers"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_tenant_id_employee_no_key" ON "teachers"("tenant_id", "employee_no");

-- CreateIndex
CREATE INDEX "enrolments_tenant_id_student_id_idx" ON "enrolments"("tenant_id", "student_id");

-- CreateIndex
CREATE INDEX "enrolments_tenant_id_section_id_academic_year_id_idx" ON "enrolments"("tenant_id", "section_id", "academic_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrolments_tenant_id_id_key" ON "enrolments"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "teaching_assignments_tenant_id_section_id_idx" ON "teaching_assignments"("tenant_id", "section_id");

-- CreateIndex
CREATE INDEX "teaching_assignments_tenant_id_teacher_id_idx" ON "teaching_assignments"("tenant_id", "teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "teaching_assignments_tenant_id_id_key" ON "teaching_assignments"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "teaching_assignments_tenant_id_teacher_id_section_id_subjec_key" ON "teaching_assignments"("tenant_id", "teacher_id", "section_id", "subject_id");

-- CreateIndex
CREATE INDEX "attendance_records_tenant_id_student_id_attendance_date_idx" ON "attendance_records"("tenant_id", "student_id", "attendance_date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_tenant_id_id_key" ON "attendance_records"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_tenant_id_section_id_student_id_attendan_key" ON "attendance_records"("tenant_id", "section_id", "student_id", "attendance_date");

-- CreateIndex
CREATE INDEX "exams_tenant_id_section_id_exam_date_idx" ON "exams"("tenant_id", "section_id", "exam_date");

-- CreateIndex
CREATE INDEX "exams_tenant_id_subject_id_idx" ON "exams"("tenant_id", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "exams_tenant_id_id_key" ON "exams"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "marks_tenant_id_student_id_idx" ON "marks"("tenant_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "marks_tenant_id_id_key" ON "marks"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "marks_tenant_id_exam_id_student_id_key" ON "marks"("tenant_id", "exam_id", "student_id");

-- CreateIndex
CREATE INDEX "announcements_tenant_id_published_at_idx" ON "announcements"("tenant_id", "published_at");

-- CreateIndex
CREATE INDEX "announcements_tenant_id_section_id_idx" ON "announcements"("tenant_id", "section_id");

-- CreateIndex
CREATE UNIQUE INDEX "announcements_tenant_id_id_key" ON "announcements"("tenant_id", "id");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_tenant_id_academic_year_id_fkey" FOREIGN KEY ("tenant_id", "academic_year_id") REFERENCES "academic_years"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_tenant_id_class_id_fkey" FOREIGN KEY ("tenant_id", "class_id") REFERENCES "classes"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_tenant_id_class_id_fkey" FOREIGN KEY ("tenant_id", "class_id") REFERENCES "classes"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_tenant_id_student_id_fkey" FOREIGN KEY ("tenant_id", "student_id") REFERENCES "students"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_tenant_id_section_id_fkey" FOREIGN KEY ("tenant_id", "section_id") REFERENCES "sections"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_tenant_id_academic_year_id_fkey" FOREIGN KEY ("tenant_id", "academic_year_id") REFERENCES "academic_years"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_tenant_id_teacher_id_fkey" FOREIGN KEY ("tenant_id", "teacher_id") REFERENCES "teachers"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_tenant_id_section_id_fkey" FOREIGN KEY ("tenant_id", "section_id") REFERENCES "sections"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_tenant_id_subject_id_fkey" FOREIGN KEY ("tenant_id", "subject_id") REFERENCES "subjects"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenant_id_student_id_fkey" FOREIGN KEY ("tenant_id", "student_id") REFERENCES "students"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenant_id_section_id_fkey" FOREIGN KEY ("tenant_id", "section_id") REFERENCES "sections"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_marked_by_fkey" FOREIGN KEY ("marked_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_tenant_id_subject_id_fkey" FOREIGN KEY ("tenant_id", "subject_id") REFERENCES "subjects"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_tenant_id_section_id_fkey" FOREIGN KEY ("tenant_id", "section_id") REFERENCES "sections"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks" ADD CONSTRAINT "marks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks" ADD CONSTRAINT "marks_tenant_id_exam_id_fkey" FOREIGN KEY ("tenant_id", "exam_id") REFERENCES "exams"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks" ADD CONSTRAINT "marks_tenant_id_student_id_fkey" FOREIGN KEY ("tenant_id", "student_id") REFERENCES "students"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks" ADD CONSTRAINT "marks_graded_by_fkey" FOREIGN KEY ("graded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_tenant_id_section_id_fkey" FOREIGN KEY ("tenant_id", "section_id") REFERENCES "sections"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Business-rule constraints
ALTER TABLE "academic_years"
ADD CONSTRAINT "academic_years_valid_dates"
CHECK ("end_date" >= "start_date");

ALTER TABLE "exams"
ADD CONSTRAINT "exams_positive_max_marks"
CHECK ("max_marks" > 0);

ALTER TABLE "marks"
ADD CONSTRAINT "marks_non_negative_score"
CHECK ("score" >= 0);

-- Enforce score <= the exam's maximum marks.
CREATE FUNCTION check_mark_score_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  exam_max_marks INTEGER;
BEGIN
  SELECT "max_marks"
  INTO exam_max_marks
  FROM "exams"
  WHERE "id" = NEW."exam_id"
    AND "tenant_id" = NEW."tenant_id";

  IF NEW."score" > exam_max_marks THEN
    RAISE EXCEPTION 'Score cannot exceed exam maximum marks';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "marks_score_limit_trigger"
BEFORE INSERT OR UPDATE OF "score", "exam_id", "tenant_id"
ON "marks"
FOR EACH ROW
EXECUTE FUNCTION check_mark_score_limit();

-- Enable and force Row-Level Security on every tenant-scoped table.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'memberships',
    'academic_years',
    'classes',
    'sections',
    'subjects',
    'students',
    'teachers',
    'enrolments',
    'teaching_assignments',
    'attendance_records',
    'exams',
    'marks',
    'announcements'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ENABLE ROW LEVEL SECURITY',
      table_name
    );

    EXECUTE format(
      'ALTER TABLE %I FORCE ROW LEVEL SECURITY',
      table_name
    );

    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
       USING (
         tenant_id =
         NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid
       )
       WITH CHECK (
         tenant_id =
         NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid
       )',
      table_name
    );
  END LOOP;
END;
$$;


-- Prevent lowering exam maximum below already-recorded marks.
CREATE FUNCTION check_exam_max_marks_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."max_marks" < OLD."max_marks"
     AND EXISTS (
       SELECT 1
       FROM "marks"
       WHERE "tenant_id" = NEW."tenant_id"
         AND "exam_id" = NEW."id"
         AND "score" > NEW."max_marks"
     )
  THEN
    RAISE EXCEPTION
      'Cannot lower maximum marks below existing student scores';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "exam_max_marks_update_trigger"
BEFORE UPDATE OF "max_marks"
ON "exams"
FOR EACH ROW
EXECUTE FUNCTION check_exam_max_marks_update();
