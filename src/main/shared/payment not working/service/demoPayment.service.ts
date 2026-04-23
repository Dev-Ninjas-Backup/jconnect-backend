// import { Injectable, NotFoundException } from "@nestjs/common";
// import { HandleError } from "src/common/error/handle-error.decorator";
// import { PrismaService } from "src/lib/prisma/prisma.service";

// import { PaymentStatus } from "@prisma/client";
// import Stripe from "stripe";
// import { CreatePaymentDto } from "../dto/create-payment.dto";
// @Injectable()
// export class PaymentService {
//     private stripe: Stripe;

//     constructor(private readonly prisma: PrismaService) {
//         this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});
//     }

//     // ---------------- create payment ----------------

//     @HandleError("Failed to create payment")
//     async createCheckoutSession(
//         userId: string,
//         payload: CreatePaymentDto,
//     ): Promise<{ url: string }> {
//         // Find plan from DB
//         const service = await this.prisma.service.findUnique({
//             where: { id: payload.serviceId },
//         });

//         if (!service) throw new NotFoundException("Payment service not found");

//         // Create Stripe checkout session
//         const frontendUrl = process.env.FRONTEND_URL?.startsWith("http")
//             ? process.env.FRONTEND_URL
//             : `https://${process.env.FRONTEND_URL}`;

//         const session = await this.stripe.checkout.sessions.create({
//             mode: "payment",
//             payment_method_types: ["card"],
//             line_items: [
//                 {
//                     price_data: {
//                         currency: "usd",
//                         product_data: {
//                             name: service.serviceName || "Payment price",
//                             description: service.description ?? "",
//                             metadata: {
//                                 serviceCreator: service.creatorId,
//                                 currency: service.currency,
//                             },
//                         },
//                         unit_amount: service.price * 100,
//                     },
//                     quantity: 1,
//                 },
//             ],
//             success_url: `${frontendUrl}/success-payment`,
//             cancel_url: `${frontendUrl}/cancel-payment`,
//             metadata: { userId, serviceId: service.id },
//         });

//         await this.prisma.payment.create({
//             data: {
//                 sessionId: session.id,
//                 amount: service.price * 100,
//                 currency: "usd",
//                 status: PaymentStatus.PENDING,
//                 userId: userId,
//                 serviceId: service.id,
//                 paymentMethod: "STRIPE",
//             },
//         });

//         console.log("payment info", session);

//         return { url: session.url! };
//     }

//     @HandleError("Failed to fetch user payments")
//     async findmyPayment(userId: string) {
//         return this.prisma.payment.findMany({
//             where: {
//                 userId,
//                 status: PaymentStatus.COMPLETED,
//             },
//             orderBy: { createdAt: "desc" },
//         });
//     }
//     // ------------------- Admin only -------------------
//     @HandleError("Failed to fetch all payments")
//     async findAllPayments() {
//         const payments = await this.prisma.payment.findMany({
//             where: {
//                 status: PaymentStatus.COMPLETED,
//             },
//             orderBy: { createdAt: "desc" },
//             include: {
//                 user: {
//                     select: {
//                         id: true,
//                         full_name: true,
//                         profilePhoto: true,
//                         email: true,
//                     },
//                 },
//                 service: {
//                     select: {
//                         id: true,
//                         serviceName: true,
//                         price: true,
//                         description: true,
//                         currency: true,
//                         creatorId: true,
//                     },
//                 },
//             },
//         });
//         payments.forEach((payment) => {
//             payment.service.creatorId = payment.service.creatorId;
//         });

//         return payments;
//     }
//     // ------------service purchased by id ------------

//     async myPurchased(id: string) {
//         return this.prisma.payment.findFirst({
//             where: { id },
//             include: {
//                 service: true,
//                 user: {
//                     select: {
//                         id: true,
//                         full_name: true,
//                         email: true,
//                     },
//                 },
//             },
//         });
//     }
//     // ------------------------mySales------------------------
//     async mySales(userId: string) {
//         return this.prisma.payment.findMany({
//             where: {
//                 service: {
//                     creatorId: userId,
//                 },
//                 status: PaymentStatus.COMPLETED,
//             },
//             include: {
//                 user: {
//                     select: {
//                         id: true,
//                         full_name: true,
//                         email: true,
//                     },
//                 },
//                 service: true,
//             },
//             orderBy: { createdAt: "desc" },
//         });
//     }

//     findOne(id: number) {
//         return `This action returns a #${id} payment`;
//     }

//     remove(id: number) {
//         return `This action removes a #${id} payment`;
//     }
// }
