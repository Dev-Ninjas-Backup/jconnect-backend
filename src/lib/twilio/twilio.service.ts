import { ENVEnum } from "@common/enum/env.enum";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { Twilio } from "twilio";

@Injectable()
export class TwilioService {
    private readonly twilio: Twilio;
    private readonly fromPhone: string;
    private readonly logger = new Logger(TwilioService.name);

    constructor(private readonly config: ConfigService) {
        this.twilio = new Twilio(
            this.config.getOrThrow(ENVEnum.TWILIO_ACCOUNT_SID),
            this.config.getOrThrow(ENVEnum.TWILIO_AUTH_TOKEN),
        );
        this.fromPhone = this.config.getOrThrow(ENVEnum.TWILIO_PHONE_NUMBER);
    }

    async sendVerificationCode(to: string, otp: number): Promise<void> {
        const body = `Your LGC verification code is ${otp}. It expires in 10 minutes.`;
        await this.sendSms(to, "LGC Verification", body);
    }

    async sendSms(to: string, title: string, message: string): Promise<void> {
        // Ensure phone number has '+' prefix
        if (!to.startsWith("+")) {
            to = `+${to}`;
        }

        const body = `${title}\n\n${message}`;

        try {
            const message = await this.twilio.messages.create({
                body,
                from: this.fromPhone,
                to,
            });

            this.logger.log(`SMS sent: ${message.sid}`);
        } catch (error) {
            this.logger.error(`Failed to send SMS: ${error.message}`);
        }
    }

    async sendOtpSms(to: string, otp: number): Promise<void> {
        const body = `Your Jconnect verification code is ${otp}. It expires in 10 minutes.`;
        await this.sendSms(to, "Jconnect Verification", body);
    }
}
