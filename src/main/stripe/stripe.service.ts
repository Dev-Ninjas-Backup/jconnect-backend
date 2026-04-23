import { Inject, Injectable } from "@nestjs/common";
import Stripe from "stripe";

@Injectable()
export class StripeService {
    constructor(
        @Inject("STRIPE_CLIENT")
        private readonly stripe: Stripe,
    ) {}

    async createCustomer(email: string, name: string) {
        return this.stripe.customers.create({
            email,
            name,
        });
    }

    async createPaymentIntent(amount: number, currency: string) {
        return this.stripe.paymentIntents.create({
            amount,
            currency,
            automatic_payment_methods: { enabled: true },
        });
    }
}
