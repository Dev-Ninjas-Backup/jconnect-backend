import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class GoogleLoginDto {
    @ApiProperty({
        example: "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2...",
        description: "Google ID token obtained from Google Sign-In",
    })
    @IsString()
    @IsNotEmpty()
    idToken: string;
}
