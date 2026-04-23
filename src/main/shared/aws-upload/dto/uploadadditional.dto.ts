import { ApiProperty } from "@nestjs/swagger";
import { IsOptional } from "class-validator";

export class Additionaldto {
    @ApiProperty({
        description: "File to upload (any type)",
        type: "string",
        format: "binary",
    })
    @IsOptional()
    file?: any;
}

export class AdditionalMultipleDto {
    @ApiProperty({
        description: "Multiple image files to upload",
        type: "string",
        format: "binary",
        isArray: true,
    })
    @IsOptional()
    files?: any[];
}
