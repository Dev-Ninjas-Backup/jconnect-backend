import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateServiceRequestDto {
    @ApiPropertyOptional({ description: "Service ID" })
    @IsOptional()
    @IsString()
    serviceId?: string;

    @ApiPropertyOptional({ description: "Buyer ID" })
    @IsOptional()
    @IsString()
    buyerId?: string;

    @ApiPropertyOptional({ description: "Caption or instructions" })
    @IsOptional()
    @IsString()
    captionOrInstructions?: string;

    @ApiPropertyOptional({ description: "Promotion date" })
    @IsOptional()
    @IsDateString()
    promotionDate?: Date;

    @ApiPropertyOptional({ description: "Special notes" })
    @IsOptional()
    @IsString()
    specialNotes?: string;

    @ApiPropertyOptional({ description: "Price", example: 10 })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    price?: number;

    @ApiPropertyOptional({ description: "Message ID" })
    @IsOptional()
    @IsString()
    messageID?: string;
}
