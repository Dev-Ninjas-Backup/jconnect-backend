import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString } from "class-validator";

export const ARTIST_CATEGORIES = ["SOCIAL_POST", "SERVICE", "REPOST"] as const;
export type ArtistCategory = (typeof ARTIST_CATEGORIES)[number];

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

    @ApiPropertyOptional({
        enum: ARTIST_CATEGORIES,
        example: "REPOST",
        description:
            "Filter to artists offering this category (matches the Social Posts / Reposts / Services home tiles) and sorts by that category's lowest price",
    })
    @IsOptional()
    @IsIn(ARTIST_CATEGORIES)
    category?: ArtistCategory;
}
