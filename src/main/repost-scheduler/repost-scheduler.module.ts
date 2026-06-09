import { NotificationModule } from "@main/shared/notification/notification.module";
import { RepostOrderModule } from "@main/repost-order/repost-order.module";
import { Module } from "@nestjs/common";
import { PrismaModule } from "src/lib/prisma/prisma.module";
import { RepostSchedulerService } from "./repost-scheduler.service";

@Module({
    imports: [PrismaModule, NotificationModule, RepostOrderModule],
    providers: [RepostSchedulerService],
})
export class RepostSchedulerModule {}
