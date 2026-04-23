import { Module } from "@nestjs/common";
import { DeviceModule } from "./device/device.module";
import { MailModule } from "./mail/mail.module";
import { MulterModule } from "./multer/multer.module";

import { PrismaModule } from "./prisma/prisma.module";
import { SeedModule } from "./seed/seed.module";
import { TwilioModule } from "./twilio/twilo.module";
import { UtilsModule } from "./utils/utils.module";

import { FirebaseModule } from "./firebase/firebase.module";
import { NotificationModuleGateway } from "@main/shared/notification/notification-gateway/notification-gateway.module";

@Module({
    imports: [
        PrismaModule,
        MailModule,
        UtilsModule,
        TwilioModule,
        DeviceModule,
        SeedModule,
        MulterModule,
        NotificationModuleGateway,
        FirebaseModule,
    ],
    controllers: [],
    exports: [
        PrismaModule,
        MailModule,
        UtilsModule,
        TwilioModule,
        DeviceModule,
        SeedModule,
        MulterModule,
        NotificationModuleGateway,
        FirebaseModule,
    ],
    providers: [],
})
export class LibModule {}
