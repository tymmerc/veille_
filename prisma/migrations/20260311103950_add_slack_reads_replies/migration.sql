-- AlterTable
ALTER TABLE "users" ADD COLUMN     "slack_webhook_url" TEXT;

-- CreateTable
CREATE TABLE "article_reads" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_replies" (
    "id" TEXT NOT NULL,
    "shared_article_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "article_reads_user_id_idx" ON "article_reads"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "article_reads_user_id_article_id_key" ON "article_reads"("user_id", "article_id");

-- CreateIndex
CREATE INDEX "share_replies_shared_article_id_idx" ON "share_replies"("shared_article_id");

-- AddForeignKey
ALTER TABLE "article_reads" ADD CONSTRAINT "article_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_reads" ADD CONSTRAINT "article_reads_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_replies" ADD CONSTRAINT "share_replies_shared_article_id_fkey" FOREIGN KEY ("shared_article_id") REFERENCES "shared_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
