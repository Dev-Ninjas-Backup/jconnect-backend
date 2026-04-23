import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import {
    CreateSocialServiceRequestDto,
    UpdateSocialServiceRequestDto,
} from "./dto/create-social-service-request.dto";
import { SocialServiceRequestService } from "./social-service-request.service";

@ApiExcludeController()
@Controller("social-service-request")
export class SocialServiceRequestController {
    constructor(private readonly service: SocialServiceRequestService) {}

    @Post()
    create(@Body() dto: CreateSocialServiceRequestDto) {
        return this.service.create(dto);
    }

    @Get()
    findAll() {
        return this.service.findAll();
    }

    @Get(":id")
    findOne(@Param("id") id: string) {
        return this.service.findOne(id);
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() dto: UpdateSocialServiceRequestDto) {
        return this.service.update(id, dto);
    }

    @Delete(":id")
    remove(@Param("id") id: string) {
        return this.service.remove(id);
    }
}
