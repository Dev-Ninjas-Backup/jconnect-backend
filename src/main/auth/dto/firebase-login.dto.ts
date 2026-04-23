import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class FirebaseLoginDto {
    @ApiProperty({
        example: "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2...",
        description:
            "Firebase ID token obtained from Firebase Authentication (Google or Apple Sign-In)",
    })
    @IsString()
    @IsNotEmpty()
    idToken: string;

    @ApiProperty({
        example: "google",
        description: "Provider type: 'google' or 'apple'",
        enum: ["google", "apple"],
    })
    @IsString()
    @IsNotEmpty()
    provider: "google" | "apple";

    @ApiProperty({
        example: "john_doe",
        description: "Optional username for new user registration",
        required: false,
    })
    @IsString()
    @IsOptional()
    username?: string;

    // --- fcmToken is optional and can be used for push notifications ---
    @ApiProperty({
        example: "fcm_token_example_123456",
        description: "Optional FCM token for push notifications",
        required: false,
    })
    @IsString()
    @IsOptional()
    fcmToken?: string;
}
