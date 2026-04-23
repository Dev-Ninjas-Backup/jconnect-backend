import { ValidateAdmin, ValidateSuperAdmin } from "@common/jwt/jwt.decorator";
import { Controller, Get, HttpStatus, InternalServerErrorException, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AdminDashboardStatsService } from "./admin-dashboard-stats.service";
import { TopSellerFilterDto } from "./dto/topSelletFilter.dto";

@ApiTags("Admin Dashboard Stats")
@ApiBearerAuth()
@Controller("admin/dashboard-stats")
export class AdminDashboardStatsController {
    constructor(private readonly adminStatsService: AdminDashboardStatsService) {}

    @ValidateAdmin()
    @Get("overview")
    @ApiOperation({
        summary: "Get admin dashboard overview stats (Users, Revenue, Disputes, Refunds)",
    })
    async getOverviewStats() {
        try {
            const res = await this.adminStatsService.getAdminStats();
            return {
                status: HttpStatus.OK,
                message: "Admin Stats",
                data: res,
            };
        } catch (error) {
            throw new InternalServerErrorException(error.message, error.status);
        }
    }

    @ValidateAdmin()
    @Get("revenue-by-month")
    @ApiOperation({ summary: "Get revenue trend by month for chart" })
    async getRevenueByMonth() {
        try {
            const res = await this.adminStatsService.getLastYearAndThisYearRevenue();
            return {
                status: HttpStatus.OK,
                message: "Fetch Revenue of last 2 year",
                data: res,
            };
        } catch (error) {
            throw new InternalServerErrorException(error.message, error.status);
        }
    }

    @ValidateAdmin()
    @Get("top-sellers")
    @ApiOperation({ summary: "Get top service sellers with their performance metrics" })
    async getTopSellers(@Query() filter: TopSellerFilterDto) {
        try {
            const res = await this.adminStatsService.getTopSellers(
                filter.page,
                filter.limit,
                filter.search,
            );
            return {
                status: HttpStatus.OK,
                message: "Top Sellers",
                data: res,
            };
        } catch (error) {
            throw new InternalServerErrorException(error.message, error.status);
        }
    }

    @ValidateAdmin()
    @Get("top-performing-users")
    @ApiOperation({ summary: "Get top performing users by total payment amount" })
    async getTopPerformingUsers() {
        try {
            const res = await this.adminStatsService.getTopPerformingUsers();
            return {
                status: HttpStatus.OK,
                message: "Top Performing Users",
                data: res,
            };
        } catch (error) {
            throw new InternalServerErrorException(error.message, error.status);
        }
    }

    @ValidateAdmin()
    @Get("user-activity-weekly")
    @ApiOperation({
        summary: "Get active vs inactive user counts by day of the week (Placeholder Data)",
    })
    async getUserActivityWeekly() {
        try {
            const res = await this.adminStatsService.getUserActivityWeekly();
            return {
                status: HttpStatus.OK,
                message: "Fetch User Activity Weekly",
                data: res,
            };
        } catch (error) {
            throw new InternalServerErrorException(error.message, error.status);
        }
    }

    @ValidateAdmin()
    @Get("totalPlatformRevenue")
    @ApiOperation({
        summary: "Get total platform revenue",
    })
    async getTotalPlatformRevenue() {
        try {
            const res = await this.adminStatsService.getTotalPlatformRevenue();
            return {
                status: HttpStatus.OK,
                message: "Fetch Total Platform Revenue",
                data: res,
            };
        } catch (error) {
            throw new InternalServerErrorException(error.message, error.status);
        }
    }
}
