import { Injectable, NotFoundException } from "@nestjs/common";
import { PaymentStatus } from "@prisma/client";
import { HandleError } from "src/common/error/handle-error.decorator";
import { PrismaService } from "src/lib/prisma/prisma.service";
import Stripe from "stripe";
import { CreatePaymentDto } from "../dto/create-payment.dto";

@Injectable()
export class PaymentService {
    private stripe: Stripe;

    constructor(private readonly prisma: PrismaService) {
        this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    }

    @HandleError("Failed to create payment")
    async createCheckoutSession(
        userId: string,
        payload: CreatePaymentDto,
    ): Promise<{ url: string }> {
        const service = await this.prisma.service.findUnique({
            where: { id: payload.serviceId },
        });
        if (!service) throw new NotFoundException("Payment service not found");

        const frontendUrl = process.env.FRONTEND_URL?.startsWith("http")
            ? process.env.FRONTEND_URL
            : `https://${process.env.FRONTEND_URL}`;
        const session = await this.stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: service.serviceName || "Payment price",
                            description: service.description ?? "",
                            metadata: {
                                serviceCreator: service.creatorId,
                                currency: service.currency,
                            },
                        },
                        unit_amount: service.price * 100,
                    },
                    quantity: 1,
                },
            ],
            success_url: `${frontendUrl}/success-payment`,
            cancel_url: `${frontendUrl}/cancel-payment`,
            metadata: { userId, serviceId: service.id },
        });

        await this.prisma.payment.create({
            data: {
                sessionId: session.id,
                amount: service.price * 100,
                currency: "usd",
                status: PaymentStatus.PENDING,
                userId: userId,
                serviceId: service.id,
                paymentMethod: "STRIPE",
            },
        });
        console.log("payment info", session);
        return { url: session.url! };
    }

    @HandleError("Failed to fetch user payments")
    async findmyPayment(userId: string) {
        return this.prisma.payment.findMany({
            where: {
                userId,
                status: PaymentStatus.COMPLETED,
            },
            orderBy: { createdAt: "desc" },
        });
    }

    @HandleError("Failed to fetch all payments")
    async findAllPayments() {
        const payments = await this.prisma.payment.findMany({
            where: {
                status: PaymentStatus.COMPLETED,
            },
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: {
                        id: true,
                        full_name: true,
                        profilePhoto: true,
                        email: true,
                    },
                },
                service: {
                    select: {
                        id: true,
                        serviceName: true,
                        price: true,
                        description: true,
                        currency: true,
                        creatorId: true,
                    },
                },
            },
        });
        payments.forEach((payment) => {
            payment.service.creatorId = payment.service.creatorId;
        });
        return payments;
    }

    async myPurchased(id: string) {
        return this.prisma.payment.findFirst({
            where: { id },
            include: {
                service: true,
                user: {
                    select: {
                        id: true,
                        full_name: true,
                        email: true,
                    },
                },
            },
        });
    }

    async mySales(userId: string) {
        return this.prisma.payment.findMany({
            where: {
                service: {
                    creatorId: userId,
                },
                status: PaymentStatus.COMPLETED,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        full_name: true,
                        email: true,
                    },
                },
                service: true,
            },
            orderBy: { createdAt: "desc" },
        });
    }

    @HandleError("Failed to fetch transaction history")
    async getTransactionHistory() {
        console.log("📦 Fetching all payments directly from Payment table...");

        try {
            // Directly fetch all payments, no joins
            const payments = await this.prisma.payment.findMany({
                orderBy: { createdAt: "desc" },
            });

            if (!payments.length) {
                console.log("⚠️ No payments found.");
                return { data: [], total: 0, page: 1, limit: 10 };
            }

            // Map each payment to a readable object
            const formattedTransactions = payments.map((p) => ({
                orderId: p.id,
                userId: p.userId || "N/A",
                serviceId: p.serviceId || "N/A",
                amount: `$${(p.amount || 0) / 100}`,
                paymentMethod: p.paymentMethod || "Unknown",
                status: p.status || "Unknown",
                date: p.createdAt?.toISOString().split("T")[0] || "N/A",
                action: "View Details",
            }));

            console.log("✅ Payments fetched successfully:", formattedTransactions.length);
            return {
                data: formattedTransactions,
                total: formattedTransactions.length,
                page: 1,
                limit: 10,
            };
        } catch (error) {
            console.error("❌ Error fetching payments:", error);
            throw error;
        }
    }

    findOne(id: number) {
        return `This action returns a #${id} payment`;
    }

    remove(id: number) {
        return `This action removes a #${id} payment`;
    }
}
