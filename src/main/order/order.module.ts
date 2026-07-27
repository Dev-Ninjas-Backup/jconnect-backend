import { Module } from "@nestjs/common";

import { AwsService } from "@main/aws/aws.service";
import { NotificationModule } from "@main/shared/notification/notification.module";
import { ConfigModule } from "@nestjs/config";
import { StripeModule } from "../stripe/stripe.module";
import { OrdersController } from "./order.controller";
import { OrderGateway } from "./order.gateway";
import { OrdersService } from "./order.service";

@Module({
    imports: [StripeModule, NotificationModule, ConfigModule],
    controllers: [OrdersController],
    providers: [OrdersService, OrderGateway, AwsService],
    exports: [OrdersService, OrderGateway],
})
export class OrdersModule {}
