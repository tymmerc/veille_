-- Notification modes: summary on schedule and/or instant alert (06/11/2026).
-- last_notified_at already exists in production (added by the scraper): IF NOT EXISTS keeps it.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_notified_at" TIMESTAMPTZ(6);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notify_digest" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notify_instant_min" INTEGER;
