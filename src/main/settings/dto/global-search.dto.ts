import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

export class GlobalSearchDto {
    @ApiProperty({ description: "Search query", example: "john" })
    @IsString()
    @MinLength(2, { message: "Search query must be at least 2 characters long" })
    query: string;

    @ApiPropertyOptional({
        description: "Search type filter",
        enum: ["all", "users", "orders", "services", "disputes"],
    })
    @IsOptional()
    @IsString()
    type?: "all" | "users" | "orders" | "services" | "disputes";
}
