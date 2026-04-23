/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable: Add username column with NULL as default first
ALTER TABLE "users" ADD COLUMN "username" TEXT;

-- Update existing users to have unique usernames based on their email
UPDATE "users" 
SET "username" = CONCAT(
  SPLIT_PART("email", '@', 1),
  '_',
  SUBSTRING("id", 1, 8)
)
WHERE "username" IS NULL;

-- Now create the unique index
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
