// src/dispute/dto/update-dispute.dto.ts
import { IsEnum, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { DisputeStatus } from "@prisma/client";

export class UpdateDisputeDto {
    @ApiProperty({
        description: "Admin resolution message (optional)",
        required: false,
        example: "Refund of ৳2500 has been processed to buyer",
    })
    @IsOptional()
    @IsString()
    resolution?: string;

    @ApiProperty({
        enum: DisputeStatus,
        description: "Update dispute status (admin only)",
        example: DisputeStatus.RESOLVED,
        required: false,
    })
    @IsOptional()
    @IsEnum(DisputeStatus)
    status?: DisputeStatus;
}
