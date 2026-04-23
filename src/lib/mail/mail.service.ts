import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { ENVEnum } from "src/common/enum/env.enum";

@Injectable()
export class MailService {
    private transporter: nodemailer.Transporter;
    private readonly logger = new Logger(MailService.name);

    constructor(private configService: ConfigService) {
        this.initializeTransporter();
    }

    private initializeTransporter() {
        const mailUser = this.configService.get<string>(ENVEnum.MAIL_USER);
        const mailPass = this.configService.get<string>(ENVEnum.MAIL_PASS);

        // Validate required environment variables
        if (!mailUser || !mailPass) {
            this.logger.warn(
                "⚠️  Email configuration is incomplete. Email functionality will be disabled.",
            );
            this.logger.warn("Required: MAIL_USER, MAIL_PASS");
            return;
        }

        try {
            this.transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: mailUser,
                    pass: mailPass,
                },
            });

            this.logger.log("✅ Email transporter initialized successfully");
        } catch (error) {
            this.logger.error("❌ Failed to initialize email transporter:", error);
        }
    }

    async sendLoginCodeEmail(email: string, code: string): Promise<nodemailer.SentMessageInfo> {
        if (!this.transporter) {
            throw new Error("Email service is not configured. Please contact support.");
        }

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        margin: 0;
                        padding: 0;
                        background-color: #f5f7fa;
                    }
                    .container {
                        max-width: 600px;
                        margin: 40px auto;
                        background: white;
                        border-radius: 12px;
                        overflow: hidden;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                    }
                    .header {
                        background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
                        color: white;
                        padding: 40px 30px;
                        text-align: center;
                    }
                    .logo {
                        font-size: 32px;
                        font-weight: bold;
                        margin-bottom: 10px;
                        letter-spacing: 1px;
                    }
                    .header-subtitle {
                        font-size: 16px;
                        opacity: 0.95;
                    }
                    .content {
                        padding: 40px 30px;
                    }
                    .code-box {
                        background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
                        border: 2px solid #2563eb;
                        padding: 30px;
                        text-align: center;
                        margin: 30px 0;
                        border-radius: 10px;
                    }
                    .code {
                        font-size: 42px;
                        font-weight: bold;
                        color: #2563eb;
                        letter-spacing: 12px;
                        margin: 15px 0;
                        font-family: 'Courier New', monospace;
                    }
                    .info-box {
                        background: #fef3c7;
                        border-left: 4px solid #f59e0b;
                        padding: 16px;
                        margin: 25px 0;
                        border-radius: 6px;
                    }
                    .footer {
                        text-align: center;
                        padding: 25px;
                        background: #f8fafc;
                        color: #64748b;
                        font-size: 13px;
                        border-top: 1px solid #e2e8f0;
                    }
                    .brand-name {
                        color: #2563eb;
                        font-weight: 600;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🎵 DaConnect</div>
                        <div class="header-subtitle">Connecting Artists & Music Lovers</div>
                    </div>
                    <div class="content">
                        <h2 style="color: #1e293b; margin-bottom: 20px;">Welcome Back! 👋</h2>
                        <p style="font-size: 16px; color: #475569;">You requested a login code for your <span class="brand-name">DaConnect</span> account. Use the code below to securely access your account:</p>
                        
                        <div class="code-box">
                            <p style="margin: 0; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Your Login Code</p>
                            <div class="code">${code}</div>
                            <p style="margin: 0; font-size: 13px; color: #94a3b8;">Enter this code on the login page</p>
                        </div>
                        
                        <div class="info-box">
                            <strong style="color: #92400e;">⏰ Quick Action Required:</strong> This login code will expire in <strong>10 minutes</strong> for your security.
                        </div>
                        
                        <p style="font-size: 14px; color: #64748b; margin-top: 25px;">If you didn't request this code, please ignore this email or contact our support team immediately to secure your account.</p>
                    </div>
                    
                    <div class="footer">
                        <p style="margin: 5px 0;">This is an automated email from <strong class="brand-name">DaConnect</strong>. Please do not reply.</p>
                        <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} DaConnect. All rights reserved.</p>
                        <p style="margin: 10px 0; font-size: 12px;">Empowering artists and connecting communities through music.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const mailOptions = {
            from: `"DaConnect" <${this.configService.get<string>(ENVEnum.MAIL_USER)}>`,
            to: email,
            subject: "Your DaConnect Login Code 🔐",
            html,
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            this.logger.log(`📧 Login code email sent successfully to ${email}`);
            return info;
        } catch (error) {
            this.logger.error(`❌ Failed to send login code to ${email}:`, error);
            throw new Error("Failed to send email. Please try again later.");
        }
    }

    async sendEmail(
        email: string,
        subject: string,
        message: string,
    ): Promise<nodemailer.SentMessageInfo> {
        if (!this.transporter) {
            throw new Error("Email service is not configured. Please contact support.");
        }

        const mailOptions = {
            from: `"DaConnect" <${this.configService.get<string>(ENVEnum.MAIL_USER)}>`,
            to: email,
            subject,
            html: message,
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            this.logger.log(`📧 Email sent successfully to ${email}`);
            return info;
        } catch (error) {
            this.logger.error(`❌ Failed to send email to ${email}:`, error);
            throw new Error("Failed to send email. Please try again later.");
        }
    }

    // Enhanced OTP email with better styling
    async sendOtpEmail(
        email: string,
        otp: number,
        userName?: string,
    ): Promise<nodemailer.SentMessageInfo> {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        margin: 0;
                        padding: 0;
                        background-color: #f5f7fa;
                    }
                    .container {
                        max-width: 600px;
                        margin: 40px auto;
                        background: white;
                        border-radius: 12px;
                        overflow: hidden;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                    }
                    .header {
                        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                        color: white;
                        padding: 40px 30px;
                        text-align: center;
                    }
                    .logo {
                        font-size: 32px;
                        font-weight: bold;
                        margin-bottom: 10px;
                        letter-spacing: 1px;
                    }
                    .header-subtitle {
                        font-size: 16px;
                        opacity: 0.95;
                    }
                    .content {
                        padding: 40px 30px;
                    }
                    .otp-box {
                        background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
                        border: 2px solid #10b981;
                        padding: 30px;
                        text-align: center;
                        margin: 30px 0;
                        border-radius: 10px;
                    }
                    .otp-code {
                        font-size: 42px;
                        font-weight: bold;
                        color: #059669;
                        letter-spacing: 10px;
                        margin: 15px 0;
                        font-family: 'Courier New', monospace;
                    }
                    .info-box {
                        background: #fef3c7;
                        border-left: 4px solid #f59e0b;
                        padding: 16px;
                        margin: 25px 0;
                        border-radius: 6px;
                    }
                    .welcome-message {
                        background: #eff6ff;
                        border-left: 4px solid #3b82f6;
                        padding: 16px;
                        margin: 25px 0;
                        border-radius: 6px;
                    }
                    .footer {
                        text-align: center;
                        padding: 25px;
                        background: #f8fafc;
                        color: #64748b;
                        font-size: 13px;
                        border-top: 1px solid #e2e8f0;
                    }
                    .brand-name {
                        color: #10b981;
                        font-weight: 600;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🎵 DaConnect</div>
                        <div class="header-subtitle">Email Verification</div>
                    </div>
                    <div class="content">
                        <h2 style="color: #1e293b; margin-bottom: 20px;">Welcome, ${userName || "there"}! 👋</h2>
                        
                        <div class="welcome-message">
                            <strong style="color: #1e40af;">🎉 Thank you for joining DaConnect!</strong>
                            <p style="margin: 10px 0 0 0; color: #475569;">We're excited to have you in our community of artists and music lovers. Let's verify your email to get started!</p>
                        </div>
                        
                        <p style="font-size: 16px; color: #475569; margin: 25px 0;">Please use the OTP code below to verify your email address and complete your registration:</p>
                        
                        <div class="otp-box">
                            <p style="margin: 0; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
                            <div class="otp-code">${otp}</div>
                            <p style="margin: 0; font-size: 13px; color: #94a3b8;">Enter this code to verify your email</p>
                        </div>
                        
                        <div class="info-box">
                            <strong style="color: #92400e;">⏰ Time Sensitive:</strong> This verification code will expire in <strong>10 minutes</strong> for security purposes.
                        </div>
                        
                        <p style="font-size: 14px; color: #64748b; margin-top: 25px;">If you didn't create a DaConnect account, please disregard this email or contact our support team if you have any concerns.</p>
                    </div>
                    
                    <div class="footer">
                        <p style="margin: 5px 0;">This is an automated email from <strong class="brand-name">DaConnect</strong>. Please do not reply.</p>
                        <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} DaConnect. All rights reserved.</p>
                        <p style="margin: 10px 0; font-size: 12px;">Empowering artists and connecting communities through music.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return this.sendEmail(email, "Verify Your DaConnect Email Address ✅", html);
    }

    // Password reset email with better styling
    async sendPasswordResetEmail(
        email: string,
        otp: number,
        userName?: string,
    ): Promise<nodemailer.SentMessageInfo> {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        margin: 0;
                        padding: 0;
                        background-color: #f5f7fa;
                    }
                    .container {
                        max-width: 600px;
                        margin: 40px auto;
                        background: white;
                        border-radius: 12px;
                        overflow: hidden;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                    }
                    .header {
                        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                        color: white;
                        padding: 40px 30px;
                        text-align: center;
                    }
                    .logo {
                        font-size: 32px;
                        font-weight: bold;
                        margin-bottom: 10px;
                        letter-spacing: 1px;
                    }
                    .header-subtitle {
                        font-size: 16px;
                        opacity: 0.95;
                    }
                    .content {
                        padding: 40px 30px;
                    }
                    .otp-box {
                        background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
                        border: 2px solid #ef4444;
                        padding: 30px;
                        text-align: center;
                        margin: 30px 0;
                        border-radius: 10px;
                    }
                    .otp-code {
                        font-size: 42px;
                        font-weight: bold;
                        color: #dc2626;
                        letter-spacing: 10px;
                        margin: 15px 0;
                        font-family: 'Courier New', monospace;
                    }
                    .warning-box {
                        background: #fef3c7;
                        border-left: 4px solid #f59e0b;
                        padding: 16px;
                        margin: 25px 0;
                        border-radius: 6px;
                    }
                    .security-box {
                        background: #dbeafe;
                        border-left: 4px solid #3b82f6;
                        padding: 16px;
                        margin: 25px 0;
                        border-radius: 6px;
                    }
                    .footer {
                        text-align: center;
                        padding: 25px;
                        background: #f8fafc;
                        color: #64748b;
                        font-size: 13px;
                        border-top: 1px solid #e2e8f0;
                    }
                    .brand-name {
                        color: #ef4444;
                        font-weight: 600;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🎵 DaConnect</div>
                        <div class="header-subtitle">Password Reset Request</div>
                    </div>
                    <div class="content">
                        <h2 style="color: #1e293b; margin-bottom: 20px;">Hi ${userName || "there"}! 🔐</h2>
                        <p style="font-size: 16px; color: #475569;">We received a request to reset the password for your <span class="brand-name">DaConnect</span> account. Use the verification code below to proceed:</p>
                        
                        <div class="otp-box">
                            <p style="margin: 0; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Password Reset Code</p>
                            <div class="otp-code">${otp}</div>
                            <p style="margin: 0; font-size: 13px; color: #94a3b8;">Enter this code to reset your password</p>
                        </div>
                        
                        <div class="warning-box">
                            <strong style="color: #92400e;">⏰ Time Sensitive:</strong> This verification code will expire in <strong>10 minutes</strong>.
                        </div>
                        
                        <div class="security-box">
                            <strong style="color: #1e40af;">🛡️ Security Notice:</strong>
                            <p style="margin: 10px 0 0 0; color: #475569;">If you didn't request a password reset, please ignore this email. Your account remains secure. However, if you suspect unauthorized access, please contact our support team immediately or change your password as a precaution.</p>
                        </div>
                        
                        <p style="font-size: 14px; color: #64748b; margin-top: 25px;">Need help? Contact our support team at any time - we're here to help keep your account secure.</p>
                    </div>
                    
                    <div class="footer">
                        <p style="margin: 5px 0;">This is an automated email from <strong class="brand-name">DaConnect</strong>. Please do not reply.</p>
                        <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} DaConnect. All rights reserved.</p>
                        <p style="margin: 10px 0; font-size: 12px;">Empowering artists and connecting communities through music.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return this.sendEmail(email, "Reset Your DaConnect Password 🔐", html);
    }

    // Test email connection
    async testConnection(): Promise<boolean> {
        if (!this.transporter) {
            this.logger.error("❌ Email transporter not initialized");
            return false;
        }

        try {
            await this.transporter.verify();
            this.logger.log("✅ Email connection test successful");
            return true;
        } catch (error) {
            this.logger.error("❌ Email connection test failed:", error);
            return false;
        }
    }
}
