import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { RepostPlatform } from "@prisma/client";
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
}

export class UpdateRepostListingDto extends PartialType(CreateRepostListingDto) {}

export class ToggleListingDto {
    @ApiProperty({ example: true })
    @IsBoolean()
    isPaused: boolean;
}
