import { PartialType } from "@nestjs/mapped-types";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsDateString, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateSocialServiceRequestDto {
    @ApiProperty({ example: "Instagram Shoutout", description: "Name of the requested service" })
    @IsString()
    serviceName: string;

    @ApiProperty({ example: "svc_12345", description: "Related Social Service ID" })
    @IsString()
    socialServiceId: string;

    @ApiProperty({
        example: ["Instagram", "YouTube"],
        description: "Platform names as plain strings",
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    platforms: string[];

    @ApiProperty({ example: "John Doe", description: "Name of the artist for the service" })
    @IsString()
    artistName: string;

    @ApiProperty({ example: 150.5, description: "Price of the requested service" })
    @IsNumber()
    price: number;

    @ApiProperty({
        example: "2025-11-15T00:00:00Z",
        description: "Preferred delivery date (ISO 8601 format)",
    })
    @IsDateString()
    preferredDeliveryDate: string;

    @ApiPropertyOptional({
        example: "Please make the content look organic.",
        description: "Special notes or additional instructions (optional)",
    })
    @IsOptional()
    @IsString()
    specialNotes?: string;

    @ApiProperty({
        example: ["image1.jpg", "video.mp4"],
        description: "List of attached file names or URLs",
        type: [String],
    })
    @IsArray()
    attachedFiles: string[];

    @ApiProperty({ example: "buyer-uuid-123", description: "ID of the buyer (User ID)" })
    @IsString()
    buyerId: string;

    @ApiProperty({ example: "artist-uuid-456", description: "ID of the artist (User ID)" })
    @IsString()
    artistID: string;
}

export class UpdateSocialServiceRequestDto extends PartialType(CreateSocialServiceRequestDto) {}
