import { FirebaseNotificationService } from "@main/shared/notification/firebase-notification.service";
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
    ) {}

    // Runs every minute — sends countdown alerts and handles expirations
    @Cron(CronExpression.EVERY_MINUTE)
    async handleCountdownAlerts() {
        const now = new Date();

        // Orders still in an active state waiting for seller proof
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

            // 60-minute alert
            if (minLeft <= 60 && minLeft > 59 && !order.alert60Sent) {
                await this.sendCountdownAlert(order.id, order.sellerId, 60);
                await this.prisma.repostOrder.update({
                    where: { id: order.id },
                    data: { alert60Sent: true },
                });
            }

            // 30-minute alert
            if (minLeft <= 30 && minLeft > 29 && !order.alert30Sent) {
                await this.sendCountdownAlert(order.id, order.sellerId, 30);
                await this.prisma.repostOrder.update({
                    where: { id: order.id },
                    data: { alert30Sent: true },
                });
            }

            // 15-minute alert
            if (minLeft <= 15 && minLeft > 14 && !order.alert15Sent) {
                await this.sendCountdownAlert(order.id, order.sellerId, 15);
                await this.prisma.repostOrder.update({
                    where: { id: order.id },
                    data: { alert15Sent: true },
                });
            }

            // 5-minute alert
            if (minLeft <= 5 && minLeft > 4 && !order.alert5Sent) {
                await this.sendCountdownAlert(order.id, order.sellerId, 5);
                await this.prisma.repostOrder.update({
                    where: { id: order.id },
                    data: { alert5Sent: true },
                });
            }

            // Countdown expired — auto-cancel (seller missed deadline)
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
                        type: "REPOST_NEW_REQUEST" as any,
                        data: { orderId: order.id },
                    }),
                ]);
            }
        }
    }

    // Runs every minute — auto-releases escrow after 1-hour buyer review window
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
            } catch (err) {
                this.logger.error(`Auto-release failed for ${order.id}: ${err.message}`);
            }
        }
    }

    // Runs every minute — auto-cancel redo if seller misses 30-min redo window
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
        }
    }

    private async sendCountdownAlert(orderId: string, sellerId: string, minutes: number) {
        await this.notifications.sendToUser(sellerId, {
            title: `${minutes} Minutes Remaining`,
            body: `Your repost request expires in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
            type: "REPOST_EXPIRING_SOON" as any,
            data: { orderId, minutesLeft: String(minutes) },
        });
        this.logger.log(`Sent ${minutes}-min alert for order ${orderId}`);
    }
}
