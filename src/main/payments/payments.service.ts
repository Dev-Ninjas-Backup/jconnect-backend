import { HandleError } from "@common/error/handle-error.decorator";
import { errorResponse } from "@common/utilsResponse/response.util";
import { FirebaseNotificationService } from "@main/shared/notification/firebase-notification.service";
import {
    BadRequestException,
    HttpException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
} from "@nestjs/common";
import { OrderStatus, Role } from "@prisma/client";
import { NotificationType } from "src/lib/firebase/dto/notification.dto";
import { MailService } from "src/lib/mail/mail.service";
import { PrismaService } from "src/lib/prisma/prisma.service";
import Stripe from "stripe";
import { ConfirmSetupIntentDto } from "./dto/confirm-setup-intent.dto";
import { PaginationDto } from "./dto/pagination.dto";

@Injectable()
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);

    constructor(
        private prisma: PrismaService,
        @Inject("STRIPE_CLIENT")
        private readonly stripe: Stripe,
        private readonly mail: MailService,
        private readonly firebaseNotificationService: FirebaseNotificationService,
    ) {}

    async createCustomerID(user: any) {
        const customers = await this.stripe.customers.create({
            email: user.email,
        });

        if (!customers) throw new HttpException("customer not create", 400);
        //update user customer.id
        return await this.prisma.user.update({
            where: { id: user?.userId },
            data: {
                customerIdStripe: customers.id,
            },
        });
    }

    //------------------ create stripe payment method secret key ------------------
    @HandleError("Failed to create setup intent")
    async createSetupIntent(userReq: any) {
        const user = await this.prisma.user.findUnique({ where: { id: userReq?.userId } });
        if (!user?.customerIdStripe)
            throw new BadRequestException("User does not have a Stripe Customer ID");
        const setupIntent = await this.stripe.setupIntents.create({
            customer: user.customerIdStripe,
            automatic_payment_methods: {
                enabled: true,
                allow_redirects: "never",
            },
        });
        return { client_secret: setupIntent.client_secret };
    }

    //------------------ confirm stripe setup intent ------------------
    @HandleError("Failed to confirm setup intent")
    async confirmSetupIntent(body: ConfirmSetupIntentDto, ReqUser: any) {
        const setupIntentId = body.clientSecret.split("_secret")[0];

        const paymentMethod = await this.stripe.paymentMethods.create({
            type: "card",

            card: {
                token: body.token,
            },
        });

        const useGET = await this.prisma.user.findUnique({ where: { id: ReqUser.userId } });

        if (!useGET?.customerIdStripe)
            throw new BadRequestException("User does not have a Stripe Customer ID");
        await this.stripe.paymentMethods.attach(paymentMethod.id, {
            customer: useGET.customerIdStripe,
        });

        const result = await this.stripe.setupIntents.confirm(setupIntentId, {
            payment_method: paymentMethod.id,
        });

        await this.prisma.user.update({
            where: { id: ReqUser.userId },
            data: {
                paymentMethod: {
                    create: {
                        paymentMethod: paymentMethod.id,
                        cardBrand: paymentMethod.card?.brand || "unknown",
                        last4: paymentMethod.card?.last4 || "0000",
                        expMonth: paymentMethod.card?.exp_month || 0,
                        expYear: paymentMethod.card?.exp_year || 0,
                    },
                },
            },
        });

        return {
            status: "success",
            paymentMethodId: result.payment_method,
        };
    }

    // payment_method_attached
    async payment_method_attached(payment_method_id: string, userReq: any) {
        // console.log("ussssssssssssssssss", userReq);

        const user: any = await this.prisma.user.findUnique({ where: { id: userReq.userId } });
        // console.log("ami user ==============----", user);
        if (!user) {
            throw new HttpException("user not found ", 404);
        }
        if (!user.customerIdStripe) {
            throw new HttpException("customer id not found with this user", 404);
        }

        try {
            const methods = await this.prisma.paymentMethod.findMany({
                where: { userId: userReq.userId },
            });

            if (methods.length > 0) {
                throw new Error("User already has a payment method");
            }

            const res = await this.stripe.paymentMethods.attach(payment_method_id, {
                customer: user.customerIdStripe,
            });
            // console.log("ss44444444444444444444444444444444444sssssss", res);

            await this.prisma.paymentMethod.create({
                data: {
                    paymentMethod: res.id, // stripe payment_method id
                    userId: userReq.userId,
                    cardBrand: res.card?.brand,
                    last4: res.card?.last4,
                    expMonth: res.card?.exp_month,
                    expYear: res.card?.exp_year,
                },
            });
        } catch (error) {
            throw new HttpException(error.message, 404);
        }

        return "successfully attached payment methode";
    }

    async delete_payment_methode(paymentMethodId: string, reqUser: any) {
        const deleted = await this.prisma.paymentMethod.delete({
            where: { id: paymentMethodId },
        });

        return { message: "Payment method deleted successfully", deleted };
    }

    //withdrawal history
    async withdrawalHistory(userReq: any) {
        const withdrawal_history = await this.prisma.withdrawal.findMany({
            where: { userId: userReq?.userId },
            include: { user: { omit: { password: true } } },
            orderBy: {},
        });

        return withdrawal_history;
    }

    // ---------------- show all payment methods ----------------
    async getMyPaymentMethods(ReqUser: any) {
        if (!ReqUser) {
            throw new BadRequestException("User is required");
        }

        const paymentMethods = await this.prisma.paymentMethod.findFirst({
            where: { userId: ReqUser.userId },
        });

        if (!paymentMethods) {
            throw new HttpException("No payment methods found for this user", 404);
        }

        return paymentMethods;
    }

    //----------------  All transaction history with pagination, filtering and sorting ----------------
    @HandleError("Failed to fetch transaction history")
    async allTransactionHistory(paginationDto: PaginationDto) {
        const { page = 1, limit = 10, status, month, sortOrder = "desc", search } = paginationDto;

        const skip = (page - 1) * limit;
        const validStatuses = [
            "PENDING",
            "IN_PROGRESS",
            "PROOF_SUBMITTED",
            "CANCELLED",
            "RELEASED",
        ];
        const monthNames = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ];

        //----------------------  Build where clause for filtering ----------------------
        const where: any = {};

        if (status) {
            if (!validStatuses.includes(status)) {
                throw new BadRequestException(
                    `Invalid status. Valid statuses are: ${validStatuses.join(", ")}`,
                );
            }
            where.status = status;
        }

        if (month) {
            const monthIndex = monthNames.indexOf(month);
            if (monthIndex === -1) {
                throw new BadRequestException(
                    `Invalid month. Valid months are: ${monthNames.join(", ")}`,
                );
            }

            const currentYear = new Date().getFullYear();
            const startDate = new Date(currentYear, monthIndex, 1);
            const endDate = new Date(currentYear, monthIndex + 1, 0, 23, 59, 59);

            where.createdAt = {
                gte: startDate,
                lte: endDate,
            };
        }

        if (search) {
            where.orderCode = { contains: search, mode: "insensitive" };
        }

        const orderBy: any = { createdAt: sortOrder };

        const [transactions, total] = await this.prisma.$transaction([
            this.prisma.order.findMany({
                skip,
                take: limit,
                where,
                orderBy,
                include: {
                    seller: {
                        select: {
                            full_name: true,
                            email: true,
                            id: true,
                        },
                    },
                },
            }),
            this.prisma.order.count({ where }),
        ]);

        const lastPage = Math.ceil(total / limit);

        return {
            success: true,
            message: "Successfully fetched transactions",
            data: transactions,
            meta: {
                total,
                page,
                limit,
                lastPage,
                hasNext: page < lastPage,
                hasPrev: page > 1,
            },
        };
    }

    // ---------------- Get single transaction history with details ----------------
    @HandleError("Failed to fetch transaction details")
    async getSingleTransactionHistory(id: string) {
        let transaction: any = await this.prisma.order.findUnique({
            where: { id },
            include: {
                seller: {
                    select: {
                        id: true,
                        full_name: true,
                        email: true,
                        profilePhoto: true,
                        phone: true,
                        is_terms_agreed: true,
                        withdrawn_amount: true,
                    },
                },
                buyer: {
                    select: {
                        id: true,
                        full_name: true,
                        email: true,
                        profilePhoto: true,
                        phone: true,
                        is_terms_agreed: true,
                        withdrawn_amount: true,
                    },
                },
            },
        });

        if (!transaction) {
            throw new NotFoundException("Transaction not found");
        }

        transaction.buyer.servicePrice = transaction.amount;
        transaction.buyer.platformFeePlus =
            (transaction.amount * transaction.platformFee_percents) / 100;
        transaction.buyer.buyerPays =
            transaction.amount + (transaction.amount * transaction.platformFee_percents) / 100;
        transaction.buyer.stripeFee = transaction.stripeFee;
        //------------- transaction.buyer.sellerAmount = transaction.seller_amount; ----------------
        transaction.buyer.servicePriceMinus = transaction.amount;
        transaction.buyer.platformRevenue =
            transaction.status === "RELEASED"
                ? transaction.amount +
                  (transaction.amount * transaction.platformFee_percents) / 100 -
                  transaction.stripeFee -
                  transaction.amount
                : transaction.stripeFee && transaction.status === "CANCELLED"
                  ? (transaction.amount * transaction.platformFee_percents) / 100 -
                    transaction.stripeFee
                  : 0;

        transaction.seller.servicePrice = transaction.amount;
        transaction.seller.platformFee =
            (transaction.amount * transaction.platformFee_percents) / 100;
        transaction.seller.sellerAmount =
            transaction.amount - (transaction.amount * transaction.platformFee_percents) / 100;
        transaction.seller.platformRevenue =
            transaction.stripeFee && transaction.status === "CANCELLED"
                ? 0
                : transaction.status === "RELEASED"
                  ? transaction.amount - transaction.seller_amount
                  : 0;

        return {
            success: true,
            message: "Successfully fetched transaction",
            data: transaction,
        };
    }

    // async createCheckoutSession(userFromReq: any, serviceId: string, frontendUrl: string) {
    //     const user: any = await this.prisma.user.findUnique({ where: { id: userFromReq?.userId } });
    //     // console.log("ami to asol user", user, userFromReq.userId);
    //     const service = await this.prisma.service.findUnique({
    //         where: { id: serviceId },
    //         include: { creator: { omit: { password: true } } },
    //     });

    //     if (!service) throw new NotFoundException("Service not found");

    //     // create stripe checkout session with payment_intent expanded
    //     const session = await this.stripe.checkout.sessions.create({
    //         mode: "payment",
    //         customer: user?.customerIdStripe || undefined,
    //         payment_method_types: ["card"],
    //         payment_intent_data: {
    //             capture_method: "manual", // hold funds until capture
    //         },
    //         line_items: [
    //             {
    //                 price_data: {
    //                     currency: service.currency?.toLowerCase() || "usd",
    //                     unit_amount: Math.round(service.price * 100),
    //                 },
    //                 quantity: 1,
    //             },
    //         ],
    //         success_url: `${frontendUrl}/success-payment?session_id={CHECKOUT_SESSION_ID}`,
    //         cancel_url: `${frontendUrl}/cancel-payment`,
    //         metadata: { userId: userFromReq.userId, serviceId },
    //         expand: ["payment_intent"],
    //     });

    //     // ******* if you want to include application fee and transfer to connected account
    //     //  then you need to instant payment you cant use manual capture
    //     // -----------------------------
    //     // const session = await this.stripe.checkout.sessions.create({
    //     //     mode: "payment",
    //     //     customer: user.customerIdStripe || undefined,
    //     //     payment_method_types: ["card"],
    //     //     payment_intent_data: {
    //     //         capture_method: "manual", //
    //     //         application_fee_amount: Math.round(service.price * 100 * 0.1),
    //     //         transfer_data: {
    //     //             // seller's Stripe account ID
    //     //             destination: service.creator?.sellerIDStripe,
    //     //         },
    //     //     },
    //     //     line_items: [
    //     //         {
    //     //             price_data: {
    //     //                 currency: service.currency?.toLowerCase() ?? "usd",
    //     //                 product_data: {
    //     //                     name: service.serviceName,
    //     //                     description: service.description || "",
    //     //                 },
    //     //                 unit_amount: Math.round(service.price * 100),
    //     //             },
    //     //             quantity: 1,
    //     //         },
    //     //     ],
    //     //     success_url: `${frontendUrl}/success-payment?session_id={CHECKOUT_SESSION_ID}`,
    //     //     cancel_url: `${frontendUrl}/cancel-payment`,
    //     //     metadata: { userId: userFromReq.userId, serviceId },
    //     //     expand: ["payment_intent"],
    //     // });

    //     const paymentIntent = session.payment_intent as Stripe.PaymentIntent | undefined;
    //     const paymentIntentId =
    //         typeof session.payment_intent === "string" ? session.payment_intent : paymentIntent?.id;

    //     const order = await this.prisma.order.create({
    //         data: {
    //             orderCode: `ORD-${Date.now()}`,
    //             buyerId: userFromReq.userId,
    //             sellerId: service.creatorId || "unknown",
    //             sellerIdStripe: service.creator?.sellerIDStripe || "",
    //             sessionId: session.id,
    //             serviceId: service.id,
    //             paymentIntentId: paymentIntentId ?? undefined,
    //             amount: service.price,
    //             platformFee: 0, // set later (or compute here)
    //             status: OrderStatus.PENDING,
    //         },
    //     });

    //     await this.mail.sendEmail(
    //         service.creator?.email,
    //         "Order Placed Successfully",
    //         `
    //     <h1>Your order is successfully placed!</h1>
    //     <p>Order Code: ${order.orderCode}</p>
    //     <p>Amount: $${order.amount}</p>
    //      <p>Buyer: ${userFromReq.email}</p>
    //     <p>Status: ${order.status}</p>
    //     `,
    //     );

    //     await this.mail.sendEmail(
    //         userFromReq.email,
    //         "You Got a New Order",
    //         `
    //     <h1>New Order Received!</h1>
    //     <p>Order Code: ${order.orderCode}</p>
    //     <p>Service: ${service.serviceName}</p>
    //     <p>Seller: ${service.creator?.email}</p>
    //     <p>Amount: $${order.amount}</p>
    //     `,
    //     );

    //     return {
    //         url: session.url,
    //         sessionId: session.id,
    //         paymentIntentId,
    //         orderId: order.id,
    //     };
    // }

    // trasnfer to seller account / withdraw for seller
    @HandleError("Failed to transfer to seller")
    async transferToSeller(userID: string, amount: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userID },
            omit: { password: true },
        });
        if (!user) {
            throw new NotFoundException("User not found");
        }

        const seller = user;
        if (!seller) return errorResponse("Seller not found");
        if (seller.sellerIDStripe) {
            try {
                const account: any = await this.stripe.accounts.retrieve(seller.sellerIDStripe);
                const isDisabled = !!account.disabled_reason;
                const isRequirementsPending = account.requirements?.currently_due?.length > 0;
                if (isDisabled || isRequirementsPending) {
                    const link = await this.stripe.accountLinks.create({
                        account: account.id,
                        refresh_url: process.env.BACKEND_URL + "/reauth",
                        return_url: process.env.FRONTEND_URL + "/stripe_success",

                        type: "account_onboarding",
                    });
                    return {
                        status: "re_onboarding_required",
                        message: "Your Stripe account needs verification",
                        url: link.url,
                    };
                }
            } catch (err) {
                const newAccount = await this.stripe.accounts.create({
                    type: "express",
                    email: seller.email,
                    capabilities: { transfers: { requested: true } },
                });
                await this.prisma.user.update({
                    where: { id: seller.id },
                    data: { sellerIDStripe: newAccount.id },
                });
                const link = await this.stripe.accountLinks.create({
                    account: newAccount.id,
                    refresh_url: process.env.BACKEND_URL + "/reauth",
                    return_url: process.env.FRONTEND_URL + "/onboarding-success",
                    type: "account_onboarding",
                });

                return {
                    status: "onboarding_required",
                    url: link.url,
                };
            }
        }

        // ------------------------------------------------------------
        // STEP 2: IF NO STRIPE ACCOUNT → CREATE NEW
        // ------------------------------------------------------------
        if (!seller.sellerIDStripe) {
            const account = await this.stripe.accounts.create({
                type: "express",
                email: seller.email,
                capabilities: {
                    transfers: { requested: true },
                },
            });

            await this.prisma.user.update({
                where: { id: userID },
                data: { sellerIDStripe: account.id },
            });

            const link = await this.stripe.accountLinks.create({
                account: account.id,
                refresh_url: process.env.BACKEND_URL + "/reauth",
                return_url: process.env.FRONTEND_URL + "/onboarding-success",
                type: "account_onboarding",
            });

            return {
                status: "onboarding_required",
                url: link.url,
            };
        }

        const account: any = await this.stripe.accounts.retrieve(seller.sellerIDStripe);
        const totalReleased = await this.prisma.order.aggregate({
            where: { sellerId: userID },
            _sum: { seller_amount: true },
        });

        const totalCancelled = await this.prisma.order.aggregate({
            where: { sellerId: userID, status: OrderStatus.CANCELLED },
            _sum: { seller_amount: true },
        });

        const onlyPending = await this.prisma.order.aggregate({
            where: {
                sellerId: userID,
                status: {
                    in: [OrderStatus.PENDING],
                },
            },
            _sum: { seller_amount: true },
        });

        const onlyPedningSum = onlyPending._sum.seller_amount || 0;
        const totalEarning =
            (totalReleased._sum.seller_amount || 0) -
            (totalCancelled._sum.seller_amount || 0) -
            (onlyPending._sum.seller_amount || 0);

        const pendingOrders = await this.prisma.order.aggregate({
            where: {
                sellerId: userID,
                status: {
                    in: [OrderStatus.IN_PROGRESS, OrderStatus.PROOF_SUBMITTED],
                },
            },
            _sum: { seller_amount: true },
        });

        const pendingClearance = pendingOrders._sum.seller_amount || 0;

        const availableBalance = totalEarning - pendingClearance - user?.withdrawn_amount!;

        const setting = await this.prisma.setting.findUnique({
            where: { id: "platform_settings" },
        });

        const sellerStripeAccountId = user?.sellerIDStripe;

        if (!sellerStripeAccountId) {
            throw new BadRequestException("Seller Stripe account not found");
        }

        amount = amount * 100;

        if (!amount || amount < Number(setting?.minimum_payout!) * 100) {
            throw new BadRequestException(
                `Invalid transfer amount please follow minimum payout : ${setting?.minimum_payout!}`,
            );
        }

        if (amount > availableBalance) {
            throw new BadRequestException(`Insufficient balance to transfer`);
        }
        const balance = await this.stripe.balance.retrieve();

        const available = balance.available[0].amount;

        if (amount > available) {
            throw new Error(
                `Cannot transfer ${amount / 100}, Platform balance only ${available / 100} is available. please wait and try again later`,
            );
        }

        const amountInCents = amount;

        // Transfer money from your platform balance → seller’s connected account
        const transfer = await this.stripe.transfers.create({
            amount: amountInCents,
            currency: "usd",
            destination: sellerStripeAccountId,
        });

        const withdrawalHistory = await this.prisma.withdrawal.create({
            data: {
                amount,
                userId: userID,
                ballance: availableBalance - amount,
            },
        });

        // const payout = await this.stripe.payouts.create( { amount: amountInCents, currency: "usd", }, { stripeAccount: sellerStripeAccountId, } );

        await this.prisma.user.update({
            where: { id: userID },
            data: { withdrawn_amount: { increment: amountInCents } },
        });
        await this.mail.sendEmail(
            user.email,
            "DaConnect - Withdrawal Successful 💸",
            `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f7fa; }
                    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
                    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; }
                    .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; letter-spacing: 1px; }
                    .content { padding: 40px 30px; }
                    .amount-box { background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #10b981; padding: 25px; text-align: center; margin: 25px 0; border-radius: 10px; }
                    .amount { font-size: 36px; font-weight: bold; color: #059669; margin: 10px 0; }
                    .info-box { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 16px; margin: 25px 0; border-radius: 6px; }
                    .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
                    .footer { text-align: center; padding: 25px; background: #f8fafc; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; }
                    .brand-name { color: #10b981; font-weight: 600; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🎵 DaConnect</div>
                        <div style="font-size: 16px; opacity: 0.95;">Withdrawal Confirmation</div>
                    </div>
                    <div class="content">
                        <h2 style="color: #1e293b; margin-bottom: 20px;">✅ Withdrawal Successful!</h2>
                        <p style="font-size: 16px; color: #475569;">Great news! Your withdrawal request has been processed successfully.</p>
                        
                        <div class="amount-box">
                            <p style="margin: 0; font-size: 14px; color: #64748b; text-transform: uppercase;">Withdrawn Amount</p>
                            <div class="amount">$${(amountInCents / 100).toFixed(2)}</div>
                        </div>
                        
                        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0;">
                            <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">Transaction Details</h3>
                            <div class="detail-row">
                                <span style="color: #64748b;">Status:</span>
                                <strong style="color: #10b981;">Processing</strong>
                            </div>
                            <div class="detail-row" style="border: none;">
                                <span style="color: #64748b;">Expected in Account:</span>
                                <strong style="color: #1e293b;">Within 48 hours</strong>
                            </div>
                        </div>
                        
                        <div class="info-box">
                            <strong style="color: #1e40af;">📌 Important:</strong>
                            <p style="margin: 10px 0 0 0; color: #475569;">Your funds will be deposited to your connected Stripe account within <strong>48 hours</strong>. From there, they'll be transferred to your external bank account based on your Stripe payout schedule.</p>
                        </div>
                        
                        <p style="font-size: 14px; color: #64748b; margin-top: 25px;">You can track your payout status in your Stripe dashboard. If you have any questions, our support team is here to help!</p>
                    </div>
                    <div class="footer">
                        <p style="margin: 5px 0;"><strong class="brand-name">DaConnect</strong> - Empowering Artists</p>
                        <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} DaConnect. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
    `,
        );

        return {
            success: true,
            message: "Transfer completed",
            transfer,
        };
    }

    // ------------------ create order with payment method  with notification ------------------
    @HandleError("createOrderWithPaymentMethod error")
    async createOrderWithPaymentMethod(userFromReq: any, serviceId: string, frontendUrl: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userFromReq.userId },
            include: { paymentMethod: true },
        });
        const service = await this.prisma.service.findUnique({
            where: { id: serviceId },
            include: { creator: { omit: { password: true } } },
        });

        if (!user) throw new NotFoundException("User not found");
        if (!user.customerIdStripe)
            throw new BadRequestException("User does not have a Stripe Customer ID");
        if (!service) throw new NotFoundException("Service not found");

        const setting = await this.prisma.setting.findUnique({
            where: { id: "platform_settings" },
        });
        if (!setting?.platformFee_percents)
            throw new BadRequestException("Platform fee is not set in settings");

        service.price = service.price * 100;

        const feeAmount = service.price * (setting?.platformFee_percents / 100);
        const finalPrice = service.price + feeAmount;
        const paymentIntent = await this.stripe.paymentIntents.create({
            amount: Math.round(finalPrice),
            currency: service.currency?.toLowerCase() || "usd",
            customer: user?.customerIdStripe,
            payment_method: user.paymentMethod?.[0]?.paymentMethod,
            off_session: true,
            confirm: true,
            capture_method: "manual",
            metadata: {
                userId: userFromReq.userId,
                serviceId: service.id,
            },
        });
        const priceInCents = Math.round(service.price);
        const sellerAmount = priceInCents - (priceInCents * setting.platformFee_percents) / 100;
        const order = await this.prisma.order.create({
            data: {
                orderCode: `ORD-${Date.now()}`,
                buyerId: userFromReq.userId,
                sellerId: service.creatorId || "unknown",
                sellerIdStripe: service.creator?.sellerIDStripe || "",
                paymentIntentId: paymentIntent.id,
                serviceId: service.id,
                platformFee: feeAmount,
                platformFee_percents: setting?.platformFee_percents,
                amount: service.price,
                seller_amount: sellerAmount,
                status: OrderStatus.PENDING,
            },
        });
        // ------------------- notify seller with firebase notification -------------------
        await this.firebaseNotificationService.sendToUser(
            service.creatorId!,
            {
                title: `New Order: ${service.serviceName}`,
                body: `Your order for "${service.serviceName}" has been placed successfully`,
                type: NotificationType.ORDER_UPDATE,
                data: {
                    orderId: order.id,
                    orderCode: order.orderCode,
                    amount: order.amount.toString(),
                    timestamp: new Date().toISOString(),
                },
            },
            true,
        );

        //-------------- send email to user --------------
        await this.mail.sendEmail(
            userFromReq.email,
            "DaConnect - Order Placed Successfully 🎉",
            `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f7fa; }
                    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
                    .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 40px 30px; text-align: center; }
                    .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; letter-spacing: 1px; }
                    .content { padding: 40px 30px; }
                    .order-box { background: #f8fafc; border: 2px solid #3b82f6; padding: 25px; margin: 25px 0; border-radius: 10px; }
                    .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
                    .amount { font-size: 28px; font-weight: bold; color: #2563eb; }
                    .status-badge { display: inline-block; padding: 8px 16px; background: #fef3c7; color: #92400e; border-radius: 20px; font-size: 14px; font-weight: 600; }
                    .info-box { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 16px; margin: 25px 0; border-radius: 6px; }
                    .footer { text-align: center; padding: 25px; background: #f8fafc; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; }
                    .brand-name { color: #3b82f6; font-weight: 600; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🎵 DaConnect</div>
                        <div style="font-size: 16px; opacity: 0.95;">Order Confirmation</div>
                    </div>
                    <div class="content">
                        <h2 style="color: #1e293b; margin-bottom: 20px;">✅ Order Placed Successfully!</h2>
                        <p style="font-size: 16px; color: #475569;">Thank you for your order! We've received your payment and the seller has been notified.</p>
                        
                        <div class="order-box">
                            <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">Order Details</h3>
                            <div class="detail-row">
                                <span style="color: #64748b;">Order Code:</span>
                                <strong style="color: #1e293b;">${order.orderCode}</strong>
                            </div>
                            <div class="detail-row">
                                <span style="color: #64748b;">Amount:</span>
                                <span class="amount">$${(order.amount / 100).toFixed(2)}</span>
                            </div>
                            <div class="detail-row">
                                <span style="color: #64748b;">Seller:</span>
                                <strong style="color: #1e293b;">${service.creator?.username}</strong>
                            </div>
                            <div class="detail-row" style="border: none;">
                                <span style="color: #64748b;">Status:</span>
                                <span class="status-badge">${order.status}</span>
                            </div>
                        </div>
                        
                        <div class="info-box">
                            <strong style="color: #1e40af;">👉 What's Next?</strong>
                            <p style="margin: 10px 0 0 0; color: #475569;">The seller will start working on your order. You'll receive updates via email. Your payment is held securely until you confirm delivery.</p>
                        </div>
                        
                        <p style="font-size: 14px; color: #64748b; margin-top: 25px;">Need help? Our support team is available 24/7 to assist you with your order.</p>
                    </div>
                    <div class="footer">
                        <p style="margin: 5px 0;"><strong class="brand-name">DaConnect</strong> - Connecting Artists & Music Lovers</p>
                        <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} DaConnect. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
    `,
        );

        await this.mail.sendEmail(
            service.creator?.email,
            "DaConnect - New Order Received! 🔔",
            `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f7fa; }
                    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
                    .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 40px 30px; text-align: center; }
                    .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; letter-spacing: 1px; }
                    .content { padding: 40px 30px; }
                    .order-box { background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); border: 2px solid #8b5cf6; padding: 25px; margin: 25px 0; border-radius: 10px; }
                    .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
                    .amount { font-size: 28px; font-weight: bold; color: #7c3aed; }
                    .cta-button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
                    .info-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 25px 0; border-radius: 6px; }
                    .footer { text-align: center; padding: 25px; background: #f8fafc; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; }
                    .brand-name { color: #8b5cf6; font-weight: 600; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🎵 DaConnect</div>
                        <div style="font-size: 16px; opacity: 0.95;">New Order Alert</div>
                    </div>
                    <div class="content">
                        <h2 style="color: #1e293b; margin-bottom: 20px;">🎉 Congratulations! New Order Received</h2>
                        <p style="font-size: 16px; color: #475569;">You've received a new order on <span class="brand-name">DaConnect</span>. Time to showcase your talent!</p>
                        
                        <div class="order-box">
                            <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">Order Information</h3>
                            <div class="detail-row">
                                <span style="color: #64748b;">Order Code:</span>
                                <strong style="color: #1e293b;">${order.orderCode}</strong>
                            </div>
                            <div class="detail-row">
                                <span style="color: #64748b;">Service:</span>
                                <strong style="color: #1e293b;">${service.serviceName}</strong>
                            </div>
                          
                            <div class="detail-row" style="border: none;">
                                <span style="color: #64748b;">Order Value:</span>
                                <span class="amount">$${(order.amount / 100).toFixed(2)}</span>
                            </div>
                        </div>
                        
                        <div class="info-box">
                            <strong style="color: #92400e;">💼 Action Required:</strong>
                            <p style="margin: 10px 0 0 0; color: #475569;">Please review the order details and start working on it. The buyer's payment is secured and will be released to you upon successful delivery.</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <p style="color: #64748b; margin-bottom: 15px;">Log in to your dashboard to view full order details</p>
                        </div>
                    </div>
                    <div class="footer">
                        <p style="margin: 5px 0;"><strong class="brand-name">DaConnect</strong> - Empowering Artists</p>
                        <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} DaConnect. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
    `,
        );

        return {
            paymentIntentId: paymentIntent.id,
            orderId: order.id,
            amount: service.price,
        };
    }
    // ------------------ approve payment and release fund with notification ------------------

    @HandleError("approvePayment error")
    async approvePayment(orderId: string, user: any) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                buyer: { omit: { password: true } },
                seller: { omit: { password: true } },
                service: { include: { creator: { omit: { password: true } } } },
            },
        });
        const paymentIntentId = order?.paymentIntentId;
        const sellerStripeAccountId = order?.sellerIdStripe;

        console.log(user.roles.includes(Role.ADMIN));

        if (
            order?.buyerId !== user.userId &&
            !user.roles.includes(Role.ADMIN) &&
            !user.roles.includes(Role.SUPER_ADMIN)
        ) {
            throw new HttpException("Only buyer or admin can approve payment", 403);
        }

        if (!paymentIntentId)
            throw new BadRequestException(
                "buyer not place the payment or Order does not have a paymentIntentId",
            );
        if (!order) throw new NotFoundException("Order not found for this payment intent");
        if (order.status == OrderStatus.RELEASED)
            throw new HttpException("Order already released", 404);

        const setting = await this.prisma.setting.findUnique({
            where: { id: "platform_settings" },
        });
        if (!setting?.platformFee_percents)
            throw new BadRequestException("Platform fee is not set in settings");

        const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

        let capturedIntent: Stripe.PaymentIntent = intent;
        if (intent.status !== "succeeded" && intent.capture_method === "manual") {
            capturedIntent = (await this.stripe.paymentIntents.capture(
                paymentIntentId,
            )) as Stripe.PaymentIntent;
            this.logger.log(`Captured PaymentIntent ${paymentIntentId}`);
        }

        const chargesList = await this.stripe.charges.list({
            payment_intent: capturedIntent.id,
        });

        const charge = chargesList.data[0];
        this.logger.log("চার্জ তথ্য:", charge);
        if (!charge) {
            this.logger.log("এই PaymentIntent‑এর সাথে কোনো চার্জ পাওয়া যায়নি।");
            return;
        }

        const balanceTransaction = await this.stripe.balanceTransactions.retrieve(
            charge.balance_transaction as string,
        );

        // const balanceTransaction = await this.stripe.balanceTransactions.retrieve(charge.balance_transaction as string);
        let PlatfromRevinue = balanceTransaction.net - order.seller_amount;

        const updated = await this.prisma.order.update({
            where: { id: order.id },
            data: {
                status: OrderStatus.RELEASED,
                isReleased: true,
                releasedAt: new Date(),
                PlatfromRevinue,
                buyerPay: balanceTransaction.net,
                platformFee: (order.amount * setting.platformFee_percents) / 100,
                stripeFee: Number(balanceTransaction.fee),
                platformFee_percents: setting.platformFee_percents,
            },
        });

        try {
            await this.firebaseNotificationService.sendToUser(
                order.sellerId,
                {
                    title: " Payment Released",
                    body: `Your payment of $${(order.amount / 100).toFixed(2)} for "${order.service.serviceName}" has been released`,
                    type: NotificationType.PAYMENT_RECEIVED,
                    data: {
                        orderId: order.id,
                        orderCode: order.orderCode,
                        amount: order.amount.toString(),
                        timestamp: new Date().toISOString(),
                    },
                },
                true,
            );
            console.log(` Payment released notification sent to seller ${order.sellerId}`);
        } catch (error) {
            console.error(` Failed to send payment released notification: ${error.message}`);
        }

        await this.mail.sendEmail(
            order.buyer.email,
            "DaConnect - Order Payment Confirmed ✅",
            `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f7fa; }
                    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
                    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; }
                    .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; letter-spacing: 1px; }
                    .content { padding: 40px 30px; }
                    .success-icon { font-size: 64px; text-align: center; margin: 20px 0; }
                    .order-box { background: #f8fafc; border: 2px solid #10b981; padding: 25px; margin: 25px 0; border-radius: 10px; }
                    .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
                    .amount { font-size: 28px; font-weight: bold; color: #059669; }
                    .footer { text-align: center; padding: 25px; background: #f8fafc; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; }
                    .brand-name { color: #10b981; font-weight: 600; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🎵 DaConnect</div>
                        <div style="font-size: 16px; opacity: 0.95;">Payment Confirmation</div>
                    </div>
                    <div class="content">
                        <div class="success-icon">✅</div>
                        <h2 style="color: #1e293b; margin-bottom: 20px; text-align: center;">Payment Successfully Processed!</h2>
                        <p style="font-size: 16px; color: #475569; text-align: center;">Your payment for <strong>${order.service.serviceName}</strong> has been confirmed.</p>
                        
                        <div class="order-box">
                            <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">Transaction Details</h3>
                            <div class="detail-row">
                                <span style="color: #64748b;">Order Code:</span>
                                <strong style="color: #1e293b;">${order.orderCode}</strong>
                            </div>
                            <div class="detail-row" style="border: none;">
                                <span style="color: #64748b;">Amount Paid:</span>
                                <span class="amount">$${(order.amount / 100).toFixed(2)}</span>
                            </div>
                        </div>
                        
                        <p style="font-size: 14px; color: #64748b; margin-top: 25px; text-align: center;">Thank you for using DaConnect! Your order is now being processed.</p>
                    </div>
                    <div class="footer">
                        <p style="margin: 5px 0;"><strong class="brand-name">DaConnect</strong> - Connecting Artists & Music Lovers</p>
                        <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} DaConnect. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        );

        await this.mail.sendEmail(
            order?.seller.email,
            "DaConnect - Payment Released! 💰",
            `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f7fa; }
                    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
                    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; }
                    .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; letter-spacing: 1px; }
                    .content { padding: 40px 30px; }
                    .success-icon { font-size: 64px; text-align: center; margin: 20px 0; }
                    .earnings-box { background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #10b981; padding: 30px; text-align: center; margin: 25px 0; border-radius: 10px; }
                    .earnings { font-size: 36px; font-weight: bold; color: #059669; margin: 10px 0; }
                    .order-box { background: #f8fafc; padding: 20px; margin: 25px 0; border-radius: 8px; }
                    .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
                    .info-box { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 16px; margin: 25px 0; border-radius: 6px; }
                    .footer { text-align: center; padding: 25px; background: #f8fafc; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; }
                    .brand-name { color: #10b981; font-weight: 600; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🎵 DaConnect</div>
                        <div style="font-size: 16px; opacity: 0.95;">Payment Released</div>
                    </div>
                    <div class="content">
                        <div class="success-icon">🎉</div>
                        <h2 style="color: #1e293b; margin-bottom: 20px; text-align: center;">Congratulations! Payment Released</h2>
                        <p style="font-size: 16px; color: #475569; text-align: center;">Great news! The payment for your order has been released to your account.</p>
                        
                        <div class="earnings-box">
                            <p style="margin: 0; font-size: 14px; color: #64748b; text-transform: uppercase;">Your Earnings</p>
                            <div class="earnings">$${(order.amount / 100).toFixed(2)}</div>
                            <p style="margin: 0; font-size: 13px; color: #94a3b8;">Successfully transferred</p>
                        </div>
                        
                        <div class="order-box">
                            <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">Order Details</h3>
                            <div class="detail-row">
                                <span style="color: #64748b;">Order Code:</span>
                                <strong style="color: #1e293b;">${order.orderCode}</strong>
                            </div>
                            <div class="detail-row">
                                <span style="color: #64748b;">Service:</span>
                                <strong style="color: #1e293b;">${order.service.serviceName}</strong>
                            </div>
                            <div class="detail-row" style="border: none;">
                                <span style="color: #64748b;">Buyer:</span>
                                <strong style="color: #1e293b;">${order.buyer.username}</strong>
                            </div>
                        </div>
                        
                        <div class="info-box">
                            <strong style="color: #1e40af;">💳 Available Balance:</strong>
                            <p style="margin: 10px 0 0 0; color: #475569;">Your earnings are now available in your DaConnect balance. You can request a withdrawal to your bank account at any time.</p>
                        </div>
                        
                        <p style="font-size: 14px; color: #64748b; margin-top: 25px; text-align: center;">Thank you for delivering excellent service on DaConnect!</p>
                    </div>
                    <div class="footer">
                        <p style="margin: 5px 0;"><strong class="brand-name">DaConnect</strong> - Empowering Artists</p>
                        <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} DaConnect. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        );

        //------------------ Send payment released notification to seller ------------------//
        try {
            await this.firebaseNotificationService.sendToUser(
                order.sellerId,
                {
                    title: " Payment Released",
                    body: `Your payment of $${(order.amount / 100).toFixed(2)} for "${order.service.serviceName}" has been released`,
                    type: NotificationType.PAYMENT_RECEIVED,
                    data: {
                        orderId: order.id,
                        orderCode: order.orderCode,
                        amount: order.amount.toString(),
                        timestamp: new Date().toISOString(),
                    },
                },
                true,
            );
            console.log(` Payment released notification sent to seller ${order.sellerId}`);
        } catch (error) {
            console.error(` Failed to send payment released notification: ${error.message}`);
        }

        return {
            platformFee: setting?.platformFee_percents,
            order: updated,
            stripefee: balanceTransaction.fee,
            stripeneet: balanceTransaction.net,
        };
    }

    @HandleError("refundPayment error")
    async refundPayment(orderId: string, user: any) {
        // 1) Load order with relations
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                buyer: { omit: { password: true } },
                seller: { omit: { password: true } },
                service: true,
            },
        });

        if (!order) throw new NotFoundException("Order not found");

        // Only buyer or admin can request refund
        const isBuyer = order.buyerId === user.userId;
        const isAdmin = user.roles.includes(Role.ADMIN);
        const isSuperAdmin = user.roles.includes(Role.SUPER_ADMIN);

        if (!isBuyer && !isAdmin && !isSuperAdmin) {
            throw new HttpException("You cannot request a refund for this order.", 403);
        }

        if (!order.paymentIntentId) {
            throw new BadRequestException(
                "buyer not paid yet/PaymentIntent ID not found for this order",
            );
        }

        const sellerId = order.seller.id;

        const intent = await this.stripe.paymentIntents.retrieve(order.paymentIntentId);

        if (intent.status === "requires_capture") {
            await this.stripe.paymentIntents.cancel(order.paymentIntentId);

            await this.prisma.order.update({
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

            await this.mail.sendEmail(
                order.buyer.email,
                "DaConnect - Payment Cancelled ❌",
                `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f7fa; }
                        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
                        .header { background: linear-gradient(135deg, #64748b 0%, #475569 100%); color: white; padding: 40px 30px; text-align: center; }
                        .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; letter-spacing: 1px; }
                        .content { padding: 40px 30px; }
                        .status-box { background: #f8fafc; border: 2px solid #64748b; padding: 25px; text-align: center; margin: 25px 0; border-radius: 10px; }
                        .info-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 25px 0; border-radius: 6px; }
                        .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
                        .footer { text-align: center; padding: 25px; background: #f8fafc; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; }
                        .brand-name { color: #3b82f6; font-weight: 600; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="logo">🎵 DaConnect</div>
                            <div style="font-size: 16px; opacity: 0.95;">Payment Status Update</div>
                        </div>
                        <div class="content">
                            <h2 style="color: #1e293b; margin-bottom: 20px;">Payment Cancelled</h2>
                            <p style="font-size: 16px; color: #475569;">Your payment authorization for this order has been cancelled. No charges were made to your payment method.</p>
                            
                            <div class="status-box">
                                <div style="font-size: 48px; margin-bottom: 15px;">❌</div>
                                <h3 style="margin: 0; color: #64748b;">Order Cancelled</h3>
                                <p style="margin: 10px 0 0 0; font-size: 14px; color: #94a3b8;">Order Code: ${order.orderCode}</p>
                            </div>
                            
                            <div class="info-box">
                                <strong style="color: #92400e;">📌 Important:</strong>
                                <p style="margin: 10px 0 0 0; color: #475569;">Since the payment was cancelled before capture, no refund is necessary. Your payment method was not charged.</p>
                            </div>
                            
                            <p style="font-size: 14px; color: #64748b; margin-top: 25px;">If you have any questions about this cancellation, please contact our support team.</p>
                        </div>
                        <div class="footer">
                            <p style="margin: 5px 0;"><strong class="brand-name">DaConnect</strong> - Connecting Artists & Music Lovers</p>
                            <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} DaConnect. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
                `,
            );

            //------------------ Send payment cancellation notification ------------------//
            try {
                await this.firebaseNotificationService.sendToUser(
                    order.buyerId,
                    {
                        title: "❌ Payment Cancelled",
                        body: `Your payment authorization for order ${order.orderCode} has been cancelled. No charges were made.`,
                        type: NotificationType.PAYMENT_RECEIVED,
                        data: {
                            orderId: order.id,
                            orderCode: order.orderCode,
                            timestamp: new Date().toISOString(),
                        },
                    },
                    true,
                );
                console.log(`❌ Payment cancellation notification sent to buyer ${order.buyerId}`);
            } catch (error) {
                console.error(
                    `❌ Failed to send payment cancellation notification: ${error.message}`,
                );
            }

            return { message: "Payment authorization cancelled. No refund needed." };
        }

        const totalReleased = await this.prisma.order.aggregate({
            where: { sellerId, status: OrderStatus.RELEASED },
            _sum: { seller_amount: true },
        });
        const totalSuccessfullREleaseAmount = totalReleased._sum.seller_amount || 0;

        const availableBalance = totalSuccessfullREleaseAmount - order.seller?.withdrawn_amount!;

        console.log("ami available ballance", availableBalance);

        if (!availableBalance || availableBalance < Number(order.seller_amount)) {
            throw new BadRequestException(
                "No available balance to refund because seller account is empty",
            );
        }

        // 3) Payment was captured → refund the payment
        const refund = await this.stripe.refunds.create({
            payment_intent: order.paymentIntentId,
            amount: Math.round(Number(order.amount)),
        });

        // 4) Update order status
        const updated = await this.prisma.order.update({
            where: { id: order.id },
            data: {
                status: OrderStatus.CANCELLED,
                isReleased: false,
                PlatfromRevinue: order.buyerPay - order.amount,
                seller_amount: 0,
                buyerPay: 0,
            },
        });

        // 5) Send Email to Buyer
        await this.mail.sendEmail(
            order.buyer.email,
            "DaConnect - Refund Processed Successfully 🔄",
            `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f7fa; }
                    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
                    .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 40px 30px; text-align: center; }
                    .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; letter-spacing: 1px; }
                    .content { padding: 40px 30px; }
                    .refund-box { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 2px solid #3b82f6; padding: 30px; text-align: center; margin: 25px 0; border-radius: 10px; }
                    .refund-amount { font-size: 36px; font-weight: bold; color: #2563eb; margin: 10px 0; }
                    .order-box { background: #f8fafc; padding: 20px; margin: 25px 0; border-radius: 8px; }
                    .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
                    .info-box { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 16px; margin: 25px 0; border-radius: 6px; }
                    .status-badge { display: inline-block; padding: 8px 16px; background: #fee2e2; color: #991b1b; border-radius: 20px; font-size: 14px; font-weight: 600; }
                    .footer { text-align: center; padding: 25px; background: #f8fafc; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; }
                    .brand-name { color: #3b82f6; font-weight: 600; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🎵 DaConnect</div>
                        <div style="font-size: 16px; opacity: 0.95;">Refund Confirmation</div>
                    </div>
                    <div class="content">
                        <h2 style="color: #1e293b; margin-bottom: 20px;">✅ Refund Successfully Processed</h2>
                        <p style="font-size: 16px; color: #475569;">Your refund request has been approved and processed. The amount will be credited back to your original payment method.</p>
                        
                        <div class="refund-box">
                            <p style="margin: 0; font-size: 14px; color: #64748b; text-transform: uppercase;">Refunded Amount</p>
                            <div class="refund-amount">$${(order.amount / 100).toFixed(2)}</div>
                            <p style="margin: 0; font-size: 13px; color: #94a3b8;">Processing time: 5-10 business days</p>
                        </div>
                        
                        <div class="order-box">
                            <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">Order Details</h3>
                            <div class="detail-row">
                                <span style="color: #64748b;">Order Code:</span>
                                <strong style="color: #1e293b;">${order.orderCode}</strong>
                            </div>
                            <div class="detail-row" style="border: none;">
                                <span style="color: #64748b;">Status:</span>
                                <span class="status-badge">CANCELLED</span>
                            </div>
                        </div>
                        
                        <div class="info-box">
                            <strong style="color: #1e40af;">💳 Refund Timeline:</strong>
                            <p style="margin: 10px 0 0 0; color: #475569;">The refund has been initiated. Depending on your bank or card issuer, it may take <strong>5-10 business days</strong> for the funds to appear in your account.</p>
                        </div>
                        
                        <p style="font-size: 14px; color: #64748b; margin-top: 25px;">If you don't see the refund after 10 business days, please contact your bank or our support team for assistance.</p>
                    </div>
                    <div class="footer">
                        <p style="margin: 5px 0;"><strong class="brand-name">DaConnect</strong> - Connecting Artists & Music Lovers</p>
                        <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} DaConnect. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
    `,
        );

        // 6) Notify Seller
        await this.mail.sendEmail(
            order.seller.email,
            "DaConnect - Order Refunded ⚠️",
            `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f7fa; }
                    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
                    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 40px 30px; text-align: center; }
                    .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; letter-spacing: 1px; }
                    .content { padding: 40px 30px; }
                    .alert-box { background: #fef3c7; border: 2px solid #f59e0b; padding: 25px; margin: 25px 0; border-radius: 10px; text-align: center; }
                    .order-box { background: #f8fafc; padding: 20px; margin: 25px 0; border-radius: 8px; }
                    .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
                    .info-box { background: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; margin: 25px 0; border-radius: 6px; }
                    .footer { text-align: center; padding: 25px; background: #f8fafc; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; }
                    .brand-name { color: #f59e0b; font-weight: 600; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🎵 DaConnect</div>
                        <div style="font-size: 16px; opacity: 0.95;">Order Status Update</div>
                    </div>
                    <div class="content">
                        <h2 style="color: #1e293b; margin-bottom: 20px;">Order Refunded</h2>
                        <p style="font-size: 16px; color: #475569;">An order has been refunded. The buyer will receive their payment back, and no payout will be issued for this order.</p>
                        
                        <div class="alert-box">
                            <div style="font-size: 48px; margin-bottom: 10px;">⚠️</div>
                            <h3 style="margin: 10px 0; color: #92400e;">Refund Processed</h3>
                        </div>
                        
                        <div class="order-box">
                            <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">Order Information</h3>
                            <div class="detail-row" style="border: none;">
                                <span style="color: #64748b;">Order Code:</span>
                                <strong style="color: #1e293b;">${order.orderCode}</strong>
                            </div>
                        </div>
                        
                        <div class="info-box">
                            <strong style="color: #991b1b;">💰 Payment Status:</strong>
                            <p style="margin: 10px 0 0 0; color: #475569;">No payout will be issued for this order as the full amount has been refunded to the buyer.</p>
                        </div>
                        
                        <p style="font-size: 14px; color: #64748b; margin-top: 25px;">If you have questions about this refund, please contact our support team for clarification.</p>
                    </div>
                    <div class="footer">
                        <p style="margin: 5px 0;"><strong class="brand-name">DaConnect</strong> - Empowering Artists</p>
                        <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} DaConnect. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
    `,
        );

        //------------------ Send refund notifications ------------------//
        try {
            // Send push notification to buyer
            await this.firebaseNotificationService.sendToUser(
                order.buyerId,
                {
                    title: " payment has been processed successfully",
                    body: `Your refund of $${(order.amount / 100).toFixed(2)} has been processed successfully`,
                    type: NotificationType.PAYMENT_RECEIVED,
                    data: {
                        orderId: order.id,
                        orderCode: order.orderCode,
                        amount: order.amount.toString(),
                        timestamp: new Date().toISOString(),
                    },
                },
                true,
            );
            console.log(`💸 Refund notification sent to buyer ${order.buyerId}`);
        } catch (error) {
            console.error(`❌ Failed to send refund notification to buyer: ${error.message}`);
        }

        try {
            // Send push notification to seller
            await this.firebaseNotificationService.sendToUser(
                order.sellerId,
                {
                    title: "⚠️ Order Refunded",
                    body: `Order ${order.orderCode} has been refunded to the buyer. No payout will be issued.`,
                    type: NotificationType.PAYMENT_RECEIVED,
                    data: {
                        orderId: order.id,
                        orderCode: order.orderCode,
                        amount: order.amount.toString(),
                        timestamp: new Date().toISOString(),
                    },
                },
                true,
            );
            console.log(`⚠️ Refund notification sent to seller ${order.sellerId}`);
        } catch (error) {
            console.error(`❌ Failed to send refund notification to seller: ${error.message}`);
        }

        return {
            message: "Refund issued successfully",
            refund,
            order: updated,
        };
    }

    /**
     * 3) Manual releasePayment (alias) — similar to approvePayment but given orderId & amount
     */
    // async releasePaymentByOrder(orderId: string, sellerStripeAccountId: string, amount: number) {
    //     const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    //     if (!order) throw new NotFoundException("Order not found");

    //     if (!order.paymentIntentId) {
    //         throw new BadRequestException("Order does not have a paymentIntentId");
    //     }

    //     // Capture intent if needed
    //     const intent = await this.stripe.paymentIntents.retrieve(order.paymentIntentId);
    //     if (intent.status !== "succeeded" && intent.capture_method === "manual") {
    //         await this.stripe.paymentIntents.capture(order.paymentIntentId);
    //     }

    //     const transfer = await this.stripe.transfers.create({
    //         amount: Math.round(amount * 100),
    //         currency: intent.currency || "usd",
    //         destination: sellerStripeAccountId,
    //         transfer_group: order.paymentIntentId,
    //     });

    //     const totalReceived = (intent.amount_received || intent.amount || 0) / 100;
    //     const adminFee = totalReceived - amount;

    //     const updated = await this.prisma.order.update({
    //         where: { id: orderId },
    //         data: {
    //             status: OrderStatus.RELEASED,
    //             isReleased: true,
    //             releasedAt: new Date(),
    //             platformFee: adminFee,
    //         },
    //     });
    //     const userFromReq = await this.prisma.user.findUnique({
    //         where: { id: order.buyerId },
    //     });
    //     // await this.mail.sendEmail(
    //     //     userFromReq?.email,
    //     //     "Order Placed Successfully",
    //     //     `
    //     // <h1>Your order is successfully placed!</h1>
    //     // <p>Order Code: ${order.orderCode}</p>
    //     // <p>Amount: $${order.amount}</p>
    //     // <p>Status: ${order.status}</p>
    //     // `
    //     // );

    //     // await this.mail.sendEmail(
    //     //     service.creator?.email,
    //     //     "You Got a New Order",
    //     //     `
    //     // <h1>New Order Received!</h1>
    //     // <p>Order Code: ${order.orderCode}</p>
    //     // <p>Service: ${service.serviceName}</p>
    //     // <p>Buyer: ${service.creator?.email}</p>
    //     // <p>Amount: $${order.amount}</p>
    //     // `
    //     // );

    //     return { transfer, adminFee, order: updated };
    // }

    /**
     * 4) Webhook handler
     *
     * - constructs stripe event and handles:
     *   - checkout.session.completed: create order if missing OR attach paymentIntentId
     *   - payment_intent.succeeded: set order status = PAID
     *   - other useful events logged
     */

    @HandleError("Error handling Stripe webhook")
    async handleWebhook(rawBody: Buffer, signature: string) {
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET_S!;
        let event: Stripe.Event;

        try {
            event = this.stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
        } catch (err: any) {
            this.logger.error("Webhook signature verification failed", err?.message || err);
            throw new BadRequestException(`Webhook Error: ${err?.message || err}`);
        }

        this.logger.log(`Webhook received: ${event.type}`);

        try {
            switch (event.type) {
                case "checkout.session.completed": {
                    const session = event.data.object as Stripe.Checkout.Session;
                    console.log("payment_intent.completed call here");
                    //---------------------  get paymentIntent id ---------------------
                    const piId =
                        typeof session.payment_intent === "string"
                            ? session.payment_intent
                            : (session.payment_intent as Stripe.PaymentIntent)?.id;

                    if (!piId) {
                        this.logger.warn("checkout.session.completed without payment_intent");
                        break;
                    }

                    // --------------------- If order already exists with this paymentIntentId, skip or update ---------------------
                    const existing = await this.prisma.order.findUnique({
                        where: { paymentIntentId: piId },
                    });

                    if (existing?.paymentIntentId) {
                        this.logger.log(`Order already exists for PI ${piId}, skipping create`);
                        break;
                    }

                    // --------------create order record (still PENDING — we'll mark PAID on payment_intent.succeeded) -------------
                    await this.prisma.order.update({
                        where: { sessionId: session.id },
                        data: {
                            paymentIntentId: piId,
                        },
                    });

                    this.logger.log(`Order created for PaymentIntent ${piId}`);
                    break;
                }

                case "payment_intent.succeeded": {
                    const intent = event.data.object as Stripe.PaymentIntent;
                    if (!intent?.id) {
                        this.logger.warn("payment_intent.succeeded without id");
                        break;
                    }

                    //------------------- find order and mark PAID ----------------
                    const order = await this.prisma.order.findUnique({
                        where: { paymentIntentId: intent.id },
                    });
                    if (!order) {
                        this.logger.warn(`No order found for paymentIntent ${intent.id}`);
                        break;
                    }

                    await this.prisma.order.update({
                        where: { id: order.id },
                        data: { status: OrderStatus.RELEASED },
                    });

                    this.logger.log(`Order ${order.id} marked PAID`);
                    break;
                }

                //------------------- optional other events ----------------
                case "payment_intent.payment_failed":
                    this.logger.warn("payment_intent.payment_failed", event.data.object);
                    break;

                default:
                    this.logger.debug(`Unhandled event type ${event.type}`);
            }
        } catch (e) {
            this.logger.error("Error handling webhook", e as any);

            throw e;
        }

        return { received: true };
    }

    /**
     * helper: find service.creatorId (sellerId)
     */
    private async findServiceCreatorId(serviceId: string) {
        const svc = await this.prisma.service.findUnique({ where: { id: serviceId } });
        return svc?.creatorId ?? "unknown";
    }

    @HandleError("Error getting earnings and payouts")
    async getEarningsAndPayouts(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { withdrawn_amount: true },
        });

        if (!user) {
            throw new NotFoundException("User not found");
        }

        const totalReleased = await this.prisma.order.aggregate({
            where: { sellerId: userId, status: OrderStatus.RELEASED },
            _sum: { seller_amount: true },
        });
        const totalSuccessfullReleaseAmount = totalReleased._sum.seller_amount || 0;

        const pendingOrders = await this.prisma.order.aggregate({
            where: {
                sellerId: userId,
                status: {
                    in: [OrderStatus.IN_PROGRESS, OrderStatus.PROOF_SUBMITTED],
                },
            },
            _sum: { seller_amount: true },
        });

        const pendingClearance = pendingOrders._sum.seller_amount || 0;

        const totalEarnings = totalSuccessfullReleaseAmount + pendingClearance;
        const availableToWithdraw = totalSuccessfullReleaseAmount - (user.withdrawn_amount || 0);

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        const monthlyOrders = await this.prisma.order.findMany({
            where: {
                sellerId: userId,
                status: OrderStatus.RELEASED,
                createdAt: {
                    gte: sixMonthsAgo,
                },
            },
            select: {
                seller_amount: true,
                createdAt: true,
            },
        });

        const monthlyEarningsMap = new Map<string, number>();

        const monthNames = [
            "JAN",
            "FEB",
            "MAR",
            "APR",
            "MAY",
            "JUN",
            "JUL",
            "AUG",
            "SEP",
            "OCT",
            "NOV",
            "DEC",
        ];
        const monthlyData: { month: string; amount: number }[] = [];

        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
            const monthName = monthNames[date.getMonth()];
            monthlyEarningsMap.set(monthKey, 0);
            monthlyData.push({ month: monthName, amount: 0 });
        }

        monthlyOrders.forEach((order) => {
            const date = new Date(order.createdAt);
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
            const currentAmount = monthlyEarningsMap.get(monthKey) || 0;
            monthlyEarningsMap.set(monthKey, currentAmount + (order.seller_amount || 0));
        });

        let index = 0;
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
            const amount = monthlyEarningsMap.get(monthKey) || 0;
            monthlyData[index].amount = Math.round(amount / 100);
            index++;
        }

        const monthlyEarnings = monthlyData;

        return {
            monthlyEarnings,
            totalEarnings: totalEarnings / 100,
            pendingClearance: pendingClearance / 100,
            availableToWithdraw: Math.max(0, availableToWithdraw) / 100,
        };
    }
}
