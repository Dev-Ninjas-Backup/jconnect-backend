import { Module } from "@nestjs/common";

import { NotificationModule } from "../notification/notification.module";
import { PrivateChatController } from "./controller/private-message.controller";
import { PrivateChatGateway } from "./privateChatGateway/privateChatGateway";
import { PrivateChatService } from "./service/private-message.service";
import { FirebaseNotificationService } from "../notification/firebase-notification.service";

@Module({
    imports: [NotificationModule],
    controllers: [PrivateChatController],
    providers: [PrivateChatService, PrivateChatGateway, FirebaseNotificationService],
})
export class PrivateMessageModule {}
