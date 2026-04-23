import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsString, Max, Min } from "class-validator";

// src/auth/dto/phone-login.dto.ts  (already in your code)
export class PhoneLoginDto {
    @ApiProperty({ example: "8801234567890" })
    @IsString()
    @IsNotEmpty()
    phone: string;
}

// src/auth/dto/send-phone-otp.dto.ts
export class SendPhoneOtpDto {
    @ApiProperty({ example: "8801234567890" })
    @IsString()
    @IsNotEmpty()
    phone: string;
}

// src/auth/dto/verify-phone-otp.dto.ts
export class VerifyPhoneOtpDto {
    @ApiProperty({ example: "8801234567890" })
    @IsString()
    @IsNotEmpty()
    phone: string;

    @ApiProperty({ example: 123456 })
    @IsInt()
    @Min(100000)
    @Max(999999)
    otp: number;

    @ApiProperty({ description: "JWT returned from /send-phone-otp" })
    @IsString()
    resetToken?: string; // only needed for password-reset flow
}
