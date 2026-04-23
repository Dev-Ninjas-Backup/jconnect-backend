import { Module } from "@nestjs/common";

import { UploadAwsModule } from "./aws-upload/aws-upload.module";
import { PrivateMessageModule } from "./private-message/private-message.module";
import { NotificationModule } from "./notification/notification.module";

@Module({
    imports: [PrivateMessageModule, UploadAwsModule, NotificationModule],
    controllers: [],
    providers: [],
    exports: [],
})
export class SharedModule {}
