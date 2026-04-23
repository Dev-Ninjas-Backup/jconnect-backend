import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SettingsService } from "./settings.service";

import { GetUser, ValidateAdmin, ValidateUser } from "@common/jwt/jwt.decorator";
import { Announcement } from "./dto/announcement.dto";
import { UpdateSettingDto } from "./dto/create-dto";
import { GlobalSearchDto } from "./dto/global-search.dto";

@ApiTags("settings")
@Controller("settings")
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) {}
    @ApiBearerAuth()
    @ValidateUser()
    @Get()
    @ApiOperation({ summary: "Get platform settings" })
    get() {
        return this.settingsService.getSettings();
    }

    @ValidateAdmin()
    @ApiBearerAuth()
    @Patch()
    @ApiOperation({ summary: "Update platform settings" })
    update(@Body() dto: UpdateSettingDto) {
        return this.settingsService.updateSettings(dto);
    }

    // ----------------- notification settings ---------------------
    @ValidateAdmin()
    @ApiBearerAuth()
    @Patch("notification-toggle-settings-only-admin")
    @ApiOperation({ summary: "Update notification settings for only admin" })
    updateNotificationSettingsToggleAdmin(@GetUser("userId") userId: string) {
        return this.settingsService.updateNotificationSettingsToggleAdmin(userId);
    }

    // ---------------announcement create-------------

    @ValidateAdmin()
    @ApiBearerAuth()
    @Post("announcement")
    @ApiOperation({ summary: "Create announcement" })
    createAnnouncement(@Body() dto: Announcement) {
        return this.settingsService.createAnnouncement(dto);
    }
    // ---------get announcement----------------
    @Get("announcement")
    @ApiOperation({ summary: "Get announcement" })
    getAnnouncement() {
        return this.settingsService.getAnnouncement();
    }

    // ---------------announcement delete-------------
    @ValidateAdmin()
    @ApiBearerAuth()
    @Delete("announcement/:id")
    @ApiOperation({ summary: "Delete announcement" })
    deleteAnnouncement(@Param("id") id: string) {
        return this.settingsService.deleteAnnouncement(id);
    }

    // ---------------announcement update-------------
    @ValidateAdmin()
    @ApiBearerAuth()
    @Patch("announcement/:id")
    @ApiOperation({ summary: "Update announcement" })
    updateAnnouncement(@Param("id") id: string, @Body() dto: Announcement) {
        return this.settingsService.updateAnnouncement(id, dto);
    }

    // ---------------global search-------------
    @ValidateAdmin()
    @ApiBearerAuth()
    @Get("global-search")
    @ApiOperation({ summary: "Global search across platform" })
    globalSearch(@Query() dto: GlobalSearchDto) {
        return this.settingsService.globalSearch(dto);
    }
}
