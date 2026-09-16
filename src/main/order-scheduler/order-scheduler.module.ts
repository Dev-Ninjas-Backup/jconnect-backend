import { OrdersModule } from "@main/order/order.module";
import { PaymentsModule } from "@main/payments/payments.module";
import { Module } from "@nestjs/common";
import { PrismaModule } from "src/lib/prisma/prisma.module";
import { OrderSchedulerService } from "./order-scheduler.service";

@Module({
    imports: [PrismaModule, OrdersModule, PaymentsModule],
    providers: [OrderSchedulerService],
})
export class OrderSchedulerModule {}
