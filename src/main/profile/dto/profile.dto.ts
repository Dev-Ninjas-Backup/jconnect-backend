// src/profile/dto/profile.dto.ts
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsArray, IsInt, IsOptional, IsString, IsUrl, ValidateNested } from "class-validator";

export class SocialProfileInput {
    @ApiPropertyOptional({ example: "Instagram" })
    @IsString()
    platformName: string;

    @ApiPropertyOptional({ example: "https://instagram.com/example" })
    @IsString()
    platformLink: string;
}

export class CreateProfileDto {
    @IsOptional()
    @IsString()
    userId: string;

    @ApiPropertyOptional({ example: "https://example.com/image.jpg" })
    @IsOptional()
    @IsUrl()
    profile_image_url?: string;

    @ApiPropertyOptional({ example: "I am a web developer" })
    @IsOptional()
    @IsString()
    short_bio?: string;

    @ApiPropertyOptional({ type: () => [SocialProfileInput] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SocialProfileInput)
    @Transform(({ value }) => {
        if (!value) return undefined;
        if (Array.isArray(value)) return value;
        if (typeof value === "string") {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : [parsed];
            } catch (e) {
                return value;
            }
        }
        return value;
    })
    socialProfiles?: SocialProfileInput[];
}

export class UpdateProfileDto {
    @ApiPropertyOptional({ example: "https://example.com/image_new.jpg" })
    @IsOptional()
    @IsUrl()
    profile_image_url?: string;

    @ApiPropertyOptional({ example: "Updated short bio" })
    @IsOptional()
    @IsString()
    short_bio?: string;

    @ApiPropertyOptional({ type: () => [SocialProfileInput] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SocialProfileInput)
    socialProfiles?: SocialProfileInput[];
}
