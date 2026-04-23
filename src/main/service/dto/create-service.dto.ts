// /src/service/dto/create-service.dto.ts
import { PartialType } from "@nestjs/mapped-types";
import { ApiProperty } from "@nestjs/swagger";
import { ServiceType, SocialLogo } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
    IsBoolean,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
} from "class-validator";

export class CreateServiceDto {
    @ApiProperty({
        example: "Track Review",
        description:
            "The name of the creative service offered (e.g., Mixing, Promo Collaboration).",
    })
    @IsString()
    @IsNotEmpty()
    serviceName: string;

    @ApiProperty({
        enum: ServiceType,
        example: ServiceType.SERVICE,
        description: "The type/category of the service: SOCIAL_POST or SERVICE.",
    })
    @IsEnum(ServiceType)
    @IsNotEmpty()
    serviceType: ServiceType;

    @ApiProperty({
        example: "I'll review your song and share actionable feedback.",
        description: "A short description (1-2 lines) of what the service entails.",
        required: false,
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({
        example: 50.0,
        description: "The price for the service.",
    })
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    price: number;

    @ApiProperty({
        example: "USD",
        description: "The currency code (e.g., USD, EUR).",
        required: false,
    })
    @IsOptional()
    @IsString()
    currency?: string = "USD";

    @ApiProperty({
        example: false,
        description: "Indicates if the service is a custom offering.",
        required: false,
    })
    @Transform(({ value }) => {
        if (value === "true" || value === true) return true;
        if (value === "false" || value === false) return false;
        return value;
    })
    @IsOptional()
    @IsBoolean()
    isCustom?: boolean = false;

    @ApiProperty({
        example: false,
        description: "if post related",
        required: false,
    })
    @Transform(({ value }) => {
        if (value === "true" || value === true) return true;
        if (value === "false" || value === false) return false;
        return value;
    })
    @IsOptional()
    @IsBoolean()
    isPost?: boolean = false;

    @ApiProperty({
        example: "https://example.com/logo.png",
        description: "Social media logo URL for social service posts",
        required: false,
    })
    @IsOptional()
    @IsString()
    socialLogoForSocialService?: string;

    @ApiProperty({
        enum: SocialLogo,
        example: SocialLogo.FACEBOOK,
        description: "Select social media platform type",
        required: false,
        default: SocialLogo.SELECT,
    })
    @Transform(({ value }) => {
        if (!value || value === "" || value === null || value === undefined) {
            return SocialLogo.SELECT;
        }
        return value;
    })
    @IsOptional()
    @IsEnum(SocialLogo)
    socialLogo?: SocialLogo = SocialLogo.SELECT;
}

export class UpdateServiceDto extends PartialType(CreateServiceDto) {
    @ApiProperty({
        example: "Updated Track Review",
        required: false,
    })
    @IsOptional()
    @IsString()
    serviceName?: string;

    @ApiProperty({
        enum: ServiceType,
        example: ServiceType.SERVICE,
        description: "The type/category of the service: SOCIAL_POST or SERVICE.",
        required: false,
    })
    @IsOptional()
    @IsEnum(ServiceType)
    serviceType?: ServiceType;

    @ApiProperty({
        example: "Updated service description",
        required: false,
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({
        example: 60.0,
        required: false,
    })
    @Type(() => Number)
    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number;

    @ApiProperty({
        example: "EUR",
        required: false,
    })
    @IsOptional()
    @IsString()
    currency?: string;

    @ApiProperty({
        example: true,
        required: false,
    })
    @Transform(({ value }) => {
        if (value === "true" || value === true) return true;
        if (value === "false" || value === false) return false;
        return value;
    })
    @IsOptional()
    @IsBoolean()
    isCustom?: boolean;

    @ApiProperty({
        example: true,
        required: false,
    })
    @Transform(({ value }) => {
        if (value === "true" || value === true) return true;
        if (value === "false" || value === false) return false;
        return value;
    })
    @IsOptional()
    @IsBoolean()
    isPost?: boolean;
}
