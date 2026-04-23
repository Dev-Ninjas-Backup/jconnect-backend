// /src/servicerequest/servicerequest.module.ts
import { AwsService } from "@main/aws/aws.service";
import { NotificationModule } from "@main/shared/notification/notification.module";
import { Module } from "@nestjs/common";
import { PrismaModule } from "src/lib/prisma/prisma.module";
import { ServiceRequestController } from "./service-request.controller";
import { ServiceRequestService } from "./service-request.service";

@Module({
    imports: [PrismaModule, NotificationModule],
    controllers: [ServiceRequestController],
    providers: [ServiceRequestService, AwsService],
})
export class ServiceRequestModule {}
