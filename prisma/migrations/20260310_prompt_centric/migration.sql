-- Add prompt-centric columns to users
ALTER TABLE "users" ADD COLUMN "prompt" TEXT;
ALTER TABLE "users" ADD COLUMN "prompt_config" JSONB;
ALTER TABLE "users" ADD COLUMN "scoring_notes" TEXT;
ALTER TABLE "users" ADD COLUMN "min_score" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "users" ADD COLUMN "notify_enabled" BOOLEAN NOT NULL DEFAULT true;

-- Drop old columns
ALTER TABLE "users" DROP COLUMN "preferences";
ALTER TABLE "users" DROP COLUMN "bio";
ALTER TABLE "users" DROP COLUMN "is_public";

-- Drop social tables
DROP TABLE "shares" CASCADE;
DROP TABLE "follows" CASCADE;
DROP TABLE "user_sources" CASCADE;

-- Create notification_logs
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "article_count" INTEGER NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notification_logs_user_id_sent_at_idx" ON "notification_logs"("user_id", "sent_at");
