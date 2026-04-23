import { NotificationModule } from "@main/shared/notification/notification.module";
import { StripeModule } from "@main/stripe/stripe.module";
import { Module } from "@nestjs/common";
import { PaymentController } from "./payments.controller";
import { PaymentService } from "./payments.service";

@Module({
    imports: [StripeModule, NotificationModule],
    controllers: [PaymentController],
    providers: [PaymentService],
})
export class PaymentsModule {}
