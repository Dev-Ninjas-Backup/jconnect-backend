import { Test, TestingModule } from "@nestjs/testing";
import { TestRoutesController } from "./test-routes.controller";
import { TestRoutesService } from "./test-routes.service";

describe("TestRoutesController", () => {
    let controller: TestRoutesController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [TestRoutesController],
            providers: [TestRoutesService],
        }).compile();

        controller = module.get<TestRoutesController>(TestRoutesController);
    });

    it("should be defined", () => {
        expect(controller).toBeDefined();
    });
});
