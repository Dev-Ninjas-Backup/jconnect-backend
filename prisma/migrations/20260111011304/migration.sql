-- DropForeignKey
ALTER TABLE "withdrawals" DROP CONSTRAINT "withdrawals_userId_fkey";

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
