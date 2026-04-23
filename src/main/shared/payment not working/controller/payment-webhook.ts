import {
    Controller,
    Headers,
    HttpStatus,
    InternalServerErrorException,
    Post,
    Req,
    Res,
} from "@nestjs/common";
import { PaymentStatus } from "@prisma/client";
import "dotenv/config";
import { MailService } from "src/lib/mail/mail.service";
import { PrismaService } from "src/lib/prisma/prisma.service";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {});

@Controller("stripe")
export class PaymentWebhookController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mailService: MailService,
    ) {}

    @Post("webhook")
    async handleWebhook(@Req() req, @Res() res, @Headers("stripe-signature") signature: string) {
        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(
                req.body,
                signature,
                process.env.STRIPE_WEBHOOK_SECRET as string,
            );
        } catch (err) {
            console.error(" Invalid webhook signature:", err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        try {
            //  Handle successful checkout
            if (event.type === "checkout.session.completed") {
                const session = event.data.object as Stripe.Checkout.Session;
                const userId = session.metadata?.userId;
                const serviceId = session.metadata?.serviceId;

                if (!userId || !serviceId)
                    return res.status(400).send("Missing userId or serviceId in metadata");

                // Fetch service info
                const service = await this.prisma.service.findUnique({
                    where: { id: serviceId },
                    include: { creator: true },
                });

                if (!service) throw new InternalServerErrorException("Service not found");

                // Map Stripe payment status → Prisma enum
                const statusMap = {
                    paid: PaymentStatus.COMPLETED,
                    unpaid: PaymentStatus.PENDING,
                    no_payment_required: PaymentStatus.COMPLETED,
                };
                const status =
                    statusMap[session.payment_status as keyof typeof statusMap] ||
                    PaymentStatus.PENDING;

                // Save Payment record
                const paymentRecord = await this.prisma.payment.create({
                    data: {
                        userId,
                        serviceId,
                        sessionId: session.id,
                        transactionId: session.payment_intent as string,
                        amount: session.amount_total || 0,
                        currency: session.currency || "usd",
                        status,
                        paymentMethod: session.payment_method_types?.[0] ?? "unknown",
                    },
                });

                // Save BuyService record (new table for purchases)
                await this.prisma.buyService.create({
                    data: {
                        buyerId: userId,
                        sellerId: service.creatorId,
                        serviceId: service.id,
                        paymentId: paymentRecord.id,
                        amount: paymentRecord.amount ?? 0,
                        status: "SUCCESS",
                    },
                });

                // Notify buyer via email
                const user = await this.prisma.user.findUnique({
                    where: { id: userId },
                });

                if (user?.email && paymentRecord.amount) {
                    const message = `
            🎉 Payment Successful!

            Service: ${service.serviceName}
            Seller: ${service.creator.username}
            Amount: $${(paymentRecord.amount / 100).toFixed(2)} ${paymentRecord.currency.toUpperCase()}
            Transaction ID: ${paymentRecord.transactionId}
            Status: ${paymentRecord.status}
          `;
                    await this.mailService.sendEmail(user.email, "Payment Confirmation", message);
                }

                return res.status(HttpStatus.OK).json({ success: true });
            }

            //  Handle failed payments
            if (
                [
                    "payment_intent.payment_failed",
                    "invoice.payment_failed",
                    "checkout.session.async_payment_failed",
                ].includes(event.type)
            ) {
                const dataObject: any = event.data.object;
                const userId = dataObject.metadata?.userId;
                const serviceId = dataObject.metadata?.serviceId;

                if (userId && serviceId) {
                    await this.prisma.payment.create({
                        data: {
                            userId,
                            serviceId,
                            sessionId: dataObject.id,
                            transactionId: dataObject.payment_intent || "",
                            amount: dataObject.amount || 0,
                            currency: dataObject.currency || "usd",
                            status: PaymentStatus.CANCELLED,
                            paymentMethod: dataObject.payment_method_types?.[0] ?? "unknown",
                        },
                    });

                    const user = await this.prisma.user.findUnique({
                        where: { id: userId },
                    });

                    if (user?.email) {
                        const message = `
              ❌ Payment Failed.
              Service ID: ${serviceId}
              Reason: ${dataObject.last_payment_error?.message || "Unknown"}
            `;
                        await this.mailService.sendEmail(user.email, "Payment Failed", message);
                    }
                }
            }

            return res.status(HttpStatus.OK).json({ received: true });
        } catch (err) {
            console.error("💥 Webhook handling error:", err);
            return res.status(500).send("Internal server error");
        }
    }
}
