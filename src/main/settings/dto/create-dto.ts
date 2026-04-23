import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional } from "class-validator";

export class UpdateSettingDto {
    @ApiProperty({ example: 5, required: false })
    @IsOptional()
    @IsNumber()
    platformFee_percents?: number;

    @ApiProperty({ example: 50, required: false })
    @IsOptional()
    @IsNumber()
    minimum_payout?: number;
}
