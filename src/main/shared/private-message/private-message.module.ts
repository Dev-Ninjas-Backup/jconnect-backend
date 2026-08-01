import { Module, forwardRef } from "@nestjs/common";

import { OrdersModule } from "@main/order/order.module";
import { NotificationModule } from "../notification/notification.module";
import { PrivateChatController } from "./controller/private-message.controller";
import { PrivateChatGateway } from "./privateChatGateway/privateChatGateway";
import { PrivateChatService } from "./service/private-message.service";

@Module({
    imports: [NotificationModule, forwardRef(() => OrdersModule)],
    controllers: [PrivateChatController],
    providers: [PrivateChatService, PrivateChatGateway],
    exports: [PrivateChatGateway],
})
export class PrivateMessageModule {}
