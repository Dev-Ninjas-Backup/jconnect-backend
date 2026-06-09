import { PartialType } from "@nestjs/mapped-types";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsDateString, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateSocialServiceDto {
    @ApiProperty({ example: "Instagram Promotion", description: "Name of the service" })
    @IsString()
    serviceName: string;

    @ApiProperty({ example: ["Instagram", "YouTube"], description: "Social platform names" })
    @IsArray()
    @IsString({ each: true })
    platforms: string[];

    @ApiProperty({ example: "John Doe", description: "Artist or influencer name" })
    @IsString()
    artistName: string;

    @ApiProperty({ example: 150.0, description: "Service price in USD" })
    @IsNumber()
    price: number;

    @ApiProperty({
        example: "2025-12-15T00:00:00Z",
        description: "Preferred delivery date (ISO format)",
    })
    @IsDateString()
    preferredDeliveryDate: string;

    @ApiPropertyOptional({
        example: "Please deliver before Christmas",
        description: "Any extra notes from client",
    })
    @IsOptional()
    @IsString()
    specialNotes?: string;

    @ApiPropertyOptional({
        description: "Uploaded file URLs (populated automatically from multipart upload)",
        type: [String],
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    attachedFiles?: string[];

    @ApiPropertyOptional({ example: "Pending", description: "Status of the service" })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiPropertyOptional({
        example: "a7f0a630-d8d1-4a1b-83b9-97e5b2bfc41a",
        description: "Artist (User) ID — set automatically from JWT, do not send manually",
    })
    @IsOptional()
    @IsString()
    artistID?: string;
}

export class UpdateSocialServiceDto extends PartialType(CreateSocialServiceDto) {}
