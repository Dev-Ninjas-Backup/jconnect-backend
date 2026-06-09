import { AwsService } from "@main/aws/aws.service";
import { Module } from "@nestjs/common";
import { PrismaModule } from "src/lib/prisma/prisma.module";
import { SocialServiceController } from "./social-service.controller";
import { SocialServiceService } from "./social-service.service";

@Module({
    imports: [PrismaModule],
    controllers: [SocialServiceController],
    providers: [SocialServiceService, AwsService],
})
export class SocialServiceModule {}
