-- Add password reset token fields to the users table for the forgot-password flow.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "password_reset_token" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "password_reset_expires" TIMESTAMP(6);

CREATE INDEX IF NOT EXISTS "users_password_reset_token_idx"
  ON "users"("password_reset_token");
