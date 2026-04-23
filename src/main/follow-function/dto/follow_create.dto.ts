import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class follow_create_dto {
    @ApiProperty({ example: "user_67890" })
    @IsString()
    followingID: string;
}
