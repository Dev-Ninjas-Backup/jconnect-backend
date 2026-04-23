import { Module } from "@nestjs/common";
import { SocialServiceRequestController } from "./social-service-request.controller";
import { SocialServiceRequestService } from "./social-service-request.service";

@Module({
    controllers: [SocialServiceRequestController],
    providers: [SocialServiceRequestService],
})
export class SocialServiceRequestModule {}
