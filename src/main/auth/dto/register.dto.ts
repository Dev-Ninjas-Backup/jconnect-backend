import { IsOptional } from "class-validator";
// ==================== register.dto.ts ====================
import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
    @ApiProperty({
        example: "demo user",
        description: "Full name of the user",
    })
    @IsNotEmpty({ message: "Full name is required" })
    @IsString()
    @MinLength(2, { message: "Full name must be at least 2 characters" })
    @MaxLength(100, { message: "Full name must not exceed 100 characters" })
    full_name: string;

    @ApiProperty({
        example: "demo@gmail.com",
        description: "Email address of the user",
    })
    @IsNotEmpty({ message: "Email is required" })
    @IsEmail({}, { message: "Please provide a valid email address" })
    email: string;

    // @ApiProperty({
    //     example: "demoUser123",
    //     description: "Username of the user",
    // })
    @IsOptional()
    @IsString()
    username?: string;

    @ApiProperty({
        example: "12345678",
        description:
            "Password (min 8 chars, must include uppercase, lowercase, number, and special character)",
    })
    @IsNotEmpty({ message: "Password is required" })
    @IsString()
    @MinLength(8, { message: "Password must be at least 8 characters long" })
    password: string;

    //---------------  Optional phone number field ------------------
    @ApiProperty({
        example: "01909616418",
        description: "Phone number of the user (optional)",
        required: false,
    })
    @IsString()
    phone?: string;

    // ---fcm token for push notifications (optional)---
    @ApiProperty({
        example: "fcm_token_example",
        description: "FCM token for push notifications (optional)",
        required: false,
    })
    @IsOptional()
    @IsString()
    fcmToken?: string;
}
