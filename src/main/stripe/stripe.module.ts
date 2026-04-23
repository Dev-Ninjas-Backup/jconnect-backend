import { Module } from "@nestjs/common";
import Stripe from "stripe";

@Module({
    providers: [
        {
            provide: "STRIPE_CLIENT",
            useFactory: () => {
                return new Stripe(process.env.STRIPE_SECRET_KEY_S!);
            },
        },
    ],
    exports: ["STRIPE_CLIENT"],
})
export class StripeModule {}
