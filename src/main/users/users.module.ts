import { MultipartParserMiddleware } from "@common/middleware/multipart-parser.middleware";
import { AwsService } from "@main/aws/aws.service";
import { NotificationModule } from "@main/shared/notification/notification.module";
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
    imports: [NotificationModule],
    controllers: [UsersController],
    providers: [UsersService, AwsService],
})
export class UsersModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(MultipartParserMiddleware).forRoutes("users/me");
    }
}
