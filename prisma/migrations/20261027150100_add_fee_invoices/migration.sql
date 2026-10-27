-- Fee management was previously served from an in-process JSON file, which
-- meant the ledger disappeared on redeploy and was different on every server.
-- These are the real, tenant-scoped rows.

CREATE TYPE "FeeStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE');

CREATE TABLE "fee_invoices" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "invoice_no" VARCHAR(40) NOT NULL,
  "term" VARCHAR(50) NOT NULL,
  "fee_type" VARCHAR(50) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "due_date" DATE NOT NULL,
  "status" "FeeStatus" NOT NULL DEFAULT 'PENDING',
  "paid_at" TIMESTAMP(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "fee_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fee_invoices_tenant_id_id_key"
  ON "fee_invoices"("tenant_id", "id");
CREATE UNIQUE INDEX "fee_invoices_tenant_id_invoice_no_key"
  ON "fee_invoices"("tenant_id", "invoice_no");
CREATE INDEX "fee_invoices_tenant_id_student_id_idx"
  ON "fee_invoices"("tenant_id", "student_id");
CREATE INDEX "fee_invoices_tenant_id_status_idx"
  ON "fee_invoices"("tenant_id", "status");
CREATE INDEX "fee_invoices_tenant_id_due_date_idx"
  ON "fee_invoices"("tenant_id", "due_date");

ALTER TABLE "fee_invoices"
  ADD CONSTRAINT "fee_invoices_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_invoices"
  ADD CONSTRAINT "fee_invoices_tenant_id_student_id_fkey"
  FOREIGN KEY ("tenant_id", "student_id") REFERENCES "students"("tenant_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Every tenant-scoped table carries the isolation policy. A new table without
-- it would silently become readable across schools.
DO $$
BEGIN
  EXECUTE 'ALTER TABLE "fee_invoices" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "fee_invoices" FORCE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY tenant_isolation ON "fee_invoices"
    USING (
      tenant_id =
      NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid
    )
    WITH CHECK (
      tenant_id =
      NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid
    )';
END;
$$;
