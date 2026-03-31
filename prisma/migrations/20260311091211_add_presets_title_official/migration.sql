-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "is_official" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "title_original" TEXT;

-- CreateTable
CREATE TABLE "presets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categories" JSONB NOT NULL,
    "keywords" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "presets_user_id_idx" ON "presets"("user_id");

-- AddForeignKey
ALTER TABLE "presets" ADD CONSTRAINT "presets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
