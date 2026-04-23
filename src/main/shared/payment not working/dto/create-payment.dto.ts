import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsUUID } from "class-validator";

export class CreatePaymentDto {
    @ApiProperty({
        description: "ID of the service user wants to purchase",
        example: "a61c9422-4067-41ec-a77b-8135626307c8",
    })
    @IsNotEmpty()
    @IsUUID()
    serviceId: string;
}
