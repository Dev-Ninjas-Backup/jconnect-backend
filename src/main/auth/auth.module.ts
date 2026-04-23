import { StripeModule } from "@main/stripe/stripe.module";
import { StripeService } from "@main/stripe/stripe.service";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { JwtModule } from "@nestjs/jwt";
import { LibModule } from "src/lib/lib.module";
import { AuthController } from "./controllers/auth.controller";
import { AuthGoogleService } from "./services/auh-google.service";
import { AuthFirebaseService } from "./services/auth-firebase.service";
import { AuthService } from "./services/auth.service";

@Module({
    imports: [
        ConfigModule,
        StripeModule,
        LibModule,
        EventEmitterModule.forRoot(),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (config: ConfigService) => ({
                secret: config.getOrThrow("JWT_SECRET"),
                signOptions: {
                    expiresIn: config.getOrThrow("JWT_EXPIRES_IN"),
                },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, AuthGoogleService, AuthFirebaseService, StripeService],
    exports: [AuthService, JwtModule],
})
export class AuthModule {}
