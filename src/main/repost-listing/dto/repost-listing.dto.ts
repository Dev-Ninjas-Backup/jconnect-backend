import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { RepostPlatform, RepostTimeframe } from "@prisma/client";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateRepostListingDto {
    @ApiProperty({ enum: RepostPlatform, example: RepostPlatform.INSTAGRAM_STORY })
    @IsEnum(RepostPlatform)
    platform: RepostPlatform;

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
        example: false,
        description:
            "Whether this listing is featured in the $1 Repost Spotlight. Every repost listing is $1 — this only controls featured placement. Defaults to false if not provided.",
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

export class ToggleActiveDto {
    @ApiProperty({ example: true })
    @IsBoolean()
    isActive: boolean;
}
