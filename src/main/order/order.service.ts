import {
    BadRequestException,
    ForbiddenException,
    Inject,
    Injectable,
    NotFoundException,
} from "@nestjs/common";

import { HandleError } from "@common/error/handle-error.decorator";
import { FirebaseNotificationService } from "@main/shared/notification/firebase-notification.service";
import { OrderStatus, Role } from "@prisma/client";
import { NotificationType } from "src/lib/firebase/dto/notification.dto";
import { MailService } from "src/lib/mail/mail.service";
import { PrismaService } from "src/lib/prisma/prisma.service";
import Stripe from "stripe";

@Injectable()
export class OrdersService {
    constructor(
        private prisma: PrismaService,
        private mail: MailService,
        private readonly firebaseNotificationService: FirebaseNotificationService,
        @Inject("STRIPE_CLIENT")
        private readonly stripe: Stripe,
    ) {}

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

        return order;
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
                        },
                    });

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
                    return { ...updated, message: "Order cancelled successfully" };
                }
                if (isSeller) {
                    await this.stripe.paymentIntents.cancel(order.paymentIntentId);
                    const updated = await this.prisma.order.update({
                        where: { id: order.id },
                        data: {
                            status: OrderStatus.CANCELLED,
                        },
                    });
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
                    return { ...updated, message: "Order cancelled successfully" };
                }
            }

            if (
                order.status === OrderStatus.IN_PROGRESS ||
                order.status === OrderStatus.PROOF_SUBMITTED
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
                                seller_amount: 0,
                                buyerPay: 0,
                                stripeFee: 0,
                                PlatfromRevinue: 0,
                                platformFee: 0,
                            },
                        });
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
                        return { ...updated, message: "Order status updated successfully" };
                    }

                    ///////////////
                }

                if (isBuyer) {
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
        }

        const updated = await this.prisma.order.update({
            where: { id },
            data: { status },
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

        return { ...updated, message: "Order status updated successfully" };
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

        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: OrderStatus.PROOF_SUBMITTED,
                proofUrl: {
                    push: proofUrls,
                },
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
                title: " upload proof file ",
                body: `${updated.buyer.username} has updated the proof files for "${order.proofUrl}"`,
                type: NotificationType.UPLOAD_PROOF,
                data: {
                    serviceRequestId: order.buyer.id,
                    buyerId: updated.buyerId,
                    sellerId: updated.sellerId,
                    timestamp: new Date().toISOString(),
                },
            },
            true,
        );
        console.log(
            `📁 Update notification sent to seller ${updated.sellerId} about updated files`,
        );

        return updated;
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

        return updated;
    }

    @HandleError("Failed to get orders by buyer")
    async getOrdersByBuyer(buyerId: string, status?: OrderStatus) {
        // console.log("ami call hoychi buyer order ", buyerId);

        const where: any = { buyerId };

        if (status) {
            where.status = status;
        }

        return this.prisma.order.findMany({
            where,
            include: {
                service: true,
                seller: {
                    select: { full_name: true, email: true, username: true, profilePhoto: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    @HandleError("Failed to get orders by buyer")
    async myServiceOrder(sellerId: string) {
        // console.log("ami call hoychi buyer order ", buyerId);

        const where: any = { sellerId };

        // if (filter && orderStatusFilter[filter]) {
        //     where.status = { in: orderStatusFilter[filter] };
        // }
        // const seller = buyerId
        return this.prisma.order.findMany({
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
                    in: [OrderStatus.IN_PROGRESS, OrderStatus.PROOF_SUBMITTED],
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

    async updateCancalProofSubmitted(orderId: string, isCancalProofSubmitted: boolean) {
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

        // যদি true হয় তাহলে proofUrl empty করে দিবে
        if (isCancalProofSubmitted) {
            const updatedOrder = await this.prisma.order.update({
                where: { id: orderId },
                data: {
                    isCancalProofSubmitted: true,
                    proofUrl: [],
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

                                <p style="font-size: 15px; color: #475569; margin: 25px 0;">The proof submission for this order has been cancelled and all previously uploaded proof files have been removed. You may need to re-upload the proof when ready.</p>
                                
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

            return updatedOrder;
        }

        // যদি false হয় তাহলে শুধু isCancalProofSubmitted আপডেট হবে, proofUrl unchanged
        return await this.prisma.order.update({
            where: { id: orderId },
            data: {
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
    }
}
