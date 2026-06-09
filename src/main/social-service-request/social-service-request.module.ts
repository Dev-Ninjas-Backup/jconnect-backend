import { AwsService } from "@main/aws/aws.service";
import { Module } from "@nestjs/common";
import { PrismaModule } from "src/lib/prisma/prisma.module";
import { SocialServiceRequestController } from "./social-service-request.controller";
import { SocialServiceRequestService } from "./social-service-request.service";

@Module({
    imports: [PrismaModule],
    controllers: [SocialServiceRequestController],
    providers: [SocialServiceRequestService, AwsService],
})
export class SocialServiceRequestModule {}
