import { Role } from "@prisma/client";
import { Expose } from "class-transformer";

export class UserResponseDto {
    @Expose()
    id: string;

    @Expose()
    full_name: string;

    @Expose()
    email: string;

    @Expose()
    profilePhoto?: string;

    @Expose()
    phone?: string;

    @Expose()
    role: Role;

    @Expose()
    isVerified: boolean;

    @Expose()
    isActive: boolean;

    @Expose()
    isDeleted: boolean;

    @Expose()
    is_terms_agreed: boolean;

    @Expose()
    created_at: Date;

    @Expose()
    updated_at: Date;

    @Expose()
    last_login_at?: Date;

    @Expose()
    login_attempts?: number;

    @Expose()
    auth_provider?: string;

    @Expose()
    validation_type?: string;

    @Expose()
    googleId?: string;

    @Expose()
    token_expires_at?: Date;
}
