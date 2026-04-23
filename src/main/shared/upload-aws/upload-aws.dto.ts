// uploadd-aws.dto.ts
import { ApiProperty } from "@nestjs/swagger";

export class UploaddAwsdto {
    @ApiProperty({
        description: "Image file to upload",
        type: "string",
        format: "binary",
    })
    file: any;
}
