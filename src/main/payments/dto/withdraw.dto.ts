import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, Min } from "class-validator";

export class WithdrawDto {
    @ApiProperty({
        example: 50,
        description: "Withdraw amount",
    })
    @IsNumber()
    @Min(1)
    amount: number;
}
