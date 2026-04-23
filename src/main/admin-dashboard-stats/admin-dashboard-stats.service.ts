import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/lib/prisma/prisma.service";

@Injectable()
export class AdminDashboardStatsService {
    constructor(private prisma: PrismaService) {}

    //* Aggregate key metrics for the dashboard overview cards
    async getAdminStats() {
        const now = new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        const [
            totalUser,
            lastMonthUser,
            totalDispute,
            lastMonthDispute,
            totalRevenueObj,
            lastMonthRevenueObj,
            totalRefundObj,
            lastMonthRefundObj,
            stripePayoutsObj,
            lastMonthStripePayoutsObj,
        ] = await Promise.all([
            this.prisma.user.count(),

            this.prisma.user.count({
                where: {
                    created_at: {
                        gte: startOfLastMonth,
                        lte: endOfLastMonth,
                    },
                },
            }),
            this.prisma.dispute.count(),
            this.prisma.dispute.count({
                where: {
                    createdAt: {
                        gte: startOfLastMonth,
                        lte: endOfLastMonth,
                    },
                },
            }),

            this.prisma.order.aggregate({
                _sum: { PlatfromRevinue: true },
            }),

            this.prisma.order.aggregate({
                where: {
                    createdAt: {
                        gte: startOfLastMonth,
                        lte: endOfLastMonth,
                    },
                },
                _sum: { PlatfromRevinue: true },
            }),

            this.prisma.order.aggregate({
                where: { status: "CANCELLED" },
                _sum: { amount: true },
            }),

            this.prisma.order.aggregate({
                where: {
                    status: "CANCELLED",
                    createdAt: {
                        gte: startOfLastMonth,
                        lte: endOfLastMonth,
                    },
                },
                _sum: { amount: true },
            }),

            this.prisma.order.findMany({
                where: { status: "RELEASED" },
                select: { amount: true, stripeFee: true, platformFee: true },
            }),

            this.prisma.order.findMany({
                where: {
                    status: "RELEASED",
                    createdAt: {
                        gte: startOfLastMonth,
                        lte: endOfLastMonth,
                    },
                },
                select: { amount: true, stripeFee: true, platformFee: true },
            }),
        ]);

        const calcPercentage = (current: number, last: number) =>
            last === 0 ? 100 : ((current - last) / last) * 100;

        const stripePayoutsTotal = stripePayoutsObj.reduce(
            (sum, order) => sum + (order.amount - order.stripeFee - order.platformFee),
            0,
        );
        const lastMonthStripePayoutsTotal = lastMonthStripePayoutsObj.reduce(
            (sum, order) => sum + (order.amount - order.stripeFee - order.platformFee),
            0,
        );

        return {
            totalUser,
            userPercentage: calcPercentage(totalUser, lastMonthUser),
            totalDispute,
            disputePercentage: calcPercentage(totalDispute, lastMonthDispute),
            totalRevenue: totalRevenueObj._sum.PlatfromRevinue || 0,
            revenuePercentage: calcPercentage(
                totalRevenueObj._sum.PlatfromRevinue || 0,
                lastMonthRevenueObj._sum.PlatfromRevinue || 0,
            ),
            totalRefund: totalRefundObj._sum.amount || 0,
            refundPercentage: calcPercentage(
                totalRefundObj._sum.amount || 0,
                lastMonthRefundObj._sum.amount || 0,
            ),
            stripePayouts: stripePayoutsTotal,
            stripePayoutsPercentage: calcPercentage(
                stripePayoutsTotal,
                lastMonthStripePayoutsTotal,
            ),
        };
    }

    //* Revenue trend by month (for the main line chart)
    async getLastYearAndThisYearRevenue() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const lastYear = currentYear - 1;

        // Date range
        const startDate = new Date(lastYear, 0, 1); // last year Jan 1
        const endDate = new Date(currentYear, now.getMonth(), 31); // this year running month end

        // Fetch orders within range
        const orders = await this.prisma.order.findMany({
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            select: {
                PlatfromRevinue: true,
                createdAt: true,
            },
        });

        // Prepare revenue map (last year full + this year running)
        const revenueMap: Record<string, number> = {};

        // Last year: Jan → Dec
        for (let m = 0; m < 12; m++) {
            const key = `${lastYear}-${(m + 1).toString().padStart(2, "0")}`;
            revenueMap[key] = 0;
        }

        // This year: Jan → current month
        for (let m = 0; m <= now.getMonth(); m++) {
            const key = `${currentYear}-${(m + 1).toString().padStart(2, "0")}`;
            revenueMap[key] = 0;
        }

        // Fill data
        for (const order of orders) {
            const key = `${order.createdAt.getFullYear()}-${(order.createdAt.getMonth() + 1)
                .toString()
                .padStart(2, "0")}`;

            if (revenueMap[key] !== undefined) {
                revenueMap[key] += order.PlatfromRevinue || 0;
            }
        }

        // Convert to sorted array
        const result = Object.keys(revenueMap)
            .sort()
            .map((month) => ({
                month,
                revenue: revenueMap[month],
            }));

        return result;
    }

    async getTopSellers(page = 1, limit = 10, search?: string) {
        const skip = (page - 1) * limit;

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let userFilter: any = {};
        if (search) {
            userFilter = {
                full_name: { contains: search, mode: "insensitive" },
            };
        }

        // Group by sellers for last 30 days
        const sellers = await this.prisma.order.groupBy({
            by: ["sellerId"],
            where: {
                status: "RELEASED",
                createdAt: {
                    gte: thirtyDaysAgo,
                },
                ...(search ? { seller: userFilter } : {}),
            },
            _count: true,
            _sum: {
                PlatfromRevinue: true,
            },
            orderBy: {
                _sum: {
                    PlatfromRevinue: "desc",
                },
            },
            skip,
            take: limit,
        });

        const sellerIds = sellers.map((s) => s.sellerId);

        const users = await this.prisma.user.findMany({
            where: {
                id: { in: sellerIds },
                ...userFilter,
            },
            select: {
                id: true,
                full_name: true,
            },
        });

        const final = sellers.map((seller) => {
            const user = users.find((u) => u.id === seller.sellerId);
            const totalRevenue = seller._sum?.PlatfromRevinue || 0;
            const deals = typeof seller._count === "number" ? seller._count : 0;

            return {
                username: "@" + (user?.full_name || "unknown"),
                dealsCompleted30d: deals,
                totalRevenue30d: totalRevenue,
                avgOrderValue: deals > 0 ? totalRevenue / deals : 0,
            };
        });

        const totalSellers = await this.prisma.order.groupBy({
            by: ["sellerId"],
            where: {
                status: "RELEASED",
                createdAt: {
                    gte: thirtyDaysAgo,
                },
                ...(search ? { seller: userFilter } : {}),
            },
        });

        return {
            data: final,
            pagination: {
                page,
                limit,
                total: totalSellers.length,
            },
        };
    }

    //* Top Performing Users (by amount of money spent/paid)
    // async getTopPerformingUsers() {
    //     const res = await this.prisma.order.groupBy({
    //         by: ["buyerId"],
    //         include: {
    //             buyer: true
    //         },
    //         _sum: {
    //             amount: true,
    //         },
    //         orderBy: {
    //             _sum: {
    //                 amount: "desc",
    //             },
    //         },
    //         take: 10,
    //     });
    //     return res;
    // }

    async getTopPerformingUsers() {
        const grouped = await this.prisma.order.groupBy({
            by: ["buyerId"],
            _sum: {
                amount: true,
            },
            orderBy: {
                _sum: { amount: "desc" },
            },
            take: 10,
        });

        // Now fetch buyer data manually
        const result = await Promise.all(
            grouped.map(async (item) => {
                const buyer = await this.prisma.user.findUnique({
                    where: { id: item.buyerId },
                });

                return {
                    name: buyer?.full_name,
                    totalAmount: item._sum.amount,
                };
            }),
        );

        return result;
    }

    //* Get Active User counts grouped by the day of the week over the last 7 days.
    async getUserActivityWeekly() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 6);

        // Fetch only users that exist before today
        const users = await this.prisma.user.findMany({
            select: {
                last_login_at: true,
            },
        });

        const dayMap: Record<string, { active: number; inactive: number }> = {};

        // Create 7 days map
        for (let i = 0; i < 7; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);

            const key = d.toISOString().split("T")[0];
            dayMap[key] = { active: 0, inactive: 0 };
        }

        // Count active vs inactive for each day
        for (const user of users) {
            for (let i = 0; i < 7; i++) {
                const d = new Date(startDate);
                d.setDate(startDate.getDate() + i);
                const key = d.toISOString().split("T")[0];

                const lastLogin = user.last_login_at
                    ? user.last_login_at.toISOString().split("T")[0]
                    : null;

                if (lastLogin === key) {
                    dayMap[key].active += 1;
                } else {
                    dayMap[key].inactive += 1;
                }
            }
        }

        // Convert to percentages
        const result = Object.keys(dayMap)
            .sort()
            .map((date) => {
                const total = dayMap[date].active + dayMap[date].inactive || 1;

                return {
                    date,
                    activePercentage: Number(((dayMap[date].active / total) * 100).toFixed(2)),
                    inactivePercentage: Number(((dayMap[date].inactive / total) * 100).toFixed(2)),
                };
            });

        return result;
    }

    async getTotalPlatformRevenue() {
        const totalPlatformRevenue = await this.prisma.order.aggregate({
            _sum: {
                PlatfromRevinue: true,
            },
        });
        const platformRevenueLastMonth = await this.prisma.order.aggregate({
            where: {
                updatedAt: {
                    gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
                },
            },
            _sum: {
                PlatfromRevinue: true,
            },
        });
        return {
            totalPlatformRevenue: totalPlatformRevenue._sum.PlatfromRevinue || 0,
            platformRevenueLastMonth: platformRevenueLastMonth._sum.PlatfromRevinue || 0,
        };
    }
}
