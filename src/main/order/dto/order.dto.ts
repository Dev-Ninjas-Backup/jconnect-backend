import { ApiProperty } from "@nestjs/swagger";
import { OrderStatus } from "@prisma/client";
import {
    IsDateString,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
} from "class-validator";

export class CreateOrderDto {
    @IsUUID()
    serviceId: string;

    @IsUUID()
    sellerId: string;

    @IsNumber()
    amount: number;

    @IsNumber()
    platformFee: number;
}

export class UpdateOrderStatusDto {
    @IsString()
    status: string;
}

export class UpdateDeliveryDateDto {
    @ApiProperty({
        example: "2024-12-31T23:59:59.999Z",
        description: "The new delivery date for the order in ISO 8601 format.",
    })
    @IsNotEmpty()
    @IsDateString()
    deliveryDate: string;
}

export class GetMyOrdersDto {
    @IsOptional()
    @IsEnum(OrderStatus)
    status?: OrderStatus; // Filter by order status
}
