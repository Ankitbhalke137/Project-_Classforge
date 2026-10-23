-- Academic structure: the class screen showed a room, a capacity and a homeroom
-- teacher that had no columns, and the timetable had no table at all.

ALTER TABLE "classes"
  ADD COLUMN IF NOT EXISTS "room" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "capacity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "homeroom_teacher_id" UUID;

CREATE TABLE "timetable_slots" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "section_id" UUID NOT NULL,
  "subject_id" UUID NOT NULL,
  "teacher_id" UUID NOT NULL,
  "day" VARCHAR(12) NOT NULL,
  "period" INTEGER NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "timetable_slots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "timetable_slots_tenant_id_section_id_day_period_key"
  ON "timetable_slots"("tenant_id", "section_id", "day", "period");
CREATE INDEX "timetable_slots_tenant_id_section_id_idx"
  ON "timetable_slots"("tenant_id", "section_id");
CREATE INDEX "timetable_slots_tenant_id_teacher_id_idx"
  ON "timetable_slots"("tenant_id", "teacher_id");

ALTER TABLE "timetable_slots"
  ADD CONSTRAINT "timetable_slots_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timetable_slots"
  ADD CONSTRAINT "timetable_slots_section_id_fkey"
  FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timetable_slots"
  ADD CONSTRAINT "timetable_slots_subject_id_fkey"
  FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timetable_slots"
  ADD CONSTRAINT "timetable_slots_teacher_id_fkey"
  FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Close the RLS gap flagged in the audit: these tables have tenant_id but were
-- never covered by the isolation policy.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'academic_terms',
    'timetable_periods',
    'notification_preferences',
    'timetable_slots'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);

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
