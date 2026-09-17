-- AlterTable
ALTER TABLE "Order" ADD COLUMN "proofSubmitDeadline" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_status_proofSubmitDeadline_idx" ON "Order"("status", "proofSubmitDeadline");
