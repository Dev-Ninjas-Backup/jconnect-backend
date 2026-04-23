import { Global, Module } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { NotificationGateway } from "./notification.gateway";
import { FirebaseNotificationService } from "@main/shared/notification/firebase-notification.service";

@Global()
@Module({
    providers: [NotificationGateway, JwtService, FirebaseNotificationService],
    controllers: [],
    exports: [NotificationGateway],
})
export class NotificationModuleGateway {}
