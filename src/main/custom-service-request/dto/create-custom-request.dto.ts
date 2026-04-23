import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateCustomRequestDto {
    @ApiProperty({
        description: "The ID of the user making the custom request (buyer).",
        example: "usr_cuid_buyer_101",
    })
    @IsString()
    @IsNotEmpty()
    buyerId: string;

    @ApiProperty({
        description: "The ID of the specific creator this request is targeted towards (optional).",
        example: "usr_cuid_creator_202",
        required: false,
    })
    @IsOptional()
    @IsString()
    targetCreatorId?: string;

    @ApiProperty({
        description: "The name of the requested service (e.g., Promotional Shoutout).",
        example: "Promotional Shoutout",
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty()
    serviceName: string;

    @ApiProperty({
        description: "Detailed description of the custom work needed.",
        example: "I want a 30-sec promotional shoutout for my new single on Instagram.",
    })
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty({ description: "Minimum of the budget range.", required: false, example: 50.0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    budgetRangeMin?: number;

    @ApiProperty({ description: "Maximum of the budget range.", required: false, example: 100.0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    budgetRangeMax?: number;

    @ApiProperty({
        description: "Preferred delivery date (YYYY-MM-DD).",
        required: false,
        example: "2026-12-31",
    })
    @IsOptional()
    @IsDateString()
    preferredDeliveryDate?: string;

    @ApiProperty({
        description: "URL of the uploaded brief/files.",
        required: false,
        example: "https://cdn.platform.com/custom/brief_file.pdf",
    })
    @IsOptional()
    @IsString()
    uploadedFileUrl?: string;
}
