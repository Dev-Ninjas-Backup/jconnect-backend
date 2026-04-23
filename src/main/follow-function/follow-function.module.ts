import { NotificationModule } from "@main/shared/notification/notification.module";
import { Module } from "@nestjs/common";
import { MailModule } from "src/lib/mail/mail.module";
import { FollowFunctionController } from "./follow-function.controller";
import { FollowFunctionService } from "./follow-function.service";

@Module({
    imports: [NotificationModule, MailModule],
    providers: [FollowFunctionService],
    controllers: [FollowFunctionController],
})
export class FollowFunctionModule {}
