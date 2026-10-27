-- School contact details shown on the settings page. They were previously kept
-- only in the browser, so one admin's edits were invisible to everyone else.
ALTER TABLE "tenants"
  ADD COLUMN "contact_email" VARCHAR(254),
  ADD COLUMN "contact_phone" VARCHAR(50),
  ADD COLUMN "address" VARCHAR(300);
