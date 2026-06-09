import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { FirebaseNotificationService } from "@main/shared/notification/firebase-notification.service";
import { RepostOrderStatus, RepostTimeframe } from "@prisma/client";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { CreateRepostOrderDto, ReviewActionDto, SubmitProofDto } from "./dto/repost-order.dto";

const TIMEFRAME_MS: Record<RepostTimeframe, number> = {
    THIRTY_MIN: 30 * 60 * 1000,
    ONE_HOUR: 60 * 60 * 1000,
    TWO_HOURS: 2 * 60 * 60 * 1000,
    SIX_HOURS: 6 * 60 * 60 * 1000,
    TWELVE_HOURS: 12 * 60 * 60 * 1000,
    TWENTY_FOUR_HOURS: 24 * 60 * 60 * 1000,
};

const REVIEW_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const REDO_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const PLATFORM_FEE_PCT = 0.1; // 10%

@Injectable()
export class RepostOrderService {
    constructor(
        private prisma: PrismaService,
        private notifications: FirebaseNotificationService,
    ) {}

    // ─────────── CREATE ORDER ───────────
    async create(buyerId: string, dto: CreateRepostOrderDto) {
        const listing = await this.prisma.repostListing.findUnique({
            where: { id: dto.listingId },
            include: { seller: { select: { id: true, username: true, full_name: true } } },
        });
        if (!listing) throw new NotFoundException("Repost listing not found");
        if (!listing.isActive || listing.isPaused)
            throw new BadRequestException("This listing is not available");
        if (listing.sellerId === buyerId)
            throw new BadRequestException("You cannot buy your own listing");

        const now = new Date();
        const countdownEndsAt = new Date(now.getTime() + TIMEFRAME_MS[dto.timeframe]);
        const platformFee = Math.round(dto.amount * PLATFORM_FEE_PCT);
        const sellerAmount = dto.amount - platformFee;

        const order = await this.prisma.repostOrder.create({
            data: {
                orderCode: "RPO-" + Date.now(),
                buyerId,
                sellerId: listing.sellerId,
                listingId: dto.listingId,
                platform: dto.platform,
                timeframe: dto.timeframe,
                amount: dto.amount,
                platformFee,
                sellerAmount,
                countdownEndsAt,
                contentUrl: dto.contentUrl,
                paymentIntentId: dto.paymentIntentId,
            },
        });

        await this.prisma.repostListing.update({
            where: { id: dto.listingId },
            data: { totalPurchases: { increment: 1 } },
        });

        const sellerName = listing.seller.username ?? listing.seller.full_name;

        await Promise.all([
            this.notifications.sendToUser(buyerId, {
                title: "Repost Request Sent",
                body: `Your repost request has been sent to @${sellerName}.`,
                type: "REPOST_ORDER_SUBMITTED" as any,
                data: { orderId: order.id },
            }),
            this.notifications.sendToUser(listing.sellerId, {
                title: "New Repost Request",
                body: "You received a new repost request.",
                type: "REPOST_NEW_REQUEST" as any,
                data: { orderId: order.id },
            }),
            this.notifications.sendToUser(buyerId, {
                title: "Funds Held in Escrow",
                body: "Your payment is securely held in escrow until delivery is confirmed.",
                type: "ESCROW_FUNDS_HELD" as any,
                data: { orderId: order.id },
            }),
        ]);

        return order;
    }

    // ─────────── SELLER: ACCEPT / REJECT ───────────
    async sellerRespond(orderId: string, sellerId: string, accept: boolean) {
        const order = await this.findOrderOrFail(orderId);
        if (order.sellerId !== sellerId) throw new ForbiddenException("Not your order");
        if (order.status !== RepostOrderStatus.NEW_REQUEST)
            throw new BadRequestException("Order is not in NEW_REQUEST state");

        if (!accept) {
            const updated = await this.prisma.repostOrder.update({
                where: { id: orderId },
                data: { status: RepostOrderStatus.REJECTED },
            });

            await Promise.all([
                this.notifications.sendToUser(order.buyerId, {
                    title: "Repost Request Declined",
                    body: `@${order.seller?.username ?? "Seller"} declined your repost request. Your refund is being processed.`,
                    type: "REPOST_SELLER_REJECTED" as any,
                    data: { orderId },
                }),
                this.notifications.sendToUser(order.buyerId, {
                    title: "Refund Issued",
                    body: "Your refund has been initiated and will appear in 3-5 business days.",
                    type: "ESCROW_REFUND_ISSUED" as any,
                    data: { orderId },
                }),
            ]);
            return updated;
        }

        const updated = await this.prisma.repostOrder.update({
            where: { id: orderId },
            data: { status: RepostOrderStatus.ACCEPTED },
        });

        await Promise.all([
            this.notifications.sendToUser(order.buyerId, {
                title: "Repost Request Accepted",
                body: `@${order.seller?.username ?? "Seller"} accepted your repost request.`,
                type: "REPOST_SELLER_ACCEPTED" as any,
                data: { orderId },
            }),
            this.notifications.sendToUser(sellerId, {
                title: "Request Accepted",
                body: "You accepted the repost request. Submit proof before the countdown expires.",
                type: "REPOST_REQUEST_ACCEPTED" as any,
                data: { orderId },
            }),
        ]);

        await this.prisma.repostListing.update({
            where: { id: order.listingId },
            data: { totalAccepts: { increment: 1 } },
        });

        return updated;
    }

    // ─────────── SELLER: SUBMIT PROOF ───────────
    async submitProof(orderId: string, sellerId: string, dto: SubmitProofDto, files: string[]) {
        const order = await this.findOrderOrFail(orderId);
        if (order.sellerId !== sellerId) throw new ForbiddenException("Not your order");
        if (
            order.status !== RepostOrderStatus.ACCEPTED &&
            order.status !== RepostOrderStatus.IN_PROGRESS &&
            order.status !== RepostOrderStatus.REDO_REQUESTED
        ) {
            throw new BadRequestException("Order is not in a state that accepts proof");
        }
        if (
            new Date() > order.countdownEndsAt &&
            order.status !== RepostOrderStatus.REDO_REQUESTED
        ) {
            throw new BadRequestException("Countdown has expired");
        }
        if (dto.proofType === "URL" && !dto.proofUrl)
            throw new BadRequestException("proofUrl is required when proofType is URL");

        const reviewWindowEndsAt = new Date(Date.now() + REVIEW_WINDOW_MS);

        const updated = await this.prisma.repostOrder.update({
            where: { id: orderId },
            data: {
                status: RepostOrderStatus.PROOF_SUBMITTED,
                proofType: dto.proofType,
                proofUrl: dto.proofUrl ?? null,
                proofFiles: files,
                proofSubmittedAt: new Date(),
                reviewWindowEndsAt,
                redoWindowEndsAt: null,
            },
        });

        await this.prisma.repostListing.update({
            where: { id: order.listingId },
            data: { totalProofs: { increment: 1 } },
        });

        const isRedo = order.status === RepostOrderStatus.REDO_REQUESTED;

        await Promise.all([
            this.notifications.sendToUser(order.buyerId, {
                title: isRedo ? "Revised Proof Submitted" : "Proof Submitted",
                body: isRedo
                    ? "Your seller submitted revised proof."
                    : "Proof has been submitted for your repost order.",
                type: (isRedo ? "REPOST_REDO_SUBMITTED" : "REPOST_PROOF_SUBMITTED") as any,
                data: { orderId },
            }),
            this.notifications.sendToUser(order.buyerId, {
                title: "Review Window Started",
                body: "You have 1 hour to review the submitted proof.",
                type: "REPOST_REVIEW_WINDOW_STARTED" as any,
                data: { orderId },
            }),
            this.notifications.sendToUser(sellerId, {
                title: "Proof Submitted Successfully",
                body: "Your proof has been submitted successfully.",
                type: "REPOST_PROOF_SENT" as any,
                data: { orderId },
            }),
        ]);

        if (isRedo) {
            await this.prisma.repostListing.update({
                where: { id: order.listingId },
                data: { totalRedos: { increment: 1 } },
            });
        }

        return updated;
    }

    // ─────────── BUYER: REVIEW PROOF ───────────
    async reviewProof(orderId: string, buyerId: string, dto: ReviewActionDto) {
        const order = await this.findOrderOrFail(orderId);
        if (order.buyerId !== buyerId) throw new ForbiddenException("Not your order");
        if (order.status !== RepostOrderStatus.PROOF_SUBMITTED)
            throw new BadRequestException("No proof to review");

        if (dto.action === "ACCEPT") {
            return this.releaseEscrow(orderId, order, "buyer_approved");
        }

        if (dto.action === "REJECT") {
            const updated = await this.prisma.repostOrder.update({
                where: { id: orderId },
                data: { status: RepostOrderStatus.REFUNDED },
            });
            await Promise.all([
                this.notifications.sendToUser(order.buyerId, {
                    title: "Refund Issued",
                    body: "Your refund has been initiated.",
                    type: "ESCROW_REFUND_ISSUED" as any,
                    data: { orderId },
                }),
                this.notifications.sendToUser(order.sellerId, {
                    title: "Proof Rejected",
                    body: "The buyer rejected your proof. The order has been refunded.",
                    type: "REPOST_REDO_REQUESTED" as any,
                    data: { orderId },
                }),
            ]);
            return updated;
        }

        if (dto.action === "REDO") {
            if (order.redoCount >= 3)
                throw new BadRequestException("Maximum redo limit (3) reached");

            const redoWindowEndsAt = new Date(Date.now() + REDO_WINDOW_MS);
            const updated = await this.prisma.repostOrder.update({
                where: { id: orderId },
                data: {
                    status: RepostOrderStatus.REDO_REQUESTED,
                    redoWindowEndsAt,
                    redoCount: { increment: 1 },
                },
            });

            await Promise.all([
                this.notifications.sendToUser(order.sellerId, {
                    title: "Redo Requested",
                    body: "Buyer requested a redo. You have 30 minutes remaining.",
                    type: "REPOST_REDO_REQUESTED" as any,
                    data: { orderId },
                }),
            ]);
            return updated;
        }

        throw new BadRequestException("Invalid action. Use ACCEPT, REJECT, or REDO");
    }

    // ─────────── AUTO RELEASE (called by scheduler) ───────────
    async releaseEscrow(orderId: string, orderData?: any, trigger?: string) {
        const order = orderData ?? (await this.findOrderOrFail(orderId));
        const isAutoRelease = trigger === "auto_release";

        const updated = await this.prisma.repostOrder.update({
            where: { id: order.id },
            data: {
                status: RepostOrderStatus.COMPLETED,
                isReleased: true,
                releasedAt: new Date(),
            },
        });

        await this.prisma.repostListing.update({
            where: { id: order.listingId },
            data: {
                totalCompleted: { increment: 1 },
                ...(isAutoRelease && { totalAutoReleases: { increment: 1 } }),
            },
        });

        await Promise.all([
            this.notifications.sendToUser(order.buyerId, {
                title: "Funds Released",
                body: "Funds have been released to the seller.",
                type: "REPOST_FUNDS_RELEASED" as any,
                data: { orderId: order.id },
            }),
            this.notifications.sendToUser(order.sellerId, {
                title: "Funds Released to Your Balance",
                body: "Funds have been released to your balance.",
                type: "REPOST_SELLER_FUNDS_RELEASED" as any,
                data: { orderId: order.id },
            }),
            this.notifications.sendToUser(order.buyerId, {
                title: "Escrow Released",
                body: "Escrow funds have been released to the seller.",
                type: "ESCROW_FUNDS_RELEASED" as any,
                data: { orderId: order.id },
            }),
            this.notifications.sendToUser(order.sellerId, {
                title: "Funds Released",
                body: "Your pending funds are now available in your balance.",
                type: "ESCROW_FUNDS_RELEASED" as any,
                data: { orderId: order.id },
            }),
        ]);

        return updated;
    }

    // ─────────── GETTERS ───────────
    getBuyerOrders(buyerId: string, status?: RepostOrderStatus) {
        return this.prisma.repostOrder.findMany({
            where: { buyerId, ...(status && { status }) },
            include: {
                listing: true,
                seller: { select: { id: true, username: true, profilePhoto: true } },
            },
            orderBy: { createdAt: "desc" },
        });
    }

    getSellerOrders(sellerId: string, status?: RepostOrderStatus) {
        return this.prisma.repostOrder.findMany({
            where: { sellerId, ...(status && { status }) },
            include: {
                listing: true,
                buyer: { select: { id: true, username: true, profilePhoto: true } },
            },
            orderBy: { createdAt: "desc" },
        });
    }

    async getOne(orderId: string) {
        const order = await this.prisma.repostOrder.findUnique({
            where: { id: orderId },
            include: {
                listing: true,
                buyer: {
                    select: { id: true, username: true, full_name: true, profilePhoto: true },
                },
                seller: {
                    select: { id: true, username: true, full_name: true, profilePhoto: true },
                },
            },
        });
        if (!order) throw new NotFoundException("Repost order not found");
        return { ...order, timeRemaining: this.getTimeRemaining(order.countdownEndsAt) };
    }

    // ─────────── HELPERS ───────────
    private async findOrderOrFail(orderId: string) {
        const order = await this.prisma.repostOrder.findUnique({
            where: { id: orderId },
            include: {
                seller: { select: { id: true, username: true } },
                buyer: { select: { id: true, username: true } },
            },
        });
        if (!order) throw new NotFoundException("Repost order not found");
        return order;
    }

    private getTimeRemaining(countdownEndsAt: Date) {
        const ms = countdownEndsAt.getTime() - Date.now();
        if (ms <= 0) return { expired: true, ms: 0, minutes: 0 };
        return { expired: false, ms, minutes: Math.floor(ms / 60000) };
    }
}
