import { AwsService } from "@main/aws/aws.service";
import { NotificationModule } from "@main/shared/notification/notification.module";
import { Module } from "@nestjs/common";
import { PrismaModule } from "src/lib/prisma/prisma.module";
import { RepostOrderController } from "./repost-order.controller";
import { RepostOrderService } from "./repost-order.service";

@Module({
    imports: [PrismaModule, NotificationModule],
    controllers: [RepostOrderController],
    providers: [RepostOrderService, AwsService],
    exports: [RepostOrderService],
})
export class RepostOrderModule {}
