import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class LoginDto {
    @ApiProperty({
        example: "superadmin@gmail.com",
        description: "Email address of the user",
    })
    @IsNotEmpty({ message: "Email is required" })
    @IsEmail({}, { message: "Please provide a valid email address" })
    email: string;

    @ApiProperty({
        example: "12345678",
        description: "User password",
    })
    @IsNotEmpty({ message: "Password is required" })
    @IsString()
    password: string;
    @ApiProperty({
        example: "fcmToken",
        description: "FCM token for push notifications",
    })
    @IsString()
    //  ------------ fcmToken is optional, as it may not be provided during login, but can be updated later when the user logs in from a device that supports push notifications. ------------
    @ApiProperty({
        example: "fcmToken",
        description: "FCM token for push notifications (optional)",
    })
    @IsOptional()
    fcmToken?: string;
}
