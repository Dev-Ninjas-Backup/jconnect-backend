-- AlterTable
ALTER TABLE "Order" ADD COLUMN "acceptDeadline" TIMESTAMP(3),
ADD COLUMN "proofReviewDeadline" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_status_acceptDeadline_idx" ON "Order"("status", "acceptDeadline");

-- CreateIndex
CREATE INDEX "Order_status_proofReviewDeadline_idx" ON "Order"("status", "proofReviewDeadline");
