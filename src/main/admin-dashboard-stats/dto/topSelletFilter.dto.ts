import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsOptional, IsString } from "class-validator";

export class TopSellerFilterDto {
    @ApiProperty({
        example: 1,
        description: "Page number for pagination.",
        required: false,
    })
    @IsOptional()
    @Type(() => Number)
    page: number;

    @ApiProperty({
        example: 10,
        description: "Page number for pagination.",
        required: false,
    })
    @IsOptional()
    @Type(() => Number)
    limit: number;

    @ApiProperty({
        example: "john",
        description: "Search by username",
        required: false,
    })
    @IsOptional()
    @IsString()
    search?: string;
}
