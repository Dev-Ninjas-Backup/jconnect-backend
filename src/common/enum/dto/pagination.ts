import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt } from "class-validator";

export class PaginationDto {
    @ApiPropertyOptional({ default: 1 })
    @Type(() => Number)
    @IsInt()
    page?: number;

    @ApiPropertyOptional({ default: 10 })
    @Type(() => Number)
    @IsInt()
    limit?: number;
}
