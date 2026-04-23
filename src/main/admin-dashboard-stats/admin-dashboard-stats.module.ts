import { Module } from "@nestjs/common";
import { PrismaModule } from "src/lib/prisma/prisma.module";
import { AdminDashboardStatsController } from "./admin-dashboard-stats.controller";
import { AdminDashboardStatsService } from "./admin-dashboard-stats.service";

@Module({
    imports: [PrismaModule],
    controllers: [AdminDashboardStatsController],
    providers: [AdminDashboardStatsService],
})
export class AdminDashboardStatsModule {}
