import { Module } from "@nestjs/common";

import { LibModule } from "src/lib/lib.module";
import { PaymentWebhookController } from "./controller/payment-webhook";
import { PaymentController } from "./controller/payment.controller";
import { PaymentService } from "./service/payment.service";

@Module({
    imports: [LibModule],
    controllers: [PaymentController, PaymentWebhookController],
    providers: [PaymentService],
})
export class PaymentModule {}
