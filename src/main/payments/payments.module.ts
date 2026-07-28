import { NotificationModule } from "@main/shared/notification/notification.module";
import { PrivateMessageModule } from "@main/shared/private-message/private-message.module";
import { StripeModule } from "@main/stripe/stripe.module";
import { Module } from "@nestjs/common";
import { OrdersModule } from "../order/order.module";
import { PaymentController } from "./payments.controller";
import { PaymentService } from "./payments.service";

@Module({
    imports: [StripeModule, NotificationModule, OrdersModule, PrivateMessageModule],
    controllers: [PaymentController],
    providers: [PaymentService],
})
export class PaymentsModule {}
