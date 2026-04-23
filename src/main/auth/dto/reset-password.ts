import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class ResetPasswordAuthDto {
    @ApiProperty({ example: "token" })
    @IsString()
    resetToken: string;

    @ApiProperty({ example: "password" })
    @IsString()
    password: string;
}
