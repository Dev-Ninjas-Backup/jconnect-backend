import { ApiProperty } from "@nestjs/swagger";

export class AdminStatsDto {
    @ApiProperty({ example: 1250 })
    totalUsers: number;

    @ApiProperty({ example: 45000 })
    totalRevenue: number;

    @ApiProperty({ example: 12 })
    totalDisputes: number;

    @ApiProperty({ example: 8 })
    totalRefunds: number;
}

export class RevenueByMonthDto {
    @ApiProperty({ example: "2024-01" })
    month: string;

    @ApiProperty({ example: 5000 })
    revenue: number;
}

export class TopSellerDto {
    @ApiProperty({ example: "user123" })
    sellerId: string;

    @ApiProperty({ example: "John Doe" })
    sellerName: string;

    @ApiProperty({ example: 15000 })
    totalRevenue: number;

    @ApiProperty({ example: 45 })
    completedDeals: number;

    @ApiProperty({ example: 333.33 })
    avgOrderValue: number;
}
