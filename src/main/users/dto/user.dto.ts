import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AuthProvider, Role, ValidationType } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
    IsArray,
    IsBoolean,
    IsDateString,
    IsEmail,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    MinLength,
    ValidateNested,
} from "class-validator";

export class CreateUserDto {
    @ApiProperty({ example: "John Doe" })
    @IsString()
    full_name: string;

    @ApiProperty({ example: "john@example.com" })
    @IsEmail()
    email: string;

    @ApiProperty({ example: "https://example.com/profile.jpg", required: false })
    @IsOptional()
    @IsString()
    profilePhoto?: string;

    @ApiProperty({ example: "+8801700000000", required: false })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiProperty({ example: "Pass@1234" })
    @IsString()
    @MinLength(6, { message: "Password must be at least 6 characters long" })
    password: string;

    @ApiProperty({ example: 1234, required: false })
    @IsOptional()
    @IsInt()
    pinCode?: number;

    @ApiProperty({ example: "123456", required: false })
    @IsOptional()
    @IsString()
    otp?: string;

    @ApiProperty({ example: "google-12345", required: false })
    @IsOptional()
    @IsString()
    googleId?: string;

    @ApiProperty({ example: "new-yourk usa", required: false })
    @IsOptional()
    @IsString()
    location?: string;

    @ApiProperty({ example: ["music", "art"], required: false })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    hashTags?: string[];

    @ApiProperty({ example: 123456, required: false })
    @IsOptional()
    @IsInt()
    emailOtp?: number;

    @ApiProperty({ example: "2025-11-12T12:00:00Z", required: false })
    @IsOptional()
    @IsDateString()
    otpExpiresAt?: Date;

    @ApiProperty({ example: false, required: false })
    @IsOptional()
    @IsBoolean()
    isVerified?: boolean;

    @ApiProperty({ example: true, required: false })
    @IsOptional()
    @IsBoolean()
    is_terms_agreed?: boolean;

    @ApiProperty({ example: false, required: false })
    @IsOptional()
    @IsBoolean()
    isLogin?: boolean;

    @ApiProperty({ example: false, required: false })
    @IsOptional()
    @IsBoolean()
    isDeleted?: boolean;

    @ApiProperty({ example: true, required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiProperty({ example: 0, required: false })
    @IsOptional()
    @IsInt()
    login_attempts?: number;

    @ApiProperty({ example: 654321, required: false })
    @IsOptional()
    @IsInt()
    phoneOtp?: number;

    @ApiProperty({ example: "2025-11-12T12:00:00Z", required: false })
    @IsOptional()
    @IsDateString()
    phoneOtpExpiresAt?: Date;

    @ApiProperty({ example: false, required: false })
    @IsOptional()
    @IsBoolean()
    phoneVerified?: boolean;

    @ApiProperty({ example: "2025-11-12T10:00:00Z", required: false })
    @IsOptional()
    @IsDateString()
    last_login_at?: Date;

    @ApiProperty({ example: "2025-11-12T11:00:00Z", required: false })
    @IsOptional()
    @IsDateString()
    token_expires_at?: Date;

    @ApiProperty({ example: "USER", enum: Role, required: false })
    @IsOptional()
    @IsEnum(Role)
    role?: Role;

    @ApiProperty({ example: "EMAIL", enum: ValidationType, required: false })
    @IsOptional()
    @IsEnum(ValidationType)
    validation_type?: ValidationType;

    @ApiProperty({ example: "GOOGLE", enum: AuthProvider, required: false })
    @IsOptional()
    @IsEnum(AuthProvider)
    auth_provider?: AuthProvider;
}

export class UpdateUserDto {
    @ApiProperty({ example: "John Doe Updated", required: false })
    @IsOptional()
    @IsString()
    full_name?: string;

    @ApiProperty({ example: "john_new@example.com", required: false })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({ example: "john_doe", required: false })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => value?.toLowerCase().replace(/\s+/g, "").trim())
    username?: string;

    @ApiProperty({ example: "https://example.com/new-photo.jpg", required: false })
    @IsOptional()
    @IsString()
    profilePhoto?: string;

    @ApiProperty({ example: "+8801700000000", required: false })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiProperty({ example: "NewPass@123", required: false })
    @IsOptional()
    @IsString()
    @MinLength(6, { message: "Password must be at least 6 characters long" })
    password?: string;

    @ApiProperty({ example: 1234, required: false })
    @IsOptional()
    @IsInt()
    pinCode?: number;

    @ApiProperty({ example: true, required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiProperty({ example: true, required: false })
    @IsOptional()
    @IsBoolean()
    isVerified?: boolean;

    @ApiProperty({ example: false, required: false })
    @IsOptional()
    @IsBoolean()
    isDeleted?: boolean;

    @ApiProperty({ example: true, required: false })
    @IsOptional()
    @IsBoolean()
    is_terms_agreed?: boolean;

    @ApiProperty({ example: "ADMIN", enum: Role, required: false })
    @IsOptional()
    @IsEnum(Role)
    role?: Role;

    @ApiProperty({ example: "EMAIL", enum: ValidationType, required: false })
    @IsOptional()
    @IsEnum(ValidationType)
    validation_type?: ValidationType;

    @ApiProperty({ example: "GOOGLE", enum: AuthProvider, required: false })
    @IsOptional()
    @IsEnum(AuthProvider)
    auth_provider?: AuthProvider;

    @ApiProperty({ example: "2025-11-12T12:00:00Z", required: false })
    @IsOptional()
    @IsDateString()
    last_login_at?: Date;

    @ApiProperty({ example: "new-yourk usa", required: false })
    @IsOptional()
    @IsString()
    location?: string;

    @ApiProperty({ example: ["music", "art"], required: false })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    hashTags?: string[];

    @ApiProperty({ example: "2025-11-12T12:00:00Z", required: false })
    @IsOptional()
    @IsDateString()
    token_expires_at?: Date;
}

export class UpdateMeDto {
    @ApiProperty({ example: "John Doe", required: false })
    @IsOptional()
    @IsString()
    full_name?: string;

    @ApiProperty({ example: "john_doe", required: false })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => value?.toLowerCase().replace(/\s+/g, "").trim())
    username?: string;

    @ApiProperty({ example: "+8801700000000", required: false })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiHideProperty()
    @IsOptional()
    @IsString()
    profilePhoto?: string;

    @ApiProperty({ example: "new-yourk usa", required: false })
    @IsOptional()
    @IsString()
    location?: string;

    @ApiProperty({ example: ["music", "art"], required: false })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    hashTags?: string[];

    @ApiHideProperty()
    @IsOptional()
    @IsString()
    profile_image_url?: string;

    @ApiProperty({ example: "DJ / Producer", required: false })
    @IsOptional()
    @IsString()
    short_bio?: string;

    @ApiPropertyOptional({ type: () => [SocialProfileInput] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SocialProfileInput)
    socialProfiles?: SocialProfileInput[];
}

export class SocialProfileInput {
    @ApiProperty({ example: "Instagram" })
    @IsString()
    platformName: string;

    @ApiProperty({ example: "https://instagram.com/johnartist" })
    @IsString()
    platformLink: string;
}

export class reset_password {
    @ApiProperty({ example: "xxxxxx", required: true })
    @IsString()
    old: string;

    @ApiProperty({ example: "MIn6@ssa", required: true })
    @IsString()
    @MinLength(6, { message: "Password must be at least 6 characters long" })
    newPass: string;
}
