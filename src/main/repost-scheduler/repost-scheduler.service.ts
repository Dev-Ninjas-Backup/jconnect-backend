import { FirebaseNotificationService } from "@main/shared/notification/firebase-notification.service";
import { RepostOrderGateway } from "@main/repost-order/repost-order.gateway";
import { RepostOrderService } from "@main/repost-order/repost-order.service";
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { RepostOrderStatus } from "@prisma/client";
import { PrismaService } from "src/lib/prisma/prisma.service";

@Injectable()
export class RepostSchedulerService {
    private readonly logger = new Logger(RepostSchedulerService.name);

    constructor(
        private prisma: PrismaService,
        private notifications: FirebaseNotificationService,
        private repostOrderService: RepostOrderService,
        private gateway: RepostOrderGateway,
    ) {}

    // ─────────── Countdown alerts + expiry ───────────
    @Cron(CronExpression.EVERY_MINUTE)
    async handleCountdownAlerts() {
        const now = new Date();

        const activeOrders = await this.prisma.repostOrder.findMany({
            where: {
                status: {
                    in: [
                        RepostOrderStatus.NEW_REQUEST,
                        RepostOrderStatus.ACCEPTED,
                        RepostOrderStatus.IN_PROGRESS,
                    ],
                },
                isReleased: false,
            },
            include: { seller: { select: { id: true, username: true } } },
        });

        for (const order of activeOrders) {
            const msLeft = order.countdownEndsAt.getTime() - now.getTime();
            const minLeft = Math.floor(msLeft / 60000);

            if (minLeft <= 60 && minLeft > 59 && !order.alert60Sent) {
                await this.sendCountdownAlert(order, 60);
                await this.prisma.repostOrder.update({
                    where: { id: order.id },
                    data: { alert60Sent: true },
                });
            }
            if (minLeft <= 30 && minLeft > 29 && !order.alert30Sent) {
                await this.sendCountdownAlert(order, 30);
                await this.prisma.repostOrder.update({
                    where: { id: order.id },
                    data: { alert30Sent: true },
                });
            }
            if (minLeft <= 15 && minLeft > 14 && !order.alert15Sent) {
                await this.sendCountdownAlert(order, 15);
                await this.prisma.repostOrder.update({
                    where: { id: order.id },
                    data: { alert15Sent: true },
                });
            }
            if (minLeft <= 5 && minLeft > 4 && !order.alert5Sent) {
                await this.sendCountdownAlert(order, 5);
                await this.prisma.repostOrder.update({
                    where: { id: order.id },
                    data: { alert5Sent: true },
                });
            }

            if (msLeft <= 0) {
                this.logger.warn(`Order ${order.id} countdown expired — marking REFUNDED`);
                await this.prisma.repostOrder.update({
                    where: { id: order.id },
                    data: { status: RepostOrderStatus.REFUNDED },
                });
                await Promise.all([
                    this.notifications.sendToUser(order.buyerId, {
                        title: "Order Expired",
                        body: "The seller did not submit proof in time. Your refund is being processed.",
                        type: "ESCROW_REFUND_ISSUED" as any,
                        data: { orderId: order.id },
                    }),
                    this.notifications.sendToUser(order.sellerId, {
                        title: "Order Expired",
                        body: "You missed the proof deadline. The order has been refunded to the buyer.",
                        type: "ESCROW_REFUND_PROCESSED" as any,
                        data: { orderId: order.id },
                    }),
                ]);

                this.gateway.emitOrderRefunded({ ...order, status: RepostOrderStatus.REFUNDED });
            }
        }
    }

    // ─────────── Auto-release escrow after 1-hr review window ───────────
    @Cron(CronExpression.EVERY_MINUTE)
    async handleAutoRelease() {
        const now = new Date();

        const pendingReview = await this.prisma.repostOrder.findMany({
            where: {
                status: RepostOrderStatus.PROOF_SUBMITTED,
                reviewWindowEndsAt: { lte: now },
                isReleased: false,
            },
        });

        for (const order of pendingReview) {
            this.logger.log(`Auto-releasing escrow for order ${order.id}`);
            try {
                await this.repostOrderService.releaseEscrow(order.id, order, "auto_release");
                // emitOrderCompleted is called inside releaseEscrow — no duplicate emit needed
            } catch (err) {
                this.logger.error(`Auto-release failed for ${order.id}: ${err.message}`);
            }
        }
    }

    // ─────────── Auto-refund if seller misses redo window ───────────
    @Cron(CronExpression.EVERY_MINUTE)
    async handleRedoExpiry() {
        const now = new Date();

        const expiredRedos = await this.prisma.repostOrder.findMany({
            where: {
                status: RepostOrderStatus.REDO_REQUESTED,
                redoWindowEndsAt: { lte: now },
                isReleased: false,
            },
        });

        for (const order of expiredRedos) {
            this.logger.warn(`Redo window expired for order ${order.id} — marking REFUNDED`);
            await this.prisma.repostOrder.update({
                where: { id: order.id },
                data: { status: RepostOrderStatus.REFUNDED },
            });
            await this.notifications.sendToUser(order.buyerId, {
                title: "Redo Expired",
                body: "The seller did not submit revised proof. Your refund is being processed.",
                type: "ESCROW_REFUND_ISSUED" as any,
                data: { orderId: order.id },
            });

            this.gateway.emitOrderRefunded({ ...order, status: RepostOrderStatus.REFUNDED });
        }
    }

    // ─────────── Helper ───────────
    private async sendCountdownAlert(order: any, minutes: number) {
        await this.notifications.sendToUser(order.sellerId, {
            title: `${minutes} Minutes Remaining`,
            body: `Your repost request expires in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
            type: "REPOST_EXPIRING_SOON" as any,
            data: { orderId: order.id, minutesLeft: String(minutes) },
        });
        this.gateway.emitCountdownAlert(order, minutes);
        this.logger.log(`Sent ${minutes}-min alert for order ${order.id}`);
    }
}
