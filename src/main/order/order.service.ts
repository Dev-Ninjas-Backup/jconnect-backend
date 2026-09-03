import {
    BadRequestException,
    ForbiddenException,
    Inject,
    Injectable,
    NotFoundException,
    forwardRef,
} from "@nestjs/common";

import { HandleError } from "@common/error/handle-error.decorator";
import { FirebaseNotificationService } from "@main/shared/notification/firebase-notification.service";
import { PrivateChatGateway } from "@main/shared/private-message/privateChatGateway/privateChatGateway";
import { OrderStatus, Role, ServiceRequestStatus } from "@prisma/client";
import { NotificationType } from "src/lib/firebase/dto/notification.dto";
import { MailService } from "src/lib/mail/mail.service";
import { PrismaService } from "src/lib/prisma/prisma.service";
import Stripe from "stripe";
import { OrderGateway } from "./order.gateway";

export function buildOrderTimeline(order: {
    createdAt: Date;
    inProgressAt?: Date | null;
    proofSubmittedAt?: Date | null;
    resubmitAt?: Date | null;
    releasedAt?: Date | null;
    cancelledAt?: Date | null;
    proofRejectReason?: string | null;
}) {
    return [
        { status: "PENDING" as const, at: order.createdAt, description: null as string | null },
        { status: "IN_PROGRESS" as const, at: order.inProgressAt ?? null, description: null },
        {
            status: "PROOF_SUBMITTED" as const,
            at: order.proofSubmittedAt ?? null,
            description: null,
        },
        {
            status: "RESUBMIT" as const,
            at: order.resubmitAt ?? null,
            description: order.proofRejectReason ?? null,
        },
        { status: "RELEASED" as const, at: order.releasedAt ?? null, description: null },
        { status: "CANCELLED" as const, at: order.cancelledAt ?? null, description: null },
    ].filter((step) => step.at);
}

function statusTimestampData(status: OrderStatus): Record<string, Date> {
    const now = new Date();
    switch (status) {
        case OrderStatus.IN_PROGRESS:
            return { inProgressAt: now };
        case OrderStatus.PROOF_SUBMITTED:
            return { proofSubmittedAt: now };
        case OrderStatus.RESUBMIT:
            return { resubmitAt: now };
        case OrderStatus.RELEASED:
            return { releasedAt: now };
        case OrderStatus.CANCELLED:
            return { cancelledAt: now };
        default:
            return {};
    }
}

const serviceRequestSocketInclude = {
    service: {
        include: {
            creator: {
                select: {
                    id: true,
                    full_name: true,
                    profilePhoto: true,
                    username: true,
                },
            },
        },
    },
    buyer: {
        select: {
            id: true,
            full_name: true,
            profilePhoto: true,
            username: true,
        },
    },
} as const;

@Injectable()
export class OrdersService {
    constructor(
        private prisma: PrismaService,
        private mail: MailService,
        private readonly firebaseNotificationService: FirebaseNotificationService,
        private readonly orderGateway: OrderGateway,
        @Inject(forwardRef(() => PrivateChatGateway))
        private readonly privateChatGateway: PrivateChatGateway,
        @Inject("STRIPE_CLIENT")
        private readonly stripe: Stripe,
    ) {}

    /** True while the order has a Dispute ("Report an Issue") under review — order/funds stay locked. */
    async hasOpenDispute(orderId: string): Promise<boolean> {
        const dispute = await this.prisma.dispute.findFirst({
            where: { orderId, status: "UNDER_REVIEW" },
            select: { id: true },
        });
        return !!dispute;
    }

    /** Sync chat card status when order is cancelled (Paid → Cancelled) + live socket. */
    private async markLinkedServiceRequestCancelled(order: {
        id: string;
        serviceRequestId?: string | null;
        buyerId: string;
        serviceId: string;
    }) {
        let serviceRequestId = order.serviceRequestId;

        if (!serviceRequestId) {
            const serviceRequest = await this.prisma.serviceRequest.findFirst({
                where: {
                    buyerId: order.buyerId,
                    serviceId: order.serviceId,
                },
                orderBy: { createdAt: "desc" },
            });
            serviceRequestId = serviceRequest?.id;
        }

        if (!serviceRequestId) return;

        const updated = await this.prisma.serviceRequest.update({
            where: { id: serviceRequestId },
            data: { status: ServiceRequestStatus.CANCELLED },
            include: serviceRequestSocketInclude,
        });

        this.privateChatGateway.emitServiceRequestUpdate(updated);
    }

    /** Push + in-app notification when an order is cancelled. */
    private async notifyOrderCancelled(
        order: {
            id: string;
            orderCode: string;
            buyerId: string;
            sellerId: string;
            service?: { serviceName?: string } | null;
            buyer?: { username?: string | null } | null;
            seller?: { username?: string | null } | null;
        },
        cancelledBy: "buyer" | "seller",
    ) {
        const serviceName = order.service?.serviceName ?? "your service";
        const actorName =
            cancelledBy === "buyer"
                ? (order.buyer?.username ?? "The buyer")
                : (order.seller?.username ?? "The seller");
        const otherUserId = cancelledBy === "buyer" ? order.sellerId : order.buyerId;

        try {
            await this.firebaseNotificationService.sendToUser(
                otherUserId,
                {
                    title: "Order Cancelled",
                    body:
                        cancelledBy === "buyer"
                            ? `@${actorName} cancelled order ${order.orderCode} for "${serviceName}".`
                            : `@${actorName} cancelled order ${order.orderCode} for "${serviceName}".`,
                    type: "SERVICE_REQUEST_CANCELLED" as any,
                    data: {
                        orderId: order.id,
                        orderCode: order.orderCode,
                        status: "CANCELLED",
                        cancelledBy,
                        timestamp: new Date().toISOString(),
                    },
                },
                true,
            );
        } catch (error) {
            console.error(`Failed to send order cancel notification: ${error.message}`);
        }
    }

    //----------------------- CREATE ORDER -----------------------
    @HandleError("Failed to create order")
    async createOrder(buyerId: string, dto: any) {
        const service = await this.prisma.service.findUnique({
            where: { id: dto.serviceId },
        });

        if (!service) throw new NotFoundException("Service not found");

        if (service.creatorId === buyerId)
            throw new BadRequestException("You cannot buy your own service");

        const order = await this.prisma.order.create({
            data: {
                orderCode: "ORD-" + Date.now(),
                buyerId,
                sellerId: dto.sellerId,
                sessionId: dto.sessionId,
                serviceId: dto.serviceId,
                amount: dto.amount,
                platformFee: dto.platformFee,
                status: OrderStatus.PENDING,
            },
        });

        this.orderGateway.emitOrderCreated(order);
        return order;
    }

    // // GET ALL ORDERS OF BUYER
    // async getOrdersByBuyer(buyerId: string) {
    //     console.log("ami buyer id", buyerId);

    //     return this.prisma.order.findMany({
    //         where: { buyerId },
    //         include: { service: true },
    //     });
    // }

    // GET ONE ORDER

    @HandleError("Failed to get order")
    async getOrder(id: string) {
        const order = await this.prisma.order.findUnique({
            where: { id },
            include: {
                service: true,
                serviceRequest: {
                    select: {
                        id: true,
                        captionOrInstructions: true,
                        specialNotes: true,
                        promotionDate: true,
                        uploadedFileUrl: true,
                        isDeclined: true,
                        isAccepted: true,
                    },
                },
                buyer: {
                    select: {
                        full_name: true,
                        id: true,
                        email: true,
                        username: true,
                        profilePhoto: true,
                    },
                },
                seller: {
                    select: {
                        full_name: true,
                        id: true,
                        email: true,
                        username: true,
                        profilePhoto: true,
                    },
                },
            },
        });

        if (!order) throw new NotFoundException("Order not found");

        let serviceRequest: any = order.serviceRequest;

        if (!serviceRequest) {
            serviceRequest = await this.prisma.serviceRequest.findFirst({
                where: {
                    buyerId: order.buyerId,
                    serviceId: order.serviceId,
                },
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    captionOrInstructions: true,
                    specialNotes: true,
                    promotionDate: true,
                    uploadedFileUrl: true,
                    isDeclined: true,
                    isAccepted: true,
                },
            });
        }

        const { serviceRequest: _serviceRequest, ...orderData } = order;

        // Hide promotion info from buyer when seller has declined the service request.
        // When the buyer re-submits documents, isDeclined is reset to false and the
        // promotion info becomes visible again automatically.
        const showPromotionInfo = !serviceRequest?.isDeclined;

        return {
            ...orderData,
            captionOrInstructions: showPromotionInfo
                ? (serviceRequest?.captionOrInstructions ?? null)
                : null,
            specialNotes: showPromotionInfo ? (serviceRequest?.specialNotes ?? null) : null,
            promotionDate: showPromotionInfo ? (serviceRequest?.promotionDate ?? null) : null,
            files: showPromotionInfo ? (serviceRequest?.uploadedFileUrl ?? []) : [],
            isServiceRequestDeclined: serviceRequest?.isDeclined ?? false,
            isServiceRequestAccepted: serviceRequest?.isAccepted ?? false,
            timeline: buildOrderTimeline(order),
        };
    }

    // ----------------------UPDATE ORDER STATUS---------------------------
    @HandleError("Failed to update order status")
    async updateStatus(id: string, status: OrderStatus, user: any) {
        const order: any = await this.prisma.order.findUnique({
            where: { id },
            include: { buyer: true, seller: true, service: true },
        });
        if (!order) throw new NotFoundException("Order not found");

        //if update status to cancelled so first of all check status if in progress or proof submitted or pending
        // if in progress or proof submitted then only allow to cancel by seller or admin
        if (status === OrderStatus.CANCELLED) {
            if (!order.paymentIntentId) {
                throw new BadRequestException(
                    "buyer not paid yet/PaymentIntent ID not found for this order",
                );
            }
            const intent = await this.stripe.paymentIntents.retrieve(order.paymentIntentId);

            if (order.status === OrderStatus.PENDING) {
                const isBuyer = order.buyerId === user.userId;
                const isSeller = order.sellerId === user.userId;
                if (isBuyer) {
                    await this.stripe.paymentIntents.cancel(order.paymentIntentId);
                    const updated = await this.prisma.order.update({
                        where: { id: order.id },
                        data: {
                            status: OrderStatus.CANCELLED,
                            cancelledAt: new Date(),
                        },
                    });
                    await this.markLinkedServiceRequestCancelled(order);

                    // Send email notification to seller about cancel request
                    try {
                        await this.mail.sendEmail(
                            order?.seller.email,
                            "DaConnect - Order Cancelled",
                            `
                            <p>Hello ${order.seller.full_name || "Seller"},</p>
                            <p>The buyer has cancelled the order <strong>${order.orderCode}</strong> for the service <strong>${order.service.serviceName}</strong>.</p>
                            <p>Thank you,<br/>DaConnect Team</p>
                            `,
                        );
                    } catch (error) {
                        console.error("Failed to send cancellation email:", error);
                    }

                    // send email notification to buyer about successful cancellation
                    try {
                        await this.mail.sendEmail(
                            order?.buyer.email,
                            "DaConnect - Order Cancelled",
                            `
                            <p>Hello ${order.buyer.full_name || "Buyer"},</p>
                            <p>Your order <strong>${order.orderCode}</strong> for the service <strong>${order.service.serviceName}</strong> has been cancelled.</p>
                            <p>Thank you,<br/>DaConnect Team</p>
                            `,
                        );
                    } catch (error) {
                        console.error("Failed to send cancellation email to buyer:", error);
                    }
                    await this.notifyOrderCancelled(order, "buyer");
                    this.orderGateway.emitCancelled(updated);
                    return { ...updated, message: "Order cancelled successfully" };
                }
                if (isSeller) {
                    await this.stripe.paymentIntents.cancel(order.paymentIntentId);
                    const updated = await this.prisma.order.update({
                        where: { id: order.id },
                        data: {
                            status: OrderStatus.CANCELLED,
                            cancelledAt: new Date(),
                        },
                    });
                    await this.markLinkedServiceRequestCancelled(order);
                    // Send email notification to seller about successful cancellation
                    try {
                        await this.mail.sendEmail(
                            order?.seller.email,
                            "DaConnect - Order Cancelled",
                            `
                            <p>Hello ${order.seller.full_name || "Seller"},</p>
                            <p>The order <strong>${order.orderCode}</strong> for the service <strong>${order.service.serviceName}</strong> has been not received from seller side.</p>
                            <p>Thank you,<br/>DaConnect Team</p>
                            `,
                        );
                    } catch (error) {
                        console.error("Failed to send cancellation email to seller:", error);
                    }
                    await this.notifyOrderCancelled(order, "seller");
                    this.orderGateway.emitCancelled(updated);
                    return { ...updated, message: "Order cancelled successfully" };
                }
            }

            if (
                order.status === OrderStatus.IN_PROGRESS ||
                order.status === OrderStatus.PROOF_SUBMITTED ||
                order.status === OrderStatus.RESUBMIT
            ) {
                // if buyer then they send to seller a email for calcel request
                const isBuyer = order.buyerId === user.userId;
                const isSeller = order.sellerId === user.userId;

                if (isSeller) {
                    ///////////////

                    if (intent.status === "requires_capture") {
                        await this.stripe.paymentIntents.cancel(order.paymentIntentId);

                        const updated = await this.prisma.order.update({
                            where: { id: order.id },
                            data: {
                                status: OrderStatus.CANCELLED,
                                cancelledAt: new Date(),
                                seller_amount: 0,
                                buyerPay: 0,
                                stripeFee: 0,
                                PlatfromRevinue: 0,
                                platformFee: 0,
                            },
                        });
                        await this.markLinkedServiceRequestCancelled(order);
                        // Send email notification to buyer about successful cancellation
                        try {
                            await this.mail.sendEmail(
                                order?.buyer.email,
                                "DaConnect - Order Cancellation Request Approved",
                                `
                                <p>Hello ${order.buyer.full_name || "Buyer"},</p>
                                <p>Your order <strong>${order.orderCode}</strong> for the service <strong>${order.service.serviceName}</strong> has been cancelled.</p>
                                <p>Thank you,<br/>DaConnect Team</p>
                                `,
                            );
                        } catch (error) {
                            console.error("Failed to send cancellation email to buyer:", error);
                        }
                        // send email notification to seller about successful cancellation
                        try {
                            await this.mail.sendEmail(
                                order?.seller.email,
                                "DaConnect - Order Cancelled",
                                `
                                <p>Hello ${order.seller.full_name || "Seller"},</p>
                                <p>Your order <strong>${order.orderCode}</strong> for the service <strong>${order.service.serviceName}</strong> has been cancelled.</p>
                                <p>Thank you,<br/>DaConnect Team</p>
                                `,
                            );
                        } catch (error) {
                            console.error("Failed to send cancellation email to seller:", error);
                        }
                        await this.notifyOrderCancelled(order, "seller");
                        this.orderGateway.emitCancelled(updated);
                        return { ...updated, message: "Order status updated successfully" };
                    }

                    ///////////////
                }

                if (isBuyer) {
                    // Mark the order as having a pending cancellation request so the
                    // seller is blocked from uploading proof until it's resolved
                    await this.prisma.order.update({
                        where: { id: order.id },
                        data: {
                            isCancelRequested: true,
                            cancelRequestedAt: new Date(),
                        },
                    });

                    // Send email notification to seller about cancel request
                    try {
                        await this.mail.sendEmail(
                            order?.seller.email,
                            "DaConnect - Cancellation Request for Order " + order.orderCode,
                            `
                            <p>Hello ${order.seller.full_name || "Seller"},</p>
                            <p>The buyer has requested to cancel the order <strong>${order.orderCode}</strong> for the service <strong>${order.service.serviceName}</strong>.</p>
                            <p>Please review the cancellation request and take appropriate action.</p>
                            <p>Thank you,<br/>DaConnect Team</p>
                            `,
                        );

                        return { message: "Cancellation request sent to seller successfully" };
                    } catch (error) {
                        console.error("Failed to send cancellation email:", error);
                        // Continue even if email fails
                    }
                }
            }

            //else {
            //     // If order is not in progress or proof submitted, allow buyer to cancel
            //     if (order.buyerId !== user.userId) {
            //         throw new ForbiddenException(
            //             "Only buyer can cancel this order",
            //         );
            //     }
            // }
        }

        // Seller only allowed some statuses
        if (status === OrderStatus.IN_PROGRESS || status === OrderStatus.PROOF_SUBMITTED) {
            if (order.sellerId !== user.userId)
                throw new ForbiddenException("Only seller can update this status");
        }

        // Buyer confirms delivery
        if (status === OrderStatus.RELEASED) {
            if (order.buyerId !== user.userId)
                throw new ForbiddenException("Only buyer can confirm delivery");
            if (await this.hasOpenDispute(order.id)) {
                throw new BadRequestException(
                    "This order has a dispute under review. Funds are locked until the dispute is resolved.",
                );
            }
        }

        if (status === OrderStatus.RESUBMIT) {
            throw new BadRequestException("Use cancel-proof to request a proof resubmit");
        }

        const updated = await this.prisma.order.update({
            where: { id },
            data: { status, ...statusTimestampData(status) },
        });

        //------------------ Send status change notifications ------------------//
        try {
            // Send notifications based on order status
            switch (status) {
                case OrderStatus.IN_PROGRESS:
                    // Notify buyer that seller accepted their order
                    try {
                        await this.mail.sendEmail(
                            order.buyer.email,
                            `✅ Order ${order.orderCode} Accepted - Work Starting Soon`,
                            `<!DOCTYPE html>
                            <html>
                            <head>
                                <style>
                                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f7fa; }
                                    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
                                    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; }
                                    .content { padding: 40px 30px; }
                                    .order-info { background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 6px; }
                                    .footer { text-align: center; padding: 25px; background: #f8fafc; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <div class="header">
                                        <div style="font-size: 32px; margin-bottom: 10px;">✅</div>
                                        <h1 style="margin: 0; color: white;">Order Accepted!</h1>
                                    </div>
                                    <div class="content">
                                        <h2 style="color: #1e293b; margin-bottom: 20px;">Great News!</h2>
                                        <p style="font-size: 16px; color: #475569;">The seller has accepted your order and will start working on it soon.</p>
                                        <div class="order-info">
                                            <p style="margin: 5px 0;"><strong>Order Code:</strong> ${order.orderCode}</p>
                                            <p style="margin: 5px 0;"><strong>Service:</strong> ${order.service.serviceName}</p>
                                            <p style="margin: 5px 0;"><strong>Seller:</strong> ${order.seller.username}</p>
                                        </div>
                                        <p style="font-size: 14px; color: #64748b;">You'll receive updates as the seller progresses with your order. Thank you for using DaConnect!</p>
                                    </div>
                                    <div class="footer">
                                        <p style="margin: 5px 0;"><strong style="color: #10b981;">DaConnect</strong> - Connecting Artists & Music Lovers</p>
                                        <p style="margin: 5px 0;">&copy; 2025 DaConnect. All rights reserved.</p>
                                    </div>
                                </div>
                            </body>
                            </html>`,
                        );
                        console.log(`📧 Order accepted email sent to buyer ${order.buyerId}`);
                    } catch (error) {
                        console.error(`❌ Failed to send order accepted email: ${error.message}`);
                    }

                    // -------------------- Send push notification to buyer -----------------
                    try {
                        const result = await this.firebaseNotificationService.sendToUser(
                            order.buyerId,
                            {
                                title: "✅ Order Accepted",
                                body: `Seller has accepted your order ${order.orderCode} for "${order.service.serviceName}". Work will begin soon!`,
                                type: NotificationType.ORDER_UPDATE,
                                data: {
                                    orderId: updated.id,
                                    orderCode: updated.orderCode,
                                    status: updated.status,
                                    timestamp: new Date().toISOString(),
                                },
                            },
                            true,
                        );
                        if (result.success) {
                            console.log(
                                `📱 Order accepted notification sent to buyer ${order.buyerId}`,
                            );
                        } else {
                            console.warn(
                                `⚠️ Order accepted notification not sent to buyer ${order.buyerId}: ${result.error}`,
                            );
                        }
                    } catch (error) {
                        console.error(
                            `❌ Failed to send order accepted notification to buyer ${order.buyerId}: ${error instanceof Error ? error.message : String(error)}`,
                        );
                    }
                    break;

                case OrderStatus.PROOF_SUBMITTED:
                    // Notify buyer that seller submitted proof
                    try {
                        await this.mail.sendEmail(
                            order.buyer.email,
                            `📁 Proof Submitted for Order ${order.orderCode}`,
                            `<!DOCTYPE html>
                            <html>
                            <head>
                                <style>
                                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f7fa; }
                                    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
                                    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 40px 30px; text-align: center; }
                                    .content { padding: 40px 30px; }
                                    .proof-info { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 6px; }
                                    .footer { text-align: center; padding: 25px; background: #f8fafc; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <div class="header">
                                        <div style="font-size: 32px; margin-bottom: 10px;">📁</div>
                                        <h1 style="margin: 0; color: white;">Proof Files Submitted</h1>
                                    </div>
                                    <div class="content">
                                        <h2 style="color: #1e293b; margin-bottom: 20px;">Work in Progress!</h2>
                                        <p style="font-size: 16px; color: #475569;">The seller has submitted proof files for your order. Please review them and confirm if you're satisfied with the work.</p>
                                        <div class="proof-info">
                                            <p style="margin: 5px 0;"><strong>Order Code:</strong> ${order.orderCode}</p>
                                            <p style="margin: 5px 0;"><strong>Service:</strong> ${order.service.serviceName}</p>
                                            <p style="margin: 5px 0;"><strong>Seller:</strong> ${order.seller.username}</p>
                                        </div>
                                        <p style="font-size: 14px; color: #64748b;">Once you review and confirm, the order will be completed and the seller will receive their payment.</p>
                                    </div>
                                    <div class="footer">
                                        <p style="margin: 5px 0;"><strong style="color: #f59e0b;">DaConnect</strong> - Connecting Artists & Music Lovers</p>
                                        <p style="margin: 5px 0;">&copy; 2025 DaConnect. All rights reserved.</p>
                                    </div>
                                </div>
                            </body>
                            </html>`,
                        );
                        console.log(`📧 Proof submitted email sent to buyer ${order.buyerId}`);
                    } catch (error) {
                        console.error(`❌ Failed to send proof submitted email: ${error.message}`);
                    }

                    // -------------------- Send push notification to buyer --------------------
                    try {
                        const result = await this.firebaseNotificationService.sendToUser(
                            order.buyerId,
                            {
                                title: "📁 Proof Submitted",
                                body: `Seller has submitted proof files for your order ${order.orderCode}. Please review and confirm completion.`,
                                type: NotificationType.ORDER_UPDATE,
                                data: {
                                    orderId: updated.id,
                                    orderCode: updated.orderCode,
                                    status: updated.status,
                                    timestamp: new Date().toISOString(),
                                },
                            },
                            true,
                        );
                        if (result.success) {
                            console.log(
                                `📱 Proof submitted notification sent to buyer ${order.buyerId}`,
                            );
                        } else {
                            console.warn(
                                `⚠️ Proof submitted notification not sent to buyer ${order.buyerId}: ${result.error}`,
                            );
                        }
                    } catch (error) {
                        console.error(
                            `❌ Failed to send proof submitted notification to buyer ${order.buyerId}: ${error instanceof Error ? error.message : String(error)}`,
                        );
                    }
                    break;

                case OrderStatus.RELEASED:
                    // Notify buyer that order is completed
                    try {
                        await this.mail.sendEmail(
                            order.buyer.email,
                            `🎉 Order ${order.orderCode} Completed!`,
                            `<!DOCTYPE html>
                            <html>
                            <head>
                                <style>
                                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f7fa; }
                                    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
                                    .header { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 40px 30px; text-align: center; }
                                    .content { padding: 40px 30px; }
                                    .completed-info { background: #eef2ff; border-left: 4px solid #6366f1; padding: 20px; margin: 25px 0; border-radius: 6px; }
                                    .footer { text-align: center; padding: 25px; background: #f8fafc; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <div class="header">
                                        <div style="font-size: 32px; margin-bottom: 10px;">🎉</div>
                                        <h1 style="margin: 0; color: white;">Order Completed!</h1>
                                    </div>
                                    <div class="content">
                                        <h2 style="color: #1e293b; margin-bottom: 20px;">Thank You!</h2>
                                        <p style="font-size: 16px; color: #475569;">Your order has been successfully completed! We hope you're satisfied with the service.</p>
                                        <div class="completed-info">
                                            <p style="margin: 5px 0;"><strong>Order Code:</strong> ${order.orderCode}</p>
                                            <p style="margin: 5px 0;"><strong>Service:</strong> ${order.service.serviceName}</p>
                                            <p style="margin: 5px 0;"><strong>Seller:</strong> ${order.seller.username}</p>
                                        </div>
                                        <p style="font-size: 14px; color: #64748b;">Consider leaving a review to help the seller and other users. Thanks for using DaConnect!</p>
                                    </div>
                                    <div class="footer">
                                        <p style="margin: 5px 0;"><strong style="color: #6366f1;">DaConnect</strong> - Connecting Artists & Music Lovers</p>
                                        <p style="margin: 5px 0;">&copy; 2025 DaConnect. All rights reserved.</p>
                                    </div>
                                </div>
                            </body>
                            </html>`,
                        );
                        console.log(`📧 Order completed email sent to buyer ${order.buyerId}`);
                    } catch (error) {
                        console.error(`❌ Failed to send order completed email: ${error.message}`);
                    }

                    // Notify seller that payment is released
                    try {
                        await this.mail.sendEmail(
                            order.seller.email,
                            `💰 Payment Released for Order ${order.orderCode}`,
                            `<!DOCTYPE html>
                            <html>
                            <head>
                                <style>
                                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f7fa; }
                                    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
                                    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; }
                                    .content { padding: 40px 30px; }
                                    .payment-info { background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 6px; }
                                    .footer { text-align: center; padding: 25px; background: #f8fafc; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <div class="header">
                                        <div style="font-size: 32px; margin-bottom: 10px;">💰</div>
                                        <h1 style="margin: 0; color: white;">Payment Released!</h1>
                                    </div>
                                    <div class="content">
                                        <h2 style="color: #1e293b; margin-bottom: 20px;">Great Job!</h2>
                                        <p style="font-size: 16px; color: #475569;">The buyer has confirmed delivery and your payment has been released!</p>
                                        <div class="payment-info">
                                            <p style="margin: 5px 0;"><strong>Order Code:</strong> ${order.orderCode}</p>
                                            <p style="margin: 5px 0;"><strong>Service:</strong> ${order.service.serviceName}</p>
                                            <p style="margin: 5px 0;"><strong>Status:</strong> Payment Released</p>
                                        </div>
                                        <p style="font-size: 14px; color: #64748b;">The funds are now available in your DaConnect account. Keep up the excellent work!</p>
                                    </div>
                                    <div class="footer">
                                        <p style="margin: 5px 0;"><strong style="color: #10b981;">DaConnect</strong> - Empowering Artists</p>
                                        <p style="margin: 5px 0;">&copy; 2025 DaConnect. All rights reserved.</p>
                                    </div>
                                </div>
                            </body>
                            </html>`,
                        );
                        console.log(`📧 Payment released email sent to seller ${order.sellerId}`);
                    } catch (error) {
                        console.error(`❌ Failed to send payment released email: ${error.message}`);
                    }

                    //--------------- Send push notification to buyer -----------------
                    try {
                        const resultBuyer = await this.firebaseNotificationService.sendToUser(
                            order.buyerId,
                            {
                                title: "🎉 Order Completed",
                                body: `Order ${order.orderCode} has been completed! Thank you for using DaConnect.`,
                                type: NotificationType.ORDER_UPDATE,
                                data: {
                                    orderId: updated.id,
                                    orderCode: updated.orderCode,
                                    status: updated.status,
                                    timestamp: new Date().toISOString(),
                                },
                            },
                            true,
                        );
                        if (resultBuyer.success) {
                            console.log(
                                `📱 Order completed notification sent to buyer ${order.buyerId}`,
                            );
                        } else {
                            console.warn(
                                `⚠️ Order completed notification not sent to buyer ${order.buyerId}: ${resultBuyer.error}`,
                            );
                        }
                    } catch (error) {
                        console.error(
                            `❌ Failed to send order completed notification to buyer ${order.buyerId}: ${error instanceof Error ? error.message : String(error)}`,
                        );
                    }

                    //----------------- Send push notification to seller
                    try {
                        const resultSeller = await this.firebaseNotificationService.sendToUser(
                            order.sellerId,
                            {
                                title: "💰 Payment Released",
                                body: `Payment for order ${order.orderCode} has been released to your account.`,
                                type: NotificationType.PAYMENT_RECEIVED,
                                data: {
                                    orderId: updated.id,
                                    orderCode: updated.orderCode,
                                    status: updated.status,
                                    timestamp: new Date().toISOString(),
                                },
                            },
                            true,
                        );
                        if (resultSeller.success) {
                            console.log(
                                `📱 Payment released notification sent to seller ${order.sellerId}`,
                            );
                        } else {
                            console.warn(
                                `⚠️ Payment released notification not sent to seller ${order.sellerId}: ${resultSeller.error}`,
                            );
                        }
                    } catch (error) {
                        console.error(
                            `❌ Failed to send payment released notification to seller ${order.sellerId}: ${error instanceof Error ? error.message : String(error)}`,
                        );
                    }
                    break;

                default:
                    break;
            }
        } catch (error) {
            console.error(`❌ Error sending order status notifications: ${error.message}`);
        }

        this.orderGateway.emitStatusChange(updated);
        return {
            ...updated,
            timeline: buildOrderTimeline(updated),
            message: "Order status updated successfully",
        };
    }

    // ----------------- SELLER DECLINES A CANCELLATION REQUEST -----------------
    // Clears isCancelRequested/cancelRequestedAt so the order stays in its
    // current status (IN_PROGRESS/PROOF_SUBMITTED/RESUBMIT) and proof upload
    // unblocks again. To accept the cancellation instead, the seller uses the
    // existing PATCH /orders/:id/status?status=CANCELLED flow.
    @HandleError("Failed to decline cancellation request")
    async declineCancelRequest(orderId: string, user: any) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { buyer: true, seller: true, service: true },
        });
        if (!order) throw new NotFoundException("Order not found");

        if (order.sellerId !== user.userId) {
            throw new ForbiddenException("Only the seller can decline a cancellation request");
        }

        if (!order.isCancelRequested) {
            throw new BadRequestException(
                "There is no pending cancellation request for this order",
            );
        }

        const updated = await this.prisma.order.update({
            where: { id: order.id },
            data: {
                isCancelRequested: false,
                cancelRequestedAt: null,
            },
        });

        try {
            await this.mail.sendEmail(
                order.buyer.email,
                "DaConnect - Cancellation Request Declined for Order " + order.orderCode,
                `
                <p>Hello ${order.buyer.full_name || "Buyer"},</p>
                <p>The seller has declined your cancellation request for order <strong>${order.orderCode}</strong> for the service <strong>${order.service.serviceName}</strong>. The order remains in progress.</p>
                <p>If you still have concerns, you can report an issue and our team will review it.</p>
                <p>Thank you,<br/>DaConnect Team</p>
                `,
            );
        } catch (error) {
            console.error("Failed to send cancellation decline email:", error);
        }

        try {
            await this.firebaseNotificationService.sendToUser(
                order.buyerId,
                {
                    title: "Cancellation Request Declined",
                    body: `@${order.seller?.username ?? "The seller"} declined your cancellation request for order ${order.orderCode}. The order remains in progress.`,
                    type: NotificationType.ORDER_UPDATE,
                    data: {
                        orderId: order.id,
                        orderCode: order.orderCode,
                        status: updated.status,
                        action: "CANCEL_REQUEST_DECLINED",
                        timestamp: new Date().toISOString(),
                    },
                },
                true,
            );
        } catch (error) {
            console.error("Failed to send cancellation decline notification:", error);
        }

        this.orderGateway.emitCancelRequestDeclined(updated);
        return {
            ...updated,
            timeline: buildOrderTimeline(updated),
            message: "Cancellation request declined. The order remains in progress.",
        };
    }

    // -----------------------DELETE ORDER -------------------------
    async deleteOrder(orderId: string, user: any) {
        // 1) Load order
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });

        if (!order) throw new NotFoundException("Order not found");

        // 2) Access Rules:
        // Buyer → can delete own order
        const isBuyer = order.buyerId === user.userId;

        // Admin / SuperAdmin → can delete any order
        const isAdmin = user.roles.includes(Role.ADMIN);
        const isSuperAdmin = user.roles.includes(Role.SUPER_ADMIN);

        if (!isBuyer && !isAdmin && !isSuperAdmin) {
            throw new ForbiddenException("You are not allowed to delete this order.");
        }

        // Optional rule: If order already released, block delete
        if (order.isReleased) {
            throw new ForbiddenException("Released orders cannot be deleted.");
        }

        // 3) Delete the order
        await this.prisma.order.delete({
            where: { id: orderId },
        });

        this.orderGateway.emitOrderDeleted(order);

        return {
            message: "Order deleted successfully",
            orderId,
        };
    }

    // STRIPE WEBHOOK → PAYMENT SUCCESS → AUTO UPDATE
    // async markPaid(paymentIntentId: string) {
    //     return this.prisma.order.update({
    //         where: { paymentIntentId },
    //         data: { status: OrderStatus.PAID },
    //     });
    // }

    // RELEASE PAYMENT
    async releasePayment(orderId: string) {
        return this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: OrderStatus.RELEASED,
                isReleased: true,
                releasedAt: new Date(),
            },
        });
    }

    // ----------------- PROOF SUBMISSION BY SELLER WITH Notification -----------------

    async submitProof(orderId: string, userFromReq: any, proofUrls: string[]) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                service: true,
                buyer: {
                    select: {
                        full_name: true,
                        id: true,
                        email: true,
                        username: true,
                        profilePhoto: true,
                    },
                },
                seller: {
                    select: {
                        full_name: true,
                        id: true,
                        email: true,
                        username: true,
                        profilePhoto: true,
                    },
                },
            },
        });

        const user = await this.prisma.user.findUnique({
            where: { id: userFromReq.userId },
        });

        if (!order) throw new NotFoundException("Order not found");

        // ---------------Only seller can upload proof-------------------------
        if (order.sellerId !== user?.id) {
            throw new ForbiddenException("Only seller can upload proof");
        }

        if (!proofUrls || proofUrls.length === 0) {
            throw new BadRequestException("Proof URLs are required");
        }

        // ---------------Block proof upload if buyer has requested cancellation-------------------------
        if (order.isCancelRequested) {
            throw new BadRequestException(
                "The buyer has requested to cancel this order. You cannot upload proof until the cancellation request is resolved.",
            );
        }

        // ---------------Block proof upload while a dispute is under review-------------------------
        if (await this.hasOpenDispute(order.id)) {
            throw new BadRequestException(
                "This order has a dispute under review. You cannot upload proof until the dispute is resolved.",
            );
        }

        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: OrderStatus.PROOF_SUBMITTED,
                proofUrl: {
                    push: proofUrls,
                },
                proofSubmittedAt: new Date(),
                isCancalProofSubmitted: false,
            },
            include: {
                service: true,
                buyer: {
                    select: {
                        full_name: true,
                        id: true,
                        email: true,
                        username: true,
                        profilePhoto: true,
                    },
                },
                seller: {
                    select: {
                        full_name: true,
                        id: true,
                        email: true,
                        username: true,
                        profilePhoto: true,
                    },
                },
            },
        });

        // -----------Send email notification to buyer ----------------
        try {
            await this.mail.sendEmail(
                order.buyer.email,
                "DaConnect - Proof Submitted for Your Order! ✅",
                `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f7fa; }
                        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
                        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; }
                        .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; letter-spacing: 1px; }
                        .header-subtitle { font-size: 16px; opacity: 0.95; }
                        .content { padding: 40px 30px; }
                        .order-box { background: #d1fae5; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 6px; }
                        .info-item { margin: 10px 0; }
                        .label { font-weight: 600; color: #374151; }
                        .value { color: #6b7280; }
                        .cta-button { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
                        .footer { text-align: center; padding: 25px; background: #f8fafc; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; }
                        .brand-name { color: #10b981; font-weight: 600; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="logo">🎵 DaConnect</div>
                            <div class="header-subtitle">Order Proof Submitted</div>
                        </div>
                        <div class="content">
                            <h2 style="color: #1e293b; margin-bottom: 20px;">Hello ${order.buyer.full_name || "Buyer"}! 👋</h2>
                            <p style="font-size: 16px; color: #475569;">Great news! The seller has submitted proof of work completion for your order.</p>
                            
                            <div class="order-box">
                                <h3 style="margin-top: 0; color: #065f46;">✅ Proof Submitted Successfully</h3>
                                <div class="info-item">
                                    <span class="label">Order Code:</span>
                                    <span class="value">${order.orderCode}</span>
                                </div>
                                <div class="info-item">
                                    <span class="label">Service:</span>
                                    <span class="value">${order.service?.serviceName || "N/A"}</span>
                                </div>
                                <div class="info-item">
                                    <span class="label">Seller:</span>
                                    <span class="value">${order.seller.username || order.seller.full_name || order.seller.email}</span>
                                </div>
                                <div class="info-item">
                                    <span class="label">Amount:</span>
                                    <span class="value">$${(order.amount / 100).toFixed(2)}</span>
                                </div>
                                <div class="info-item">
                                    <span class="label">Your Proof URL:</span>
                                    <span class="value">${updated.proofUrl || "N/A"}</span>
                                </div>
                            </div>

                            <p style="font-size: 15px; color: #475569; margin: 25px 0;"><strong>What's Next?</strong></p>
                            <p style="font-size: 15px; color: #475569; margin: 15px 0;">Please review the submitted proof and confirm if everything meets your expectations. Once you're satisfied with the work, you can release the payment to the seller.</p>
                            
                            <p style="font-size: 15px; color: #475569; margin: 15px 0;">If you have any concerns about the submitted proof, please contact the seller or reach out to our support team for assistance.</p>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="#" class="cta-button">View Order Details</a>
                            </div>
                            
                            <p style="font-size: 14px; color: #64748b; margin-top: 25px;">Thank you for choosing <span class="brand-name">DaConnect</span> for your creative needs!</p>
                        </div>
                        
                        <div class="footer">
                            <p style="margin: 5px 0;">This is an automated email from <strong class="brand-name">DaConnect</strong>. Please do not reply.</p>
                            <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} DaConnect. All rights reserved.</p>
                            <p style="margin: 10px 0; font-size: 12px;">Empowering artists and connecting communities through music.</p>
                        </div>
                    </div>
                </body>
                </html>
                `,
            );
        } catch (error) {
            console.error("Failed to send email notification to buyer:", error);
            //
        }

        // -------------Send push notification to buyer ----------------
        await this.firebaseNotificationService.sendToUser(
            order.buyerId,
            {
                title: "Proof uploaded",
                body: `${updated.seller?.username ?? "Seller"} has submitted proof for order ${order.orderCode}`,
                type: NotificationType.UPLOAD_PROOF,
                data: {
                    // App uses orderId to fetch order details — never put buyerId here
                    orderId: order.id,
                    orderCode: order.orderCode,
                    serviceRequestId: order.serviceRequestId ?? "",
                    buyerId: order.buyerId,
                    sellerId: order.sellerId,
                    status: updated.status,
                    timestamp: new Date().toISOString(),
                },
            },
            true,
        );
        console.log(
            `📁 UPLOAD_PROOF notification sent to buyer ${order.buyerId} for order ${order.id}`,
        );

        this.orderGateway.emitProofSubmitted(updated);
        return { ...updated, timeline: buildOrderTimeline(updated) };
    }

    async updateDeliveryDate(orderId: string, user: any, deliveryDate: string) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });

        if (!order) throw new NotFoundException("Order not found");

        //------------- Only seller or admin can update delivery date ----------------
        const isSeller = order.sellerId === user.userId;
        const isAdmin = user.roles.includes("ADMIN");
        const isSuperAdmin = user.roles.includes("SUPER_ADMIN");

        if (!isSeller && !isAdmin && !isSuperAdmin) {
            throw new ForbiddenException(
                "You cannot update delivery date for this order permission only seller or admin",
            );
        }

        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: {
                deliveryDate: new Date(deliveryDate),
            },
        });

        this.orderGateway.emitDeliveryDateUpdated(updated);
        return updated;
    }

    @HandleError("Failed to get orders by buyer")
    async getOrdersByBuyer(buyerId: string, status?: OrderStatus) {
        // console.log("ami call hoychi buyer order ", buyerId);

        const where: any = { buyerId };

        if (status) {
            where.status = status;
        }

        const orders = await this.prisma.order.findMany({
            where,
            include: {
                service: true,
                seller: {
                    select: { full_name: true, email: true, username: true, profilePhoto: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        return orders.map((order) => ({ ...order, timeline: buildOrderTimeline(order) }));
    }
    @HandleError("Failed to get orders by buyer")
    async myServiceOrder(sellerId: string) {
        // console.log("ami call hoychi buyer order ", buyerId);

        const where: any = { sellerId };

        // if (filter && orderStatusFilter[filter]) {
        //     where.status = { in: orderStatusFilter[filter] };
        // }
        // const seller = buyerId
        const orders = await this.prisma.order.findMany({
            where,
            include: {
                service: true,
                // seller: { select: { full_name: true, email: true } },
                buyer: {
                    select: { full_name: true, email: true, username: true, profilePhoto: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        return orders.map((order) => ({ ...order, timeline: buildOrderTimeline(order) }));
    }

    // Get seller earnings summary
    async getMyEarnings(sellerId: string) {
        // 1️⃣ Total earning: released orders - cancelled
        const totalReleased = await this.prisma.order.aggregate({
            where: { sellerId, status: OrderStatus.RELEASED },
            _sum: { seller_amount: true },
        });
        const totalSuccessfullREleaseAmount = totalReleased._sum.seller_amount || 0;

        // const totalCancelled = await this.prisma.order.aggregate({
        //     where: { sellerId, status: OrderStatus.CANCELLED },
        //     _sum: { seller_amount: true },
        // });

        const user = await this.prisma.user.findUnique({
            where: { id: sellerId },
        });

        // const onlyPending = await this.prisma.order.aggregate({
        //     where: {
        //         sellerId,
        //         status: {
        //             in: [OrderStatus.PENDING],
        //         },
        //     },
        //     _sum: { seller_amount: true },
        // });

        // const onlyPedningSum = onlyPending._sum.seller_amount || 0;
        // const totalEarning =
        //     (totalReleased._sum.seller_amount || 0) -
        //     (totalCancelled._sum.seller_amount || 0) -
        //     (onlyPending._sum.seller_amount || 0);

        // 2️⃣ Pending Clearance: IN_PROGRESS + PENDING + PROOF_SUBMITTED
        const pendingOrders = await this.prisma.order.aggregate({
            where: {
                sellerId,
                status: {
                    in: [
                        OrderStatus.IN_PROGRESS,
                        OrderStatus.PROOF_SUBMITTED,
                        OrderStatus.RESUBMIT,
                    ],
                },
            },
            _sum: { seller_amount: true },
        });

        const pendingClearance = pendingOrders._sum.seller_amount || 0;

        // 3️⃣ Available balance
        // const availableBalance = totalEarning - pendingClearance - user?.withdrawn_amount!;

        const totalEarning = totalSuccessfullREleaseAmount + pendingClearance;
        const availableBalance = totalSuccessfullREleaseAmount - user?.withdrawn_amount!;
        return {
            totalEarning: totalEarning / 100,
            pendingClearance: pendingClearance / 100,
            availableBalance: availableBalance / 100,
            withdrawn_amount: user?.withdrawn_amount! / 100,
        };
    }

    async updateCancalProofSubmitted(
        orderId: string,
        isCancalProofSubmitted: boolean,
        reason?: string,
    ) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                service: true,
                seller: {
                    select: {
                        full_name: true,
                        id: true,
                        email: true,
                        username: true,
                        profilePhoto: true,
                    },
                },
                buyer: {
                    select: {
                        full_name: true,
                        id: true,
                        email: true,
                        username: true,
                        profilePhoto: true,
                    },
                },
            },
        });

        if (!order) {
            throw new NotFoundException("Order not found");
        }

        // যদি true হয় তাহলে proofUrl empty করে দিবে — reason required
        if (isCancalProofSubmitted) {
            if (order.status !== OrderStatus.PROOF_SUBMITTED) {
                throw new BadRequestException(
                    "Proof can only be rejected after it has been submitted",
                );
            }
            const trimmedReason = reason?.trim();
            if (!trimmedReason) {
                throw new BadRequestException(
                    "Please provide a reason for rejecting the proof before submitting.",
                );
            }

            const updatedOrder = await this.prisma.order.update({
                where: { id: orderId },
                data: {
                    status: OrderStatus.RESUBMIT,
                    isCancalProofSubmitted: true,
                    proofUrl: [],
                    proofRejectReason: trimmedReason,
                    resubmitAt: new Date(),
                },
                include: {
                    service: true,
                    buyer: {
                        select: {
                            full_name: true,
                            id: true,
                            email: true,
                            username: true,
                            profilePhoto: true,
                        },
                    },
                    seller: {
                        select: {
                            full_name: true,
                            id: true,
                            email: true,
                            username: true,
                            profilePhoto: true,
                        },
                    },
                },
            });

            // -------- Send email notification to seller -----------
            try {
                await this.mail.sendEmail(
                    order.seller.email,
                    "DaConnect - Proof Submission Cancelled 📋",
                    `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f7fa; }
                            .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
                            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 40px 30px; text-align: center; }
                            .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; letter-spacing: 1px; }
                            .header-subtitle { font-size: 16px; opacity: 0.95; }
                            .content { padding: 40px 30px; }
                            .order-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 6px; }
                            .info-item { margin: 10px 0; }
                            .label { font-weight: 600; color: #374151; }
                            .value { color: #6b7280; }
                            .reason-box { background: #fff7ed; border: 1px solid #fed7aa; padding: 16px; margin: 20px 0; border-radius: 8px; }
                            .footer { text-align: center; padding: 25px; background: #f8fafc; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; }
                            .brand-name { color: #f59e0b; font-weight: 600; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <div class="logo">🎵 DaConnect</div>
                                <div class="header-subtitle">Order Proof Status Update</div>
                            </div>
                            <div class="content">
                                <h2 style="color: #1e293b; margin-bottom: 20px;">Hello ${order.seller.full_name || "Seller"}! 👋</h2>
                                <p style="font-size: 16px; color: #475569;">We wanted to inform you about an important update regarding one of your orders.</p>
                                
                                <div class="order-box">
                                    <h3 style="margin-top: 0; color: #92400e;">📋 Proof Submission Cancelled</h3>
                                    <div class="info-item">
                                        <span class="label">Order Code:</span>
                                        <span class="value">${order.orderCode}</span>
                                    </div>
                                    <div class="info-item">
                                        <span class="label">Service:</span>
                                        <span class="value">${order.service?.serviceName || "N/A"}</span>
                                    </div>
                                    <div class="info-item">
                                        <span class="label">Buyer username:</span>
                                        <span class="value">${order.buyer.username || order.buyer.email}</span>
                                    </div>
                                    <div class="info-item">
                                        <span class="label">Buyer Name:</span>
                                        <span class="value">${order.buyer.full_name || order.buyer.email}</span>
                                    </div>
                                    <div class="info-item">
                                        <span class="label">Amount:</span>
                                        <span class="value">$${(order.amount / 100).toFixed(2)}</span>
                                    </div>
                                </div>

                                <div class="reason-box">
                                    <p style="margin: 0 0 8px 0; font-weight: 600; color: #9a3412;">Rejection reason:</p>
                                    <p style="margin: 0; color: #7c2d12;">${trimmedReason.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                                </div>

                                <p style="font-size: 15px; color: #475569; margin: 25px 0;">The proof submission for this order has been cancelled and all previously uploaded proof files have been removed. Please re-upload proof that addresses the buyer's feedback.</p>
                                
                                <p style="font-size: 15px; color: #475569;">If you have any questions or concerns about this order, please don't hesitate to reach out to our support team.</p>
                                
                                <p style="font-size: 14px; color: #64748b; margin-top: 25px;">Thank you for being a valued member of the <span class="brand-name">DaConnect</span> community!</p>
                            </div>
                            
                            <div class="footer">
                                <p style="margin: 5px 0;">This is an automated email from <strong class="brand-name">DaConnect</strong>. Please do not reply.</p>
                                <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} DaConnect. All rights reserved.</p>
                                <p style="margin: 10px 0; font-size: 12px;">Empowering artists and connecting communities through music.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                    `,
                );
            } catch (error) {
                console.error("Failed to send email notification:", error);
                // -------Continue even if email fails -------
            }

            // FCM + in-app history (REST). Socket is emitted below.
            // Seller needs to know buyer rejected/cancelled their proof.
            await this.firebaseNotificationService.sendToUser(
                order.sellerId,
                {
                    title: "Proof Rejected",
                    body: `@${order.buyer?.username ?? "The buyer"} rejected your proof for order ${order.orderCode}: "${trimmedReason}". Please re-upload proof.`,
                    type: NotificationType.PROOF_REJECTED,
                    data: {
                        orderId: order.id,
                        orderCode: order.orderCode,
                        serviceRequestId: order.serviceRequestId ?? "",
                        buyerId: order.buyerId,
                        sellerId: order.sellerId,
                        action: "PROOF_CANCELLED",
                        reason: trimmedReason,
                        status: updatedOrder.status,
                        timestamp: new Date().toISOString(),
                    },
                },
                true,
            );

            this.orderGateway.emitProofCancelled(updatedOrder);
            return { ...updatedOrder, timeline: buildOrderTimeline(updatedOrder) };
        }

        // যদি false হয় তাহলে শুধু isCancalProofSubmitted আপডেট হবে, proofUrl unchanged
        const restoredOrder = await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: OrderStatus.PROOF_SUBMITTED,
                isCancalProofSubmitted: false,
                proofRejectReason: null,
                resubmitAt: null,
            },
            include: {
                service: true,
                buyer: {
                    select: {
                        full_name: true,
                        id: true,
                        email: true,
                        username: true,
                        profilePhoto: true,
                    },
                },
                seller: {
                    select: {
                        full_name: true,
                        id: true,
                        email: true,
                        username: true,
                        profilePhoto: true,
                    },
                },
            },
        });

        // Notify connected clients so the timeline updates in real-time when the
        // proof is restored.
        this.orderGateway.emitStatusChange(restoredOrder);

        return { ...restoredOrder, timeline: buildOrderTimeline(restoredOrder) };
    }
}
