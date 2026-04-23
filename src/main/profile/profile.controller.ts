// src/profile/profile.controller.ts
import { GetUser, ValidateUser } from "@common/jwt/jwt.decorator";
import { Body, Controller, Delete, Get, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CreateProfileDto, UpdateProfileDto } from "./dto/profile.dto";
import { ProfileService } from "./profile.service";

@ApiTags("Profile")
@Controller("profiles")
export class ProfileController {
    constructor(private readonly profileService: ProfileService) {}

    @ApiBearerAuth()
    @ValidateUser()
    @Post()
    @ApiOperation({ summary: "Create a user profile" })
    async create(@Body() createProfileDto: CreateProfileDto, @GetUser() user: any) {
        const userProfileData = { ...createProfileDto, ...user };
        console.log(" ami user bolchi", user);
        return this.profileService.create(userProfileData);
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Get()
    @ApiOperation({ summary: "Get My profiles" })
    @ApiResponse({ status: 200, description: "List of profiles" })
    findAll(@GetUser() user: any) {
        return this.profileService.findOne(user.userId);
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Put()
    @ApiOperation({ summary: "Update my profile" })
    @ApiResponse({ status: 200, description: "Profile updated successfully" })
    update(@Body() updateProfileDto: UpdateProfileDto, @GetUser() user: any) {
        return this.profileService.update(user.userId, updateProfileDto);
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Delete()
    @ApiOperation({ summary: "Delete my profile" })
    @ApiResponse({ status: 200, description: "Profile deleted successfully" })
    remove(@GetUser() user: any) {
        return this.profileService.remove(user.userId);
    }
}
