import { Module } from "@nestjs/common";
import { testService } from "./test.service";
import { StripeController } from "./test.controller";

@Module({
    controllers: [StripeController],
    providers: [testService],
})
export class TestModule {}
