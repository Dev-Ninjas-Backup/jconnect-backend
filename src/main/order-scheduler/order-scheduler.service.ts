import { OrdersService } from "@main/order/order.service";
import { PaymentService } from "@main/payments/payments.service";
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { OrderStatus } from "@prisma/client";
import { PrismaService } from "src/lib/prisma/prisma.service";

@Injectable()
export class OrderSchedulerService {
    private readonly logger = new Logger(OrderSchedulerService.name);

    constructor(
        private prisma: PrismaService,
        private ordersService: OrdersService,
        private paymentService: PaymentService,
    ) {}

    // ─────────── Auto-cancel + refund orders the seller never accepted within 24h ───────────
    @Cron(CronExpression.EVERY_MINUTE)
    async handleAcceptanceExpiry() {
        const now = new Date();

        const expired = await this.prisma.order.findMany({
            where: {
                status: OrderStatus.PENDING,
                paymentIntentId: { not: null },
                acceptDeadline: { lte: now },
            },
            select: { id: true, orderCode: true },
        });

        for (const order of expired) {
            try {
                await this.ordersService.autoCancelUnacceptedOrder(order.id);
                this.logger.log(
                    `Auto-cancelled unaccepted order ${order.orderCode} (${order.id}) — seller missed the 24h acceptance window`,
                );
            } catch (err: any) {
                this.logger.error(
                    `Auto-cancel failed for order ${order.orderCode} (${order.id}): ${err.message}`,
                );
            }
        }
    }

    // ─────────── Auto-release escrow once the buyer's 24h proof-review window expires ───────────
    @Cron(CronExpression.EVERY_MINUTE)
    async handleProofReviewExpiry() {
        const now = new Date();

        const pendingReview = await this.prisma.order.findMany({
            where: {
                status: OrderStatus.PROOF_SUBMITTED,
                proofReviewDeadline: { lte: now },
                isReleased: false,
            },
            select: { id: true, orderCode: true, isCancelRequested: true },
        });

        for (const order of pendingReview) {
            // Keep funds locked if the buyer has an open cancellation request or dispute —
            // same guard the manual release path (PATCH /orders/:id/status?status=RELEASED) uses.
            if (order.isCancelRequested) continue;
            if (await this.ordersService.hasOpenDispute(order.id)) continue;

            try {
                await this.paymentService.autoReleaseEscrow(order.id);
                this.logger.log(
                    `Auto-released escrow for order ${order.orderCode} (${order.id}) — buyer missed the 24h review window`,
                );
            } catch (err: any) {
                this.logger.error(
                    `Auto-release failed for order ${order.orderCode} (${order.id}): ${err.message}`,
                );
            }
        }
    }
}
