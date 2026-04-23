import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class VerifyOtpAuthDto {
    @ApiProperty({ example: "token" })
    @IsString()
    resetToken: string;

    @ApiProperty({ example: "otp" })
    @IsString()
    emailOtp: string;
}

export class ResendverifyOtpDto {
    @ApiProperty({ example: "123456" })
    @IsString()
    emailOtp: string;

    @ApiProperty({ example: "jwt-reset-token" })
    @IsString()
    resetToken: string;
}

export class ResendEmailDto {
    @ApiProperty({ example: "shamimranaprofessional.office@gmail.com" })
    @IsString()
    email: string;
}
