import { Module } from "@nestjs/common";
import { StripepaymentController } from "./stripepayment.controller";
import { StripepaymentService } from "./stripepayment.service";

@Module({
    controllers: [StripepaymentController],
    providers: [StripepaymentService],
})
export class StripepaymentModule {}
