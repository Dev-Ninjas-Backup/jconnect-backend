import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as admin from "firebase-admin";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { FirebaseLoginDto } from "../dto/firebase-login.dto";

import { ENVEnum } from "src/common/enum/env.enum";
import { HandleError } from "src/common/error/handle-error.decorator";

import { UserResponseDto } from "@common/enum/dto/user.response";
import { successResponse, TResponse } from "@common/utilsResponse/response.util";
import { StripeService } from "@main/stripe/stripe.service";
import { Role } from "@prisma/client";
import { AppError } from "src/common/error/handle-error.app";
import { UtilsService } from "src/lib/utils/utils.service";

@Injectable()
export class AuthFirebaseService {
    private firebaseApp: admin.app.App;

    constructor(
        private readonly prisma: PrismaService,
        private readonly utils: UtilsService,
        private readonly configService: ConfigService,
        private readonly stripe: StripeService,
    ) {
        this.initializeFirebase();
    }

    private initializeFirebase() {
        try {
            // Check if Firebase app already exists
            if (admin.apps.length > 0) {
                this.firebaseApp = admin.app();
                console.log("✅ Using existing Firebase Admin SDK instance");
                return;
            }

            // Get Firebase configuration from environment variables
            const projectId = this.configService.get<string>(ENVEnum.FIREBASE_PROJECT_ID);
            const privateKey = this.configService
                .get<string>(ENVEnum.FIREBASE_PRIVATE_KEY)
                ?.replace(/\\n/g, "\n"); // Replace escaped newlines
            const clientEmail = this.configService.get<string>(ENVEnum.FIREBASE_CLIENT_EMAIL);

            if (!projectId || !privateKey || !clientEmail) {
                throw new Error(
                    "Firebase configuration is incomplete. Please check your environment variables.",
                );
            }

            // Initialize Firebase Admin SDK
            this.firebaseApp = admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    privateKey,
                    clientEmail,
                }),
            });

            console.log("✅ Firebase Admin SDK initialized successfully");
        } catch (error) {
            console.error("❌ Failed to initialize Firebase Admin SDK:", error.message);
            throw error;
        }
    }

    @HandleError("Firebase login failed", "User")
    async firebaseLogin(dto: FirebaseLoginDto): Promise<TResponse<any>> {
        const { idToken, provider, username } = dto;

        if (!idToken) {
            throw new AppError(400, "Firebase ID token is required");
        }

        // Verify the Firebase ID token
        const decodedToken = await this.verifyFirebaseToken(idToken);

        // Extract user information from token
        const email = decodedToken.email;
        const firebaseUid = decodedToken.uid;
        const name = decodedToken.name || "User";
        const fcmToken = dto.fcmToken?.trim() || null;

        if (!email) {
            throw new AppError(400, "Email not found in Firebase token");
        }

        // Check if user already exists
        let user = await this.prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            // Generate unique username
            let generatedUsername = (username || name.trim().toLowerCase()).replace(/[\s_]+/g, "");
            let isUnique = false;

            while (!isUnique) {
                const exists = await this.prisma.user.findUnique({
                    where: { username: generatedUsername },
                });

                if (!exists) {
                    isUnique = true;
                } else {
                    generatedUsername = `${generatedUsername}${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
                }
            }

            // Create Stripe customer
            const customer = await this.stripe.createCustomer(email, name);

            // Create new user with Firebase data
            user = await this.prisma.user.create({
                data: {
                    email,
                    username: generatedUsername,
                    full_name: name,
                    googleId: provider === "google" ? firebaseUid : null,
                    password: "",
                    isVerified: true,
                    auth_provider: provider.toUpperCase() as any,
                    role: Role.ARTIST,
                    customerIdStripe: customer.id,
                    fcmToken: dto.fcmToken || null,
                },
            });

            console.log("🆕 New user created via Firebase:", user);
        } else {
            // Update existing user with Firebase UID if not already linked
            const updateData: any = {
                isVerified: true,
                last_login_at: new Date(),
                isLogin: true,
                ...(fcmToken && { fcmToken }),
            };

            if (provider === "google" && !user.googleId) {
                updateData.googleId = firebaseUid;
                updateData.auth_provider = "GOOGLE";
            }

            user = await this.prisma.user.update({
                where: { id: user.id },
                data: updateData,
            });
        }

        // Update last login
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                last_login_at: new Date(),
                isLogin: true,
                login_attempts: 0,
                ...(fcmToken && { fcmToken }),
            },
        });

        // Generate JWT token
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
            `User logged in successfully via ${provider}`,
        );
    }

    private async verifyFirebaseToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
        try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            return decodedToken;
        } catch (error) {
            console.error("Firebase token verification failed:", error.message);
            throw new AppError(401, "Invalid Firebase token");
        }
    }
}
