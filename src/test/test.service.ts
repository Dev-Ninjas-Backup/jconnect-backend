import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/lib/prisma/prisma.service";
import Stripe from "stripe";

@Injectable()
export class testService {
    private stripe = new Stripe(process.env.STRIPE_SECRET_KEY_DELETE_SELLER_ID!);

    constructor(private prisma: PrismaService) {}
    async deleteAllStripeTestAccounts() {
        const accounts = await this.stripe.accounts.list({ limit: 100 });

        for (const acc of accounts.data) {
            try {
                // Try normal delete (V1 accounts)
                await this.stripe.accounts.del(acc.id);
                console.log("Deleted (V1):", acc.id);
            } catch (error) {
                if (error.message.includes("linked to a V2 Account")) {
                    console.log("Closing V2 Account:", acc.id);

                    // Close V2 Account manually using Stripe's V2 endpoint
                    await fetch(`https://api.stripe.com/v2/core/accounts/${acc.id}/close`, {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
                            "Content-Type": "application/x-www-form-urlencoded",
                        },
                    });

                    console.log("Closed (V2):", acc.id);
                } else {
                    console.log("Failed:", acc.id, error.message);
                }
            }
        }

        const balance = await this.stripe.balance.retrieve();
        const available = balance.available[0]?.amount || 0; // cents
        const currency = balance.available[0]?.currency || "usd";

        if (available > 0) {
            try {
                const payout = await this.stripe.payouts.create({
                    amount: available,
                    currency,
                });
                console.log("Main balance zeroed with payout:", payout.id);
            } catch (error: any) {
                if (error.message.includes("no external accounts")) {
                    console.log(
                        `No external account in ${currency}. Cannot payout, balance stays in platform.`,
                    );
                } else {
                    console.log("Payout error:", error.message);
                }
            }
        } else {
            console.log("Main balance already zero");
        }

        return {
            message: "All test connected accounts processed.",
            totalAccounts: accounts.data.length,
        };
    }

    async deleteOrder(id: string) {
        await this.prisma.order.delete({
            where: {
                id: id,
            },
        });
        return { message: "Order deleted successfully." };
    }
    async deleteallOrders() {
        await this.prisma.order.deleteMany({});
        return { message: "all orders deleted successfully." };
    }
}
