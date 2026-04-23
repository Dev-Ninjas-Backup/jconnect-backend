import { NotificationModule } from "@main/shared/notification/notification.module";
import { Module } from "@nestjs/common";
import { ReviewController } from "./review.controller";
import { ReviewService } from "./review.service";

@Module({
    imports: [NotificationModule],
    controllers: [ReviewController],
    providers: [ReviewService],
})
export class ReviewModule {}
