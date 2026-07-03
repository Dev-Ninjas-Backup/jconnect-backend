import { AwsService } from "@main/aws/aws.service";
import { NotificationModule } from "@main/shared/notification/notification.module";
import { StripeModule } from "@main/stripe/stripe.module";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "src/lib/prisma/prisma.module";
import { RepostOrderController } from "./repost-order.controller";
import { RepostOrderGateway } from "./repost-order.gateway";
import { RepostOrderService } from "./repost-order.service";

@Module({
    imports: [PrismaModule, NotificationModule, ConfigModule, StripeModule],
    controllers: [RepostOrderController],
    providers: [RepostOrderService, RepostOrderGateway, AwsService],
    exports: [RepostOrderService, RepostOrderGateway],
})
export class RepostOrderModule {}
