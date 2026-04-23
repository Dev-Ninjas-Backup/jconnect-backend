import { Controller, Get, Post, Body, Patch, Param, Delete } from "@nestjs/common";
import { SocialServiceService } from "./social-service.service";
import { CreateSocialServiceDto, UpdateSocialServiceDto } from "./dto/create-social-service.dto";

import { ApiExcludeController, ApiTags } from "@nestjs/swagger";

@ApiExcludeController()
@ApiTags("Social Service")
@Controller("social-service")
export class SocialServiceController {
    constructor(private readonly socialService: SocialServiceService) {}

    @Post()
    create(@Body() dto: CreateSocialServiceDto) {
        return this.socialService.create(dto);
    }

    @Get()
    findAll() {
        return this.socialService.findAll();
    }

    @Get(":id")
    findOne(@Param("id") id: string) {
        return this.socialService.findOne(id);
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() dto: UpdateSocialServiceDto) {
        return this.socialService.update(id, dto);
    }

    @Delete(":id")
    remove(@Param("id") id: string) {
        return this.socialService.remove(id);
    }
}
