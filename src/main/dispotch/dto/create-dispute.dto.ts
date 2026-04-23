import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateDisputeDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    orderId: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    description: string;

    @IsOptional()
    @ApiProperty()
    @IsString()
    resolution?: string;

    @ApiProperty({ type: [String], required: false })
    @IsOptional()
    proofs?: string[]; // will store uploaded S3 URLs
}
