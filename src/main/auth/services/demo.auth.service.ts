// import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
// import { AppError } from "src/common/error/handle-error.app";
// import { successResponse, TResponse } from "src/common/utilsResponse/response.util";
// import { MailService } from "src/lib/mail/mail.service";
// import { PrismaService } from "src/lib/prisma/prisma.service";
// import { UtilsService } from "src/lib/utils/utils.service";

// import { JwtService } from "@nestjs/jwt";
// import { RegisterDto } from "../dto/register.dto";

// import { UserResponseDto } from "@common/enum/dto/user.response";
// import { ValidationType } from "@prisma/client";
// import { HandleError } from "src/common/error/handle-error.decorator";
// import { DeviceService } from "src/lib/device/device.service";
// import { TwilioService } from "src/lib/twilio/twilio.service";
// import { ForgotPasswordDto } from "../dto/forgot-password.dto";
// import { LoginDto } from "../dto/login.dto";
// import { SendPhoneOtpDto, VerifyPhoneOtpDto } from "../dto/phone-login";
// import { ResetPasswordAuthDto } from "../dto/reset-password";
// import { VerifyOtpAuthDto } from "../dto/varify-otp.dto";

// @Injectable()
// export class AuthService {
//     constructor(
//         private readonly prisma: PrismaService,
//         private readonly utils: UtilsService,
//         private readonly mail: MailService,
//         private readonly jwt: JwtService,
//         private readonly deviceService: DeviceService,
//         private readonly twilio: TwilioService,
//     ) { }

//     // ---------- REGISTER (send email verification OTP) ----------
//     @HandleError("Failed to Register profile", "Register ")
//     async register(payload: RegisterDto, userAgent?: string, ipAddress?: string) {
//         const { email, password, full_name, phone } = payload;

//         // Check if user already exists
//         const existing = await this.prisma.user.findUnique({ where: { email } });
//         if (existing) {
//             throw new AppError(400, "User already exists with this email");
//         }

//         // Hash the password
//         const hashedPassword = await this.utils.hash(password);

//         // Generate OTP
//         const { otp, expiryTime } = this.utils.generateOtpAndExpiry();

//         // Create new user with OTP
//         const newUser = await this.prisma.user.create({
//             data: {
//                 email,
//                 full_name: full_name,
//                 phone: phone,
//                 password: hashedPassword,
//                 isVerified: false,
//                 emailOtp: otp,
//                 otpExpiresAt: expiryTime,
//             },
//         });

//         //Track device information (async, non-blocking)
//         if (userAgent && ipAddress) {
//             await this.deviceService.saveDeviceInfo(newUser.id, userAgent, ipAddress);
//         }
//         console.log("the new user", newUser);

//         // Send OTP email
//         await this.mail.sendEmail(
//             email,
//             "Verify Your Email",
//             `
//       <h3>Hi ${full_name},</h3>
//       <p>Use the OTP below to verify your email:</p>
//       <h2>${otp}</h2>
//       <p>This OTP will expire in 10 minutes.</p>
//     `,
//         );

//         // Generate JWT token for verification
//         const jwtPayload = { id: newUser.id };
//         const resetToken = await this.jwt.signAsync(jwtPayload, {
//             expiresIn: "10m",
//         });

//         return { resetToken };
//     }

//     // ---------- LOGIN (require verified) ----------
//     @HandleError("Failed to Login profile", "Login ")
//     async login(dto: LoginDto, userAgent?: string, ipAddress?: string): Promise<TResponse<any>> {
//         const { email, password } = dto;

//         const user = await this.prisma.user.findUnique({ where: { email } });
//         if (!user) throw new AppError(404, "User not found");

//         if (!user.isVerified) throw new AppError(400, "Please verify your email first");

//         if (!user.password) throw new AppError(400, "No password set for this account");

//         const isMatch = await this.utils.compare(password, user.password);
//         if (!isMatch) throw new AppError(400, "Invalid credentials");

//         // Update last login timestamp
//         await this.prisma.user.update({
//             where: { id: user.id },
//             data: {
//                 last_login_at: new Date(),
//                 isLogin: true,
//                 login_attempts: 0,
//             },
//         });

//         // Track device information (async, non-blocking)
//         if (userAgent && ipAddress) {
//             await this.deviceService.saveDeviceInfo(user.id, userAgent, ipAddress);
//         }

//         const token = this.utils.generateToken({
//             sub: user.id,
//             email: user.email,
//             roles: user.role as any,
//         });

//         const safeUser = this.utils.sanitizedResponse(UserResponseDto, user);
//         const device = await this.deviceService.getUserDevices(user.id);

//         return successResponse({ token, user: safeUser, devices: device }, "Login successful");
//     }

//     // ---------- FORGOT PASSWORD ----------
//     @HandleError("Failed to process forgot password", "ForgotPassword")
//     async forgetPassword(payload: ForgotPasswordDto) {
//         const { email } = payload;

//         // Find user by email
//         const user = await this.prisma.user.findUnique({
//             where: { email },
//         });

//         if (!user) {
//             throw new NotFoundException("User does not exist!");
//         }

//         // Generate OTP
//         const { otp, expiryTime } = this.utils.generateOtpAndExpiry();

//         // Store OTP and expiry in user record
//         await this.prisma.user.update({
//             where: { id: user.id },
//             data: {
//                 emailOtp: otp,
//                 otpExpiresAt: expiryTime, // Fixed: use otpExpiresAt instead of otpExpiry
//             },
//         });

//         // Send OTP email
//         await this.mail.sendEmail(
//             email,
//             "Reset Your Password",
//             `
//       <h3>Hi ${user.full_name || "there"},</h3>
//       <p>Use the OTP below to reset your password:</p>
//       <h2>${otp}</h2>
//       <p>This OTP will expire in 10 minutes.</p>
//     `,
//         );

//         // Generate JWT token for verification
//         const jwtPayload = { id: user.id };
//         const resetToken = await this.jwt.signAsync(jwtPayload, {
//             expiresIn: "10m",
//         });

//         return { resetToken };
//     }

//     // ---------- VERIFY OTP (for signup) ----------
//     @HandleError("Failed to verify OTP", "VerifyOTP")
//     async verifyOtp(payload: VerifyOtpAuthDto) {
//         // Verify the JWT token
//         let decoded: any;
//         try {
//             decoded = await this.jwt.verifyAsync(payload.resetToken);
//         } catch (err) {
//             throw new ForbiddenException("Invalid or expired token!");
//         }

//         // Find user by ID from the token
//         const user = await this.prisma.user.findUnique({
//             where: { id: decoded.id },
//         });

//         if (!user) {
//             throw new ForbiddenException("User not found!");
//         }

//         // Check if OTP has expired
//         if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
//             throw new ForbiddenException("OTP has expired!");
//         }

//         // Check OTP match
//         if (user.emailOtp !== parseInt(payload.emailOtp)) {
//             throw new ForbiddenException("OTP does not match!");
//         }

//         // Clear OTP and expiry, mark as verified
//         const updatedUser = await this.prisma.user.update({
//             where: { id: user.id },
//             data: {
//                 emailOtp: null,
//                 otpExpiresAt: null,
//                 isVerified: true,
//                 last_login_at: new Date(),
//             },
//         });

//         // Generate a new JWT token for authentication
//         const token = await this.jwt.signAsync(
//             { id: user.id, email: user.email, roles: user.role },
//             { secret: process.env.JWT_SECRET, expiresIn: "77d" },
//         );

//         const safeUser = this.utils.sanitizedResponse(UserResponseDto, updatedUser);
//         const device = await this.deviceService.getUserDevices(user.id);
//         return {
//             success: true,
//             message: "OTP verified successfully",
//             data: {
//                 token,
//                 user: safeUser,
//             },
//             devices: device,
//         };
//     }

//     // ---------- VERIFY OTP (for password reset) ----------
//     @HandleError("Failed to verify reset OTP", "ResetVerifyOTP")
//     async resetverifyOtp(payload: VerifyOtpAuthDto) {
//         // Verify the JWT token
//         let decoded: any;
//         try {
//             decoded = await this.jwt.verifyAsync(payload.resetToken);
//         } catch (err) {
//             throw new ForbiddenException("Invalid or expired token!");
//         }

//         // Find user by ID from the token
//         const user = await this.prisma.user.findUnique({
//             where: { id: decoded.id },
//         });

//         if (!user) {
//             throw new ForbiddenException("User not found!");
//         }

//         // Check if OTP has expired
//         if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
//             throw new ForbiddenException("OTP has expired!");
//         }

//         // Check OTP match
//         if (user.emailOtp !== parseInt(payload.emailOtp)) {
//             throw new ForbiddenException("OTP does not match!");
//         }

//         // Clear OTP and expiry
//         await this.prisma.user.update({
//             where: { id: user.id },
//             data: {
//                 emailOtp: null,
//                 otpExpiresAt: null,
//             },
//         });

//         // Generate a new JWT token for password reset
//         const jwtPayload = { id: user.id };
//         const resetToken = await this.jwt.signAsync(jwtPayload, {
//             expiresIn: "10m",
//         });

//         return { resetToken };
//     }

//     // ------------------------- phone otp verification via sms -------------------------
//     // ---------- SEND PHONE OTP (signup / login / forgot) ----------
//     @HandleError("Failed to send phone OTP", "SendPhoneOtp")
//     async sendPhoneOtp(dto: SendPhoneOtpDto) {
//         let phone = dto.phone;
//         if (!phone.startsWith("+")) phone = `+${phone}`;

//         // Find or create user (for login/forgot we need the record)
//         let user = await this.prisma.user.findFirst({ where: { phone } });
//         const isNew = !user;

//         if (isNew) {
//             // optional: create a “pre-user” record so we can store OTP
//             user = await this.prisma.user.create({
//                 data: {
//                     phone,
//                     validation_type: ValidationType.PHONE,
//                     full_name: "",
//                     email: `temp_${Date.now()}@temp.com`,
//                     password: "",
//                 },
//             });
//         }

//         if (!user) throw new AppError(404, "User creation failed");

//         const { otp, expiryTime } = this.utils.generateOtpAndExpiry();

//         await this.prisma.user.update({
//             where: { id: user.id },
//             data: {
//                 phoneOtp: otp,
//                 phoneOtpExpiresAt: expiryTime,
//                 isVerified: true,
//                 validation_type: ValidationType.PHONE,
//             },
//         });

//         await this.twilio.sendOtpSms(phone, otp);

//         // JWT only needed for password-reset flow
//         const payload = { id: user.id };
//         const resetToken = await this.jwt.signAsync(payload, { expiresIn: "10m" });

//         return { resetToken, message: "OTP sent to phone" };
//     }

//     // ---------- VERIFY PHONE OTP (signup / login) ----------
//     @HandleError("Failed to verify phone OTP", "VerifyPhoneOtp")
//     async verifyPhoneOtp(dto: VerifyPhoneOtpDto) {
//         const phone = dto.phone.startsWith("+") ? dto.phone : `+${dto.phone}`;

//         const user = await this.prisma.user.findFirst({ where: { phone } });
//         if (!user) throw new AppError(404, "Phone not registered");

//         if (user.phoneOtpExpiresAt && user.phoneOtpExpiresAt < new Date())
//             throw new AppError(400, "OTP expired");

//         if (user.phoneOtp !== dto.otp) throw new AppError(400, "Invalid OTP");

//         // Clear OTP & mark phone verified
//         const updated = await this.prisma.user.update({
//             where: { id: user.id },
//             data: {
//                 phoneOtp: null,
//                 phoneOtpExpiresAt: null,
//                 phoneVerified: true,

//                 isVerified: true,
//                 validation_type: ValidationType.PHONE,
//             },
//         });

//         const token = this.utils.generateToken({
//             sub: updated.id,
//             email: updated.email ?? "",
//             roles: updated.role,
//         });

//         const safeUser = this.utils.sanitizedResponse(UserResponseDto, updated);
//         const devices = await this.deviceService.getUserDevices(updated.id);

//         return successResponse(
//             { token, user: safeUser, devices },
//             "Phone verified – login successful",
//         );
//     }

//     // ---------- FORGOT PASSWORD VIA PHONE ----------
//     @HandleError("Failed to process phone forgot password", "PhoneForgot")
//     async phoneForgotPassword(dto: SendPhoneOtpDto) {
//         const phone = dto.phone.startsWith("+") ? dto.phone : `+${dto.phone}`;
//         const user = await this.prisma.user.findFirst({ where: { phone } });
//         if (!user) throw new NotFoundException("Phone not registered");

//         const { otp, expiryTime } = this.utils.generateOtpAndExpiry();
//         await this.prisma.user.update({
//             where: { id: user.id },
//             data: { phoneOtp: otp, phoneOtpExpiresAt: expiryTime },
//         });

//         await this.twilio.sendOtpSms(phone, otp);

//         const resetToken = await this.jwt.signAsync({ id: user.id }, { expiresIn: "10m" });

//         return { resetToken };
//     }

//     // ---------- VERIFY PHONE OTP FOR PASSWORD RESET ----------
//     @HandleError("Failed to verify phone reset OTP", "PhoneResetVerify")
//     async phoneResetVerifyOtp(dto: VerifyPhoneOtpDto) {
//         // token verification
//         let decoded: any;
//         try {
//             decoded = await this.jwt.verifyAsync(dto.resetToken!);
//         } catch {
//             throw new ForbiddenException("Invalid/expired token");
//         }

//         const user = await this.prisma.user.findUnique({ where: { id: decoded.id } });
//         if (!user) throw new NotFoundException("User not found");

//         if (user.phoneOtpExpiresAt && user.phoneOtpExpiresAt < new Date())
//             throw new AppError(400, "OTP expired");

//         if (user.phoneOtp !== dto.otp) throw new AppError(400, "Invalid OTP");

//         await this.prisma.user.update({
//             where: { id: user.id },
//             data: { phoneOtp: null, phoneOtpExpiresAt: null },
//         });

//         const newResetToken = await this.jwt.signAsync({ id: user.id }, { expiresIn: "10m" });
//         return { resetToken: newResetToken };
//     }

//     // ---------- RESET PASSWORD ----------
//     @HandleError("Failed to reset password", "ResetPassword")
//     async resetPassword(payload: ResetPasswordAuthDto) {
//         // Verify token
//         let decoded: any;
//         try {
//             decoded = await this.jwt.verifyAsync(payload.resetToken);
//         } catch (err) {
//             throw new ForbiddenException("Invalid or expired token!");
//         }

//         // Find user by ID
//         const user = await this.prisma.user.findUnique({
//             where: { id: decoded.id },
//         });

//         if (!user) {
//             throw new NotFoundException("User not found!");
//         }

//         // Hash new password
//         const hashedPassword = await this.utils.hash(payload.password);

//         // Update user password
//         await this.prisma.user.update({
//             where: { id: user.id },
//             data: { password: hashedPassword },
//         });

//         return { message: "Password reset successfully" };
//     }

//     // ----------get devices from user ----------
//     getUserDevices(userId: string) {
//         return this.deviceService.getUserDevices(userId);
//     }

//     // ------------- Logout from all devices--
//     async logoutAllDevices(userId: string) {
//         await this.deviceService.removeAllUserDevices(userId);
//         return { message: "Logged out from all devices successfully" };
//     }
// }
