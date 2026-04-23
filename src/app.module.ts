import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import { AppController } from "./app.controller";
import { ENVEnum } from "./common/enum/env.enum";
import { JwtStrategy } from "./common/jwt/jwt.strategy";
import { LoggerMiddleware } from "./common/middleware/logger.middleware";
import { LibModule } from "./lib/lib.module";
import { MainModule } from "./main/main.module";
import { TestModule } from "./test/test.module";
import { FollowFunctionModule } from "./main/follow-function/follow-function.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),

        // CacheModule.register({
        //     isGlobal: true,
        // }),

        ServeStaticModule.forRoot({
            rootPath: join(process.cwd(), "uploads"),
            serveRoot: "/files",
        }),

        PassportModule,

        JwtModule.registerAsync({
            global: true,
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (config: ConfigService) => ({
                secret: await config.getOrThrow(ENVEnum.JWT_SECRET),
                signOptions: {
                    expiresIn: await config.getOrThrow(ENVEnum.JWT_EXPIRES_IN),
                },
            }),
        }),

        MainModule,
        LibModule,
        TestModule,
        FollowFunctionModule,
    ],
    controllers: [AppController],
    providers: [JwtStrategy],
})
export class AppModule {}
