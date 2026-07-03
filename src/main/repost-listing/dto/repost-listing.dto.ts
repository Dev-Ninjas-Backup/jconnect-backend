import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { RepostPlatform, RepostTimeframe } from "@prisma/client";
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateRepostListingDto {
    @ApiProperty({ enum: RepostPlatform, example: RepostPlatform.INSTAGRAM_STORY })
    @IsEnum(RepostPlatform)
    platform: RepostPlatform;

    @ApiProperty({ example: 5.0 })
    @IsNumber()
    @Min(0)
    price: number;

    @ApiPropertyOptional({ example: 10000 })
    @IsOptional()
    @IsInt()
    @Min(0)
    followerCount?: number;

    @ApiPropertyOptional({ example: "I will repost your content on my Instagram Story" })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({
        enum: RepostTimeframe,
        example: RepostTimeframe.TWENTY_FOUR_HOURS,
        description: "Default turnaround time shown to buyers for this listing",
    })
    @IsOptional()
    @IsEnum(RepostTimeframe)
    defaultTurnaround?: RepostTimeframe;

    @ApiPropertyOptional({
        example: true,
        description:
            "Whether this listing is featured in the $1 Repost Spotlight. Defaults to true when price is $1 if not provided.",
    })
    @IsOptional()
    @IsBoolean()
    isSpotlight?: boolean;
}

export class UpdateRepostListingDto extends PartialType(CreateRepostListingDto) {}

export class ToggleListingDto {
    @ApiProperty({ example: true })
    @IsBoolean()
    isPaused: boolean;
}
