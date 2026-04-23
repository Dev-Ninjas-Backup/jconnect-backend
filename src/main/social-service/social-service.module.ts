import { Module } from "@nestjs/common";
import { SocialServiceService } from "./social-service.service";
import { SocialServiceController } from "./social-service.controller";
import { PrismaService } from "src/lib/prisma/prisma.service";

@Module({
    controllers: [SocialServiceController],
    providers: [SocialServiceService],
})
export class SocialServiceModule {}
