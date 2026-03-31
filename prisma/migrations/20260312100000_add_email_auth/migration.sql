-- AlterTable: make discord_id optional, add email and password_hash
ALTER TABLE "users" ALTER COLUMN "discord_id" DROP NOT NULL;

ALTER TABLE "users" ADD COLUMN "email" TEXT;
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
