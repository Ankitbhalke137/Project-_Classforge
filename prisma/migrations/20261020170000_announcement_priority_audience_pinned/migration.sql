-- The announcements screen offered priority and audience controls that had no
-- columns behind them, so every post came back as a school-wide normal notice.

CREATE TYPE "AnnouncementPriority" AS ENUM ('NORMAL', 'IMPORTANT', 'URGENT');

ALTER TABLE "announcements"
  ADD COLUMN IF NOT EXISTS "audience" TEXT[] NOT NULL DEFAULT ARRAY['EVERYONE']::TEXT[],
  ADD COLUMN IF NOT EXISTS "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS "pinned" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "announcements_tenant_id_pinned_published_at_idx"
  ON "announcements"("tenant_id", "pinned", "published_at");
