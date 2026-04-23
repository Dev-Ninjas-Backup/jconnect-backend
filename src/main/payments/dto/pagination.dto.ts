import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsPositive, IsString } from "class-validator";

export class PaginationDto {
    @ApiProperty({ required: false, default: 1, description: "Page number" })
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    @IsOptional()
    page?: number = 1;

    @ApiProperty({ required: false, default: 10, description: "Items per page" })
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    @IsOptional()
    limit?: number = 10;

    @ApiProperty({
        required: false,
        enum: ["PENDING", "IN_PROGRESS", "PROOF_SUBMITTED", "CANCELLED", "RELEASED"],
        description: "Filter by order status",
    })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiProperty({
        required: false,
        enum: [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ],
        description: "Filter by month name",
        example: "December",
    })
    @IsOptional()
    @IsString()
    month?: string;

    @ApiProperty({
        required: false,
        enum: ["asc", "desc"],
        default: "desc",
        description: "Sort order",
    })
    @IsOptional()
    @IsIn(["asc", "desc"])
    sortOrder?: "asc" | "desc" = "desc";

    @ApiProperty({
        required: false,
        description: "Search by order ID",
        example: "ORD123",
    })
    @IsOptional()
    @IsString()
    search?: string;
}
