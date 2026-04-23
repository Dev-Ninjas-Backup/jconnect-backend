import { AwsService } from "@main/aws/aws.service";
import { NotificationModule } from "@main/shared/notification/notification.module";
import { StripeModule } from "@main/stripe/stripe.module";
import { Module } from "@nestjs/common";
import { PrismaModule } from "src/lib/prisma/prisma.module";
import { ServiceController } from "./service.controller";
import { ServiceService } from "./service.service";

@Module({
    imports: [PrismaModule, StripeModule, NotificationModule],
    providers: [ServiceService, AwsService],
    controllers: [ServiceController],
})
export class ServiceModule {}
