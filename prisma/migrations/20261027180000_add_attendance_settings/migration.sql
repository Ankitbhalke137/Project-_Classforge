-- Add attendance settings table for per-school attendance policy preferences.
CREATE TABLE "attendance_settings" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "allow_teacher_edit" BOOLEAN NOT NULL DEFAULT true,
  "require_parent_note_for_excused" BOOLEAN NOT NULL DEFAULT false,
  "late_threshold_minutes" INTEGER NOT NULL DEFAULT 15,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "attendance_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_settings_tenant_id_key"
  ON "attendance_settings"("tenant_id");

ALTER TABLE "attendance_settings"
  ADD CONSTRAINT "attendance_settings_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS and tenant isolation policy.
ALTER TABLE "attendance_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_settings" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "attendance_settings"
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );
