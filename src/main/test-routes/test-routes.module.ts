import { Module } from "@nestjs/common";
import { TestRoutesService } from "./test-routes.service";
import { TestRoutesController } from "./test-routes.controller";

@Module({
    controllers: [TestRoutesController],
    providers: [TestRoutesService],
})
export class TestRoutesModule {}
