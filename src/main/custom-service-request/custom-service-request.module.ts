import { Module } from "@nestjs/common";
import { PrismaModule } from "src/lib/prisma/prisma.module";
import { CustomServiceRequestController } from "./custom-service-request.controller";
import { CustomServiceRequestService } from "./custom-service-request.service";
import { serviceGateway } from "./service-socket/serviceGateway";

@Module({
    imports: [PrismaModule],
    controllers: [CustomServiceRequestController],
    providers: [CustomServiceRequestService, serviceGateway],
})
export class CustomServiceRequestModule {}
