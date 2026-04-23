-- AlterTable
ALTER TABLE "users" ADD COLUMN     "hashTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
