import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { GoogleLoginDto } from "../dto/google-login.dto";

import { ENVEnum } from "src/common/enum/env.enum";
import { HandleError } from "src/common/error/handle-error.decorator";

import { UserResponseDto } from "@common/enum/dto/user.response";
import { successResponse, TResponse } from "@common/utilsResponse/response.util";
import { AppError } from "src/common/error/handle-error.app";
import { UtilsService } from "src/lib/utils/utils.service";

@Injectable()
export class AuthGoogleService {
    private googleClient: OAuth2Client;

    constructor(
        private readonly prisma: PrismaService,
        private readonly utils: UtilsService,
        private readonly configService: ConfigService,
    ) {
        this.googleClient = new OAuth2Client(
            this.configService.get<string>(ENVEnum.OAUTH_CLIENT_ID),
        );
    }

    @HandleError("Google login failed", "User")
    async googleLogin(dto: GoogleLoginDto): Promise<TResponse<any>> {
        const { idToken } = dto;

        if (!idToken) {
            throw new AppError(400, "Google ID token is required");
        }

        const payload = await this.verifyGoogleIdToken(idToken);

        // Check if user already exists
        let user = await this.prisma.user.findUnique({
            where: { email: payload.email },
        });

        if (!user) {
            // Create new user with Google data
            user = await this.prisma.user.create({
                data: {
                    email: payload.email as string,
                    full_name: payload.name || "Google User",
                    googleId: payload.sub,
                    isVerified: true,
                    auth_provider: "GOOGLE",
                    password: "",
                },
            });
        } else if (!user.googleId) {
            // Link Google account to existing user
            user = await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    googleId: payload.sub,
                    isVerified: true,
                    auth_provider: "GOOGLE",
                },
            });
        }

        // Update last login
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                last_login_at: new Date(),
                isLogin: true,
            },
        });

        const token = this.utils.generateToken({
            sub: user.id,
            email: user.email,
            roles: user.role,
        });

        return successResponse(
            {
                user: this.utils.sanitizedResponse(UserResponseDto, user),
                token,
            },
            "User logged in successfully",
        );
    }

    private async verifyGoogleIdToken(idToken: string): Promise<TokenPayload> {
        const ticket = await this.googleClient.verifyIdToken({
            idToken,
            audience: this.configService.get<string>(ENVEnum.OAUTH_CLIENT_ID),
        });

        const payload = ticket.getPayload();

        if (!payload) {
            throw new AppError(400, "Invalid Google token");
        }

        const { sub, email } = payload;

        if (!email || !sub) {
            throw new AppError(400, "Google token does not contain required user information");
        }

        return payload;
    }
}
