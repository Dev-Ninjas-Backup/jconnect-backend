import { Module } from "@nestjs/common";
import { LibModule } from "src/lib/lib.module";
import { AdminDashboardStatsModule } from "./admin-dashboard-stats/admin-dashboard-stats.module";
import { AuthModule } from "./auth/auth.module";
import { CustomServiceRequestModule } from "./custom-service-request/custom-service-request.module";
import { DisputeModule } from "./dispotch/dispotch.module";
import { OrdersModule } from "./order/order.module";
import { PaymentsModule } from "./payments/payments.module";
import { ProfileModule } from "./profile/profile.module";
import { ReviewModule } from "./review/review.module";
import { ServiceRequestModule } from "./service-request/service-request.module";
import { ServiceModule } from "./service/service.module";
import { SharedModule } from "./shared/shared.module";
import { UsersModule } from "./users/users.module";
import { SettingsModule } from "./settings/settings.module";
import { TestRoutesModule } from "./test-routes/test-routes.module";

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
    ],
})
export class MainModule {}
