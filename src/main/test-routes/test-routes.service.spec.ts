import { Test, TestingModule } from "@nestjs/testing";
import { TestRoutesService } from "./test-routes.service";

describe("TestRoutesService", () => {
    let service: TestRoutesService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [TestRoutesService],
        }).compile();

        service = module.get<TestRoutesService>(TestRoutesService);
    });

    it("should be defined", () => {
        expect(service).toBeDefined();
    });
});
