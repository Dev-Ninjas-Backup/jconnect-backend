import { Controller, Get, Post, Body, Patch, Param, Delete } from "@nestjs/common";
import { TestRoutesService } from "./test-routes.service";
import { CreateTestRouteDto } from "./dto/create-test-route.dto";
import { UpdateTestRouteDto } from "./dto/update-test-route.dto";

@Controller("test-routes")
export class TestRoutesController {
    constructor(private readonly testRoutesService: TestRoutesService) {}

    @Post()
    create(@Body() createTestRouteDto: CreateTestRouteDto) {
        return this.testRoutesService.create(createTestRouteDto);
    }

    @Get()
    findAll() {
        return this.testRoutesService.findAll();
    }

    @Get(":id")
    findOne(@Param("id") id: string) {
        return this.testRoutesService.findOne(+id);
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() updateTestRouteDto: UpdateTestRouteDto) {
        return this.testRoutesService.update(+id, updateTestRouteDto);
    }

    @Delete(":id")
    remove(@Param("id") id: string) {
        return this.testRoutesService.remove(+id);
    }
    @Post("test")
    test() {
        return this.testRoutesService.test();
    }
}
