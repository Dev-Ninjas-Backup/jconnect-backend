import { Module } from "@nestjs/common";

import { OrdersModule } from "@main/order/order.module";
import { NotificationModule } from "../notification/notification.module";
import { PrivateChatController } from "./controller/private-message.controller";
import { PrivateChatGateway } from "./privateChatGateway/privateChatGateway";
import { PrivateChatService } from "./service/private-message.service";
import { FirebaseNotificationService } from "../notification/firebase-notification.service";

@Module({
    imports: [NotificationModule, OrdersModule],
    controllers: [PrivateChatController],
    providers: [PrivateChatService, PrivateChatGateway, FirebaseNotificationService],
    exports: [PrivateChatGateway],
})
export class PrivateMessageModule {}
