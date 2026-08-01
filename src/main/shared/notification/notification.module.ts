import { Module } from "@nestjs/common";
import { FirebaseModule } from "src/lib/firebase/firebase.module";
import { FirebaseNotificationController } from "./firebase-notification.controller";
import { FirebaseNotificationService } from "./firebase-notification.service";
import { NotificationSettingController } from "./notification.controller";
import { NotificationSettingService } from "./notification.service";

@Module({
    imports: [FirebaseModule],
    controllers: [NotificationSettingController, FirebaseNotificationController],
    providers: [NotificationSettingService, FirebaseNotificationService],
    exports: [NotificationSettingService, FirebaseNotificationService],
})
export class NotificationModule {}
