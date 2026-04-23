import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString } from "class-validator";

export class FindArtistDto {
    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    page?: number;

    @ApiPropertyOptional({ example: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    limit?: number;

    @ApiPropertyOptional({
        example: "top-rated",
        description: 'Filter options: "recently-updated" | "suggested" | "top-rated"',
    })
    @IsOptional()
    @IsString()
    filter?: string;

    @ApiPropertyOptional({
        example: "john",
        description: "Search by artist name, service name, hashtags, or location",
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ example: "john_doe", description: "Filter by exact username" })
    @IsOptional()
    @IsString()
    username?: string;
}
