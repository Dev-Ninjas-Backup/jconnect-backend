import { ForbiddenException, HttpException, Injectable, NotFoundException } from "@nestjs/common";
import { AppError } from "src/common/error/handle-error.app";
import { successResponse, TResponse } from "src/common/utilsResponse/response.util";
import { MailService } from "src/lib/mail/mail.service";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { UtilsService } from "src/lib/utils/utils.service";

import { JwtService } from "@nestjs/jwt";
import { RegisterDto } from "../dto/register.dto";

import { UserResponseDto } from "@common/enum/dto/user.response";

import { EventEmitter2 } from "@nestjs/event-emitter";
import { Role, ValidationType } from "@prisma/client";
import { HandleError } from "src/common/error/handle-error.decorator";
import { DeviceService } from "src/lib/device/device.service";
import { TwilioService } from "src/lib/twilio/twilio.service";
import { ForgotPasswordDto } from "../dto/forgot-password.dto";
import { LoginDto } from "../dto/login.dto";
import { SendPhoneOtpDto, VerifyPhoneOtpDto } from "../dto/phone-login";
import { ResetPasswordAuthDto } from "../dto/reset-password";
import { ResendEmailDto, ResendverifyOtpDto, VerifyOtpAuthDto } from "../dto/varify-otp.dto";

import { UserRegistration } from "@main/shared/notification/interface/events-payload";
import { EVENT_TYPES } from "@main/shared/notification/interface/events.name";
import { StripeService } from "@main/stripe/stripe.service";

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly utils: UtilsService,
        private readonly mail: MailService,
        private readonly jwt: JwtService,
        private readonly deviceService: DeviceService,
        private readonly twilio: TwilioService,
        private readonly stripe: StripeService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    // ---------- REGISTER (send email verification OTP) ----------
    @HandleError("Failed to Register profile", "Register ")
    async register(payload: RegisterDto, userAgent?: string, ipAddress?: string) {
        const { email, password, full_name, phone } = payload;

        // ------------------Check if user already exists----------------------
        const existing = await this.prisma.user.findFirst({
            where: { OR: [{ email }, { username: payload.username }] },
        });
        if (existing) {
            throw new AppError(400, "User already exists with this email");
        }

        // create a unique username if not provided and if provided check uniqueness

        let username = full_name.toLowerCase().replace(/\s+/g, "").trim();
        let isUnique = false;

        while (!isUnique) {
            const exists = await this.prisma.user.findUnique({
                where: { username },
            });
            console.log(username);

            if (!exists) {
                isUnique = true;
            } else {
                username = `${full_name.toLowerCase().replace(/\s+/g, "").trim()}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            }
        }

        // Hash the password
        const hashedPassword = await this.utils.hash(password);

        // Generate OTP
        const { otp, expiryTime } = this.utils.generateOtpAndExpiry();

        const customers = await this.stripe.createCustomer(email, full_name);
        // Create new user with OTP
        const newUser = await this.prisma.user.create({
            data: {
                email,
                username,
                full_name: full_name,
                phone: phone,
                fcmToken: payload.fcmToken,
                password: hashedPassword,
                isVerified: false,
                role: Role.ARTIST,
                emailOtp: otp,
                otpExpiresAt: expiryTime,
                customerIdStripe: customers.id,
            },
        });

        // ❌ REMOVED: Device tracking moved to post-verification/login step.
        // if (userAgent && ipAddress) {
        //     await this.deviceService.saveDeviceInfo(newUser.id, userAgent, ipAddress);
        // }

        console.log("the new user", newUser);

        // Send OTP email (non-blocking)
        try {
            await this.mail.sendEmail(
                email,
                "Welcome to DaConnect - Verify Your Email 🎉",
                `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f7fa; }
                    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
                    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; }
                    .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; letter-spacing: 1px; }
                    .content { padding: 40px 30px; }
                    .otp-code { font-size: 42px; font-weight: bold; color: #059669; letter-spacing: 10px; margin: 15px 0; font-family: 'Courier New', monospace; text-align: center; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #10b981; padding: 30px; border-radius: 10px; }
                    .info-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 25px 0; border-radius: 6px; }
                    .footer { text-align: center; padding: 25px; background: #f8fafc; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; }
                    .brand-name { color: #10b981; font-weight: 600; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🎵 DjConnect</div>
                        <div style="font-size: 16px; opacity: 0.95;">Welcome to Our Community!</div>
                    </div>
                    <div class="content">
                        <h2 style="color: #1e293b; margin-bottom: 20px;">Hi ${full_name}! 👋</h2>
                        <p style="font-size: 16px; color: #475569;">Thank you for joining <span class="brand-name">DaConnect</span>! We're thrilled to have you in our community of artists and music lovers.</p>
                        <p style="color: #475569;">To complete your registration and unlock all features, please verify your email using the code below:</p>
                        <div class="otp-code">${otp}</div>
                        <div class="info-box">
                            <strong style="color: #92400e;">⏰ Quick Action:</strong> This verification code expires in <strong>10 minutes</strong>.
                        </div>
                        <p style="font-size: 14px; color: #64748b; margin-top: 25px;">Once verified, you'll be able to explore services, connect with artists, and much more!</p>
                    </div>
                    <div class="footer">
                        <p style="margin: 5px 0;">This is an automated email from <strong class="brand-name">DaConnect</strong>.</p>
                        <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} DaConnect. All rights reserved.</p>
                        <p style="margin: 10px 0; font-size: 12px;">Empowering artists and connecting communities through music.</p>
                    </div>
                </div>
            </body>
            </html>
    `,
            );
            console.log(`📧 Registration OTP email sent to ${email}`);
        } catch (error) {
            console.error(`❌ Failed to send registration email to ${email}: ${error.message}`);
        }

        // Generate JWT token for verification
        const jwtPayload = { id: newUser.id };
        const resetToken = await this.jwt.signAsync(jwtPayload, {
            expiresIn: "10m",
        });

        return { resetToken };
    }

    // ---------- LOGIN (require verified) ----------
    @HandleError("Failed to Login profile", "Login ")
    async login(dto: LoginDto, userAgent?: string, ipAddress?: string): Promise<TResponse<any>> {
        const { email, password, fcmToken } = dto;

        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) throw new AppError(404, "User not found");

        if (!user.isVerified) throw new AppError(400, "Please verify your email first");

        if (!user.password) throw new AppError(400, "No password set for this account");

        const isMatch = await this.utils.compare(password, user.password);
        if (!isMatch) throw new AppError(400, "Invalid credentials");

        // Update last login timestamp and FCM token
        const updatedUser = await this.prisma.user.update({
            where: { id: user.id },
            data: {
                last_login_at: new Date(),
                isLogin: true,
                login_attempts: 0,
                ...(fcmToken && { fcmToken }),
            },
        });

        // Track device information on successful LOGIN
        if (userAgent && ipAddress) {
            await this.deviceService.saveDeviceInfo(user.id, userAgent, ipAddress);
        }

        const token = this.utils.generateToken({
            sub: updatedUser.id,
            email: updatedUser.email,
            roles: updatedUser.role as any,
        });

        const safeUser = this.utils.sanitizedResponse(UserResponseDto, updatedUser);
        const device = await this.deviceService.getUserDevices(updatedUser.id);

        return successResponse({ token, user: safeUser, devices: device }, "Login successful");
    }

    // ---------- FORGOT PASSWORD  ----------
    @HandleError("Failed to process forgot password", "ForgotPassword")
    async forgetPassword(payload: ForgotPasswordDto) {
        const { email } = payload;

        // -------------Find user by email --------------
        const user = await this.prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            throw new NotFoundException("User does not exist!");
        }

        // -------------Generate OTP --------------
        const { otp, expiryTime } = this.utils.generateOtpAndExpiry();

        // -------------Store OTP and expiry in user record --------------
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                emailOtp: otp,
                otpExpiresAt: expiryTime,
            },
        });

        // Send OTP email (non-blocking)
        try {
            await this.mail.sendEmail(
                email,
                "Reset Your DaConnect Password 🔐",
                `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f7fa; }
                    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
                    .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 40px 30px; text-align: center; }
                    .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; letter-spacing: 1px; }
                    .content { padding: 40px 30px; }
                    .otp-code { font-size: 42px; font-weight: bold; color: #dc2626; letter-spacing: 10px; margin: 15px 0; font-family: 'Courier New', monospace; text-align: center; background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 2px solid #ef4444; padding: 30px; border-radius: 10px; }
                    .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 25px 0; border-radius: 6px; }
                    .security-box { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 16px; margin: 25px 0; border-radius: 6px; }
                    .footer { text-align: center; padding: 25px; background: #f8fafc; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; }
                    .brand-name { color: #ef4444; font-weight: 600; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🎵 DaConnect</div>
                        <div style="font-size: 16px; opacity: 0.95;">Password Reset Request</div>
                    </div>
                    <div class="content">
                        <h2 style="color: #1e293b; margin-bottom: 20px;">Hi ${user.full_name || "there"}! 🔐</h2>
                        <p style="font-size: 16px; color: #475569;">We received a password reset request for your <span class="brand-name">DaConnect</span> account.</p>
                        <p style="color: #475569;">Use the verification code below to reset your password:</p>
                        <div class="otp-code">${otp}</div>
                        <div class="warning-box">
                            <strong style="color: #92400e;">⏰ Time Sensitive:</strong> This code expires in <strong>10 minutes</strong>.
                        </div>
                        <div class="security-box">
                            <strong style="color: #1e40af;">🛡️ Security Alert:</strong>
                            <p style="margin: 10px 0 0 0; color: #475569;">If you didn't request this, please ignore this email or contact support if you're concerned about your account security.</p>
                        </div>
                    </div>
                    <div class="footer">
                        <p style="margin: 5px 0;">This is an automated email from <strong class="brand-name">DaConnect</strong>.</p>
                        <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} DaConnect. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
    `,
            );
            console.log(`📧 Password reset email sent to ${email}`);
        } catch (error) {
            console.error(`❌ Failed to send password reset email to ${email}: ${error.message}`);
        }

        // Generate JWT token for verification
        const jwtPayload = { id: user.id };
        const resetToken = await this.jwt.signAsync(jwtPayload, {
            expiresIn: "10m",
        });

        return { resetToken };
    }

    // ---------------

    // ---------- VERIFY OTP (for signup) ----------
    @HandleError("Failed to verify OTP", "VerifyOTP")
    async verifyOtp(payload: VerifyOtpAuthDto, userAgent?: string, ipAddress?: string) {
        let decoded: any;
        try {
            decoded = await this.jwt.verifyAsync(payload.resetToken);
        } catch (err) {
            throw new ForbiddenException("Invalid or expired token!");
        }

        //  Find user from decoded token
        const user = await this.prisma.user.findUnique({
            where: { id: decoded.id },
        });

        if (!user) throw new ForbiddenException("User not found!");

        //  Check OTP expiry
        if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
            throw new ForbiddenException("OTP has expired!");
        }

        // Check OTP match
        if (user.emailOtp !== Number(payload.emailOtp)) {
            throw new ForbiddenException("OTP does not match!");
        }

        //  Mark user as verified & clear OTP
        const updatedUser = await this.prisma.user.update({
            where: { id: user.id },
            data: {
                emailOtp: null,
                otpExpiresAt: null,
                isVerified: true,
                last_login_at: new Date(),
            },
        });

        // Save device info (first login)
        if (userAgent && ipAddress) {
            await this.deviceService.saveDeviceInfo(user.id, userAgent, ipAddress);
        }

        // Generate Auth Token
        const token = await this.jwt.signAsync(
            { id: user.id, email: user.email, roles: user.role },
            { secret: process.env.JWT_SECRET, expiresIn: "77d" },
        );

        const safeUser = this.utils.sanitizedResponse(UserResponseDto, updatedUser);
        const devices = await this.deviceService.getUserDevices(user.id);

        // Example location: after user is created in database

        // Get all SUPERADMIN users
        const superAdmins = await this.prisma.user.findMany({
            where: {
                role: Role.SUPER_ADMIN,
                isActive: true,
                isDeleted: false,
            },
            select: { id: true, email: true },
        });

        // Emit registration event
        this.eventEmitter.emit(EVENT_TYPES.USERREGISTRATION_CREATE, {
            action: "CREATE",
            info: {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.full_name,
                role: updatedUser.role,
                phone: updatedUser.phone,
                authProvider: updatedUser.auth_provider,
                validationType: updatedUser.validation_type,
                createdAt: updatedUser.created_at,
                recipients: superAdmins,
            },
            meta: {
                registrationMethod: "email",
            },
        } as unknown as UserRegistration);
        return {
            success: true,
            message: "OTP verified successfully",
            data: {
                token,
                user: safeUser,
            },
            devices,
        };
    }
    // --------------resend otp------------

    async verifyResentOtp(payload: ResendverifyOtpDto, userAgent?: string, ipAddress?: string) {
        const { emailOtp, resetToken } = payload;

        let decoded: any;
        try {
            decoded = await this.jwt.verifyAsync(resetToken);
        } catch {
            throw new ForbiddenException("Invalid or expired token!");
        }

        const user = await this.prisma.user.findUnique({
            where: { id: decoded.id },
        });

        if (!user) {
            throw new ForbiddenException("User not found!");
        }

        if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
            throw new ForbiddenException("OTP has expired!");
        }

        if (user.emailOtp !== Number(emailOtp)) {
            throw new ForbiddenException("OTP does not match!");
        }

        const updatedUser = await this.prisma.user.update({
            where: { id: user.id },
            data: {
                emailOtp: null,
                otpExpiresAt: null,
                isVerified: true,
                last_login_at: new Date(),
            },
        });

        if (userAgent && ipAddress) {
            await this.deviceService.saveDeviceInfo(user.id, userAgent, ipAddress);
        }

        const token = await this.jwt.signAsync(
            { id: user.id, email: user.email, roles: user.role },
            { secret: process.env.JWT_SECRET, expiresIn: "77d" },
        );

        const safeUser = this.utils.sanitizedResponse(UserResponseDto, updatedUser);
        const devices = await this.deviceService.getUserDevices(user.id);

        return {
            success: true,
            message: "OTP verified successfully",
            data: {
                token,
                user: safeUser,
            },
            devices,
        };
    }

    // -----------resend otp email ----

    async resendEmail(payload: ResendEmailDto) {
        const { email } = payload;

        const user = await this.prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return { message: "If this email is registered, an OTP has been sent." };
        }

        if (user.isVerified === true) {
            return { message: "Account already verified." };
        }

        // Generate OTP
        const { otp, expiryTime } = this.utils.generateOtpAndExpiry();

        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                emailOtp: otp,
                otpExpiresAt: expiryTime,
            },
        });

        //---------------------  Send OTP email (non-blocking) ----------------------
        try {
            await this.mail.sendEmail(
                email,
                "DaConnect Account Verification - New Code 🔄",
                `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f7fa; }
                    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
                    .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 40px 30px; text-align: center; }
                    .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; letter-spacing: 1px; }
                    .content { padding: 40px 30px; }
                    .otp-code { font-size: 42px; font-weight: bold; color: #7c3aed; letter-spacing: 10px; margin: 15px 0; font-family: 'Courier New', monospace; text-align: center; background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); border: 2px solid #8b5cf6; padding: 30px; border-radius: 10px; }
                    .info-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 25px 0; border-radius: 6px; }
                    .footer { text-align: center; padding: 25px; background: #f8fafc; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; }
                    .brand-name { color: #8b5cf6; font-weight: 600; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🎵 DaConnect</div>
                        <div style="font-size: 16px; opacity: 0.95;">New Verification Code</div>
                    </div>
                    <div class="content">
                        <h2 style="color: #1e293b; margin-bottom: 20px;">Hi ${user.full_name || "there"}! 👋</h2>
                        <p style="font-size: 16px; color: #475569;">You requested a new verification code for your <span class="brand-name">DaConnect</span> account.</p>
                        <p style="color: #475569;">Here's your fresh verification code:</p>
                        <div class="otp-code">${otp}</div>
                        <div class="info-box">
                            <strong style="color: #92400e;">⏰ Fresh Code:</strong> This new verification code will expire in <strong>10 minutes</strong>.
                        </div>
                        <p style="font-size: 14px; color: #64748b; margin-top: 25px;">Almost there! Complete your verification to join the DaConnect community.</p>
                    </div>
                    <div class="footer">
                        <p style="margin: 5px 0;">This is an automated email from <strong class="brand-name">DaConnect</strong>.</p>
                        <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} DaConnect. All rights reserved.</p>
                        <p style="margin: 10px 0; font-size: 12px;">Empowering artists and connecting communities through music.</p>
                    </div>
                </div>
            </body>
            </html>
    `,
            );
            console.log(`📧 Resend OTP email sent to ${email}`);
        } catch (error) {
            console.error(`❌ Failed to send resend OTP email to ${email}: ${error.message}`);
        }

        const resetToken = await this.jwt.signAsync({ id: user.id }, { expiresIn: "10m" });

        return {
            message: "If this email is registered, an OTP has been sent.",
            resetToken,
        };
    }

    // ---------- VERIFY OTP (for password reset ) ----------
    @HandleError("Failed to verify reset OTP", "ResetVerifyOTP")
    async resetverifyOtp(payload: VerifyOtpAuthDto) {
        // ---------------- Verify the JWT token ----------------
        let decoded: any;
        try {
            decoded = await this.jwt.verifyAsync(payload.resetToken);
        } catch (err) {
            throw new ForbiddenException("Invalid or expired token!");
        }

        // Find user by ID from the token
        const user = await this.prisma.user.findUnique({
            where: { id: decoded.id },
        });

        if (!user) {
            throw new ForbiddenException("User not found!");
        }

        // Check if OTP has expired
        if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
            throw new ForbiddenException("OTP has expired!");
        }

        // Check OTP match
        if (user.emailOtp !== parseInt(payload.emailOtp)) {
            throw new ForbiddenException("OTP does not match!");
        }

        // Clear OTP and expiry
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                emailOtp: null,
                otpExpiresAt: null,
            },
        });

        // Generate a new JWT token for password reset
        const jwtPayload = { id: user.id };
        const resetToken = await this.jwt.signAsync(jwtPayload, {
            expiresIn: "10m",
        });

        return { resetToken };
    }

    // ------------------------- phone otp verification via sms -------------------------
    // ---------- SEND PHONE OTP (signup / login / forgot ) ----------
    @HandleError("Failed to send phone OTP", "SendPhoneOtp")
    async sendPhoneOtp(dto: SendPhoneOtpDto) {
        let phone = dto.phone;
        if (!phone.startsWith("+")) phone = `+${phone}`;

        // Find or create user (for login/forgot we need the record)
        let user = await this.prisma.user.findFirst({ where: { phone } });
        const isNew = !user;

        if (isNew) {
            // optional: create a “pre-user” record so we can store OTP
            user = await this.prisma.user.create({
                data: {
                    phone,
                    validation_type: ValidationType.PHONE,
                    full_name: "",
                    email: `temp_${Date.now()}@temp.com`,
                    password: "",
                },
            });
        }

        if (!user) throw new AppError(404, "User creation failed");

        const { otp, expiryTime } = this.utils.generateOtpAndExpiry();

        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                phoneOtp: otp,
                phoneOtpExpiresAt: expiryTime,
                isVerified: true,
                validation_type: ValidationType.PHONE,
            },
        });

        await this.twilio.sendOtpSms(phone, otp);

        // JWT only needed for password-reset flow
        const payload = { id: user.id };
        const resetToken = await this.jwt.signAsync(payload, { expiresIn: "10m" });

        return { resetToken, message: "OTP sent to phone" };
    }

    // ---------- VERIFY PHONE OTP (signup / login) ----------
    @HandleError("Failed to verify phone OTP", "VerifyPhoneOtp")
    async verifyPhoneOtp(dto: VerifyPhoneOtpDto, userAgent?: string, ipAddress?: string) {
        const phone = dto.phone.startsWith("+") ? dto.phone : `+${dto.phone}`;

        const user = await this.prisma.user.findFirst({ where: { phone } });
        if (!user) throw new AppError(404, "Phone not registered");

        if (user.phoneOtpExpiresAt && user.phoneOtpExpiresAt < new Date())
            throw new AppError(400, "OTP expired");

        if (user.phoneOtp !== dto.otp) throw new AppError(400, "Invalid OTP");

        // Clear OTP & mark phone verified
        const updated = await this.prisma.user.update({
            where: { id: user.id },
            data: {
                phoneOtp: null,
                phoneOtpExpiresAt: null,
                phoneVerified: true,
                isVerified: true,
                validation_type: ValidationType.PHONE,
                last_login_at: new Date(),
            },
        });

        if (userAgent && ipAddress) {
            await this.deviceService.saveDeviceInfo(updated.id, userAgent, ipAddress);
        }

        const token = this.utils.generateToken({
            sub: updated.id,
            email: updated.email ?? "",
            roles: updated.role,
        });

        const safeUser = this.utils.sanitizedResponse(UserResponseDto, updated);
        const devices = await this.deviceService.getUserDevices(updated.id);

        return successResponse(
            { token, user: safeUser, devices },
            "Phone verified – login successful",
        );
    }

    // ---------- FORGOT PASSWORD VIA PHONE  ----------
    @HandleError("Failed to process phone forgot password", "PhoneForgot")
    async phoneForgotPassword(dto: SendPhoneOtpDto) {
        if (!dto.phone) throw new HttpException("phone number required", 400);
        const phone = dto.phone.startsWith("+") ? dto.phone : `+${dto.phone}`;
        const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
        // console.log("this is user", user, phone);

        if (!user) throw new NotFoundException("Phone not registered");

        const { otp, expiryTime } = this.utils.generateOtpAndExpiry();
        await this.prisma.user.update({
            where: { id: user.id },
            data: { phoneOtp: otp, phoneOtpExpiresAt: expiryTime },
        });

        await this.twilio.sendOtpSms(phone, otp);

        const resetToken = await this.jwt.signAsync({ id: user.id }, { expiresIn: "10m" });

        return { resetToken };
    }

    // ---------- VERIFY PHONE OTP FOR PASSWORD RESET  ----------
    @HandleError("Failed to verify phone reset OTP", "PhoneResetVerify")
    async phoneResetVerifyOtp(dto: VerifyPhoneOtpDto) {
        // token verification
        let decoded: any;
        try {
            decoded = await this.jwt.verifyAsync(dto.resetToken!);
        } catch {
            throw new ForbiddenException("Invalid/expired token");
        }

        const user = await this.prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user) throw new NotFoundException("User not found");

        if (user.phoneOtpExpiresAt && user.phoneOtpExpiresAt < new Date())
            throw new AppError(400, "OTP expired");

        if (user.phoneOtp !== dto.otp) throw new AppError(400, "Invalid OTP");

        await this.prisma.user.update({
            where: { id: user.id },
            data: { phoneOtp: null, phoneOtpExpiresAt: null },
        });

        const newResetToken = await this.jwt.signAsync({ id: user.id }, { expiresIn: "10m" });
        return { resetToken: newResetToken };
    }

    // ---------- RESET PASSWORD ----------
    @HandleError("Failed to reset password", "ResetPassword")
    async resetPassword(payload: ResetPasswordAuthDto) {
        // Verify token
        let decoded: any;
        try {
            decoded = await this.jwt.verifyAsync(payload.resetToken);
        } catch (err) {
            throw new ForbiddenException("Invalid or expired token!");
        }

        // Find user by ID
        const user = await this.prisma.user.findUnique({
            where: { id: decoded.id },
        });

        if (!user) {
            throw new NotFoundException("User not found!");
        }

        // Hash new password
        const hashedPassword = await this.utils.hash(payload.password);

        // Update user password
        await this.prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
        });

        return { message: "Password reset successfully" };
    }

    // ----------get devices from user ----------
    getUserDevices(userId: string) {
        return this.deviceService.getUserDevices(userId);
    }

    // ------------- Logout from all devices --
    async logoutAllDevices(userId: string) {
        await this.deviceService.removeAllUserDevices(userId);
        return { message: "Logged out from all devices successfully" };
    }
}
