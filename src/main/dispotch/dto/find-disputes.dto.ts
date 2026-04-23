import { ApiPropertyOptional } from "@nestjs/swagger";
import { DisputeStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsDate, IsEnum, IsInt, IsOptional, IsPositive, Min } from "class-validator";

export class FindDisputesDto {
    @ApiPropertyOptional({ enum: DisputeStatus, description: "Filter by dispute status" })
    @IsOptional()
    @IsEnum(DisputeStatus)
    status?: DisputeStatus;

    @ApiPropertyOptional({
        example: "2025-10-01T00:00:00Z",
        description: "Start date (inclusive) in ISO 8601 format",
    })
    @IsOptional()
    @Type(() => Date)
    @IsDate()
    startDate?: Date;

    @ApiPropertyOptional({
        example: "2025-10-31T23:59:59Z",
        description: "End date (inclusive) in ISO 8601 format",
    })
    @IsOptional()
    @Type(() => Date)
    @IsDate()
    endDate?: Date;

    @ApiPropertyOptional({ example: 1, description: "Page number (1-based)" })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ example: 10, description: "Items per page" })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    perPage?: number = 10;
}
