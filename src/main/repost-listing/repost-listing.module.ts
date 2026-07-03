import { NotificationModule } from "@main/shared/notification/notification.module";
import { StripeModule } from "@main/stripe/stripe.module";
import { Module } from "@nestjs/common";
import { PrismaModule } from "src/lib/prisma/prisma.module";
import { RepostListingController } from "./repost-listing.controller";
import { RepostListingService } from "./repost-listing.service";

@Module({
    imports: [PrismaModule, NotificationModule, StripeModule],
    controllers: [RepostListingController],
    providers: [RepostListingService],
    exports: [RepostListingService],
})
export class RepostListingModule {}
