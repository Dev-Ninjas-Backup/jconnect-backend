import { Injectable } from "@nestjs/common";
import { CreateTestRouteDto } from "./dto/create-test-route.dto";
import { UpdateTestRouteDto } from "./dto/update-test-route.dto";

@Injectable()
export class TestRoutesService {
    create(createTestRouteDto: CreateTestRouteDto) {
        return "This action adds a new testRoute";
    }

    findAll() {
        return `This action returns all testRoutes`;
    }

    findOne(id: number) {
        return `This action returns a #${id} testRoute`;
    }

    update(id: number, updateTestRouteDto: UpdateTestRouteDto) {
        return `This action updates a #${id} testRoute`;
    }

    remove(id: number) {
        return `This action removes a #${id} testRoute`;
    }

    test() {
        return "test";
    }
    async testAsync() {
        return "test async";
    }
}
