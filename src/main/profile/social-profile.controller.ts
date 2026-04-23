import { GetUser, ValidateUser } from "@common/jwt/jwt.decorator";
import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CreateSocialProfileDto, UpdateSocialProfileDto } from "./dto/social-profile.dto";
import { SocialProfileService } from "./social-profile.service";

@ApiTags("Social Profile")
@ApiBearerAuth()
@ValidateUser()
@Controller("social-profiles")
export class SocialProfileController {
    constructor(private readonly socialProfileService: SocialProfileService) {}

    @Post()
    @ApiOperation({ summary: "Add a new social profile link" })
    async create(@GetUser() user: any, @Body() data: CreateSocialProfileDto) {
        return this.socialProfileService.create(user.userId, data);
    }

    @Get()
    @ApiOperation({ summary: "Get all social profile links for current user" })
    async findAll(@GetUser() user: any) {
        return this.socialProfileService.findAll(user.userId);
    }

    @Patch(":id")
    @ApiOperation({ summary: "Update a social profile link" })
    async update(
        @GetUser() user: any,
        @Param("id") id: string,
        @Body() data: UpdateSocialProfileDto,
    ) {
        return this.socialProfileService.update(user.userId, id, data);
    }

    @Delete(":id")
    @ApiOperation({ summary: "Delete a social profile link" })
    async remove(@GetUser() user: any, @Param("id") id: string) {
        return this.socialProfileService.remove(user.userId, id);
    }
}
