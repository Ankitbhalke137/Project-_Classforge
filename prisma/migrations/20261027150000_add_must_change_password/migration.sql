-- Accounts created with an administrator-issued temporary password must set
-- their own password before using the app. Existing accounts keep working;
-- only newly issued credentials flip the flag (see the invite/reset routes).
ALTER TABLE "users"
  ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
