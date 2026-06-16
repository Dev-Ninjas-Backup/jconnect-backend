import { Module } from "@nestjs/common";
import { LibModule } from "src/lib/lib.module";
import { AdminDashboardStatsModule } from "./admin-dashboard-stats/admin-dashboard-stats.module";
import { AuthModule } from "./auth/auth.module";
import { CustomServiceRequestModule } from "./custom-service-request/custom-service-request.module";
import { DisputeModule } from "./dispotch/dispotch.module";
import { OrdersModule } from "./order/order.module";
import { PaymentsModule } from "./payments/payments.module";
import { ProfileModule } from "./profile/profile.module";
import { RepostListingModule } from "./repost-listing/repost-listing.module";
import { RepostOrderModule } from "./repost-order/repost-order.module";
import { RepostSchedulerModule } from "./repost-scheduler/repost-scheduler.module";
import { ReviewModule } from "./review/review.module";
import { ServiceRequestModule } from "./service-request/service-request.module";
import { ServiceModule } from "./service/service.module";
import { SettingsModule } from "./settings/settings.module";
import { ShareModule } from "./share/share.module";
import { SharedModule } from "./shared/shared.module";
import { SocialServiceModule } from "./social-service/social-service.module";
import { SocialServiceRequestModule } from "./social-service-request/social-service-request.module";
import { TestRoutesModule } from "./test-routes/test-routes.module";
import { UsersModule } from "./users/users.module";

@Module({
    imports: [
        LibModule,
        AuthModule,
        UsersModule,
        ProfileModule,
        ServiceModule,
        ServiceRequestModule,
        CustomServiceRequestModule,
        ReviewModule,
        SharedModule,
        PaymentsModule,
        OrdersModule,
        AdminDashboardStatsModule,
        DisputeModule,
        SettingsModule,
        TestRoutesModule,
        // Repost Marketplace
        RepostListingModule,
        RepostOrderModule,
        RepostSchedulerModule,
        // Social Service (previously hidden)
        SocialServiceModule,
        SocialServiceRequestModule,
        // Share / Deep-link preview
        ShareModule,
    ],
})
export class MainModule {}
