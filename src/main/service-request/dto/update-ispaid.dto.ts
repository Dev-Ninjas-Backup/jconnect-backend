import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateIsPaidDto {
    @ApiProperty({
        description: "Payment status of the service request",
        example: true,
    })
    @IsBoolean()
    isPaid: boolean;
}
