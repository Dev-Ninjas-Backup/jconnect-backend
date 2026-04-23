import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class Announcement {
    @ApiProperty({ example: "New announcement", required: true })
    @IsNotEmpty()
    @IsString()
    title: string;

    @ApiProperty({ example: "Announcement description", required: true })
    @IsNotEmpty()
    @IsString()
    description: string;
}
