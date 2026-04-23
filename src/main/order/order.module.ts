import { Module } from "@nestjs/common";

import { AwsService } from "@main/aws/aws.service";
import { NotificationModule } from "@main/shared/notification/notification.module";
import { StripeModule } from "../stripe/stripe.module";
import { OrdersController } from "./order.controller";
import { OrdersService } from "./order.service";

@Module({
    imports: [StripeModule, NotificationModule],
    controllers: [OrdersController],
    providers: [OrdersService, AwsService],
})
export class OrdersModule {}
