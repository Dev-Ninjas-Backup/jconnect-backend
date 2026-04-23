import { GetUser, ValidateAuth } from "@common/jwt/jwt.decorator";
import { TResponse } from "@common/utilsResponse/response.util";
import { Body, Controller, Delete, Get, Param, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { NotificationToggleDto } from "./dto/create-notification.dto";
import { NotificationSettingService } from "./notification.service";

@ApiTags("Notification Setting")
@ValidateAuth()
@ApiBearerAuth()
@Controller("notification-setting")
export class NotificationSettingController {
    constructor(private readonly notificationSettingService: NotificationSettingService) {}

    @Get()
    @ApiOperation({ summary: "Get notification settings for current user" })
    async getNotificationSetting(@GetUser("userId") userId: string): Promise<TResponse<any>> {
        return await this.notificationSettingService.getNotificationSetting(userId);
    }

    @Patch()
    @ApiOperation({ summary: "Update notification settings" })
    async updateNotificationSetting(
        @GetUser("userId") userId: string,
        @Body() dto: NotificationToggleDto,
    ): Promise<TResponse<any>> {
        return await this.notificationSettingService.updateNotificationSetting(userId, dto);
    }

    // ------------------- Get user specific notifications -------------------
    @Get("/user-specific-notification")
    @ApiOperation({ summary: "Get all notifications for current user" })
    async getUserSpecificNotification(@GetUser("userId") userId: string): Promise<TResponse<any>> {
        return await this.notificationSettingService.getUserSpecificNotification(userId);
    }

    // ------------------- Mark notification as read -------------------
    @Patch("/mark-read/:notificationId")
    @ApiOperation({ summary: "Mark a specific notification as read" })
    async markAsRead(
        @GetUser("userId") userId: string,
        @Param("notificationId") notificationId: string,
    ): Promise<TResponse<any>> {
        return await this.notificationSettingService.markAsRead(userId, notificationId);
    }

    // ------------------- Mark all notifications as read -------------------
    @Patch("/mark-all-read")
    @ApiOperation({ summary: "Mark all notifications as read" })
    async markAllAsRead(@GetUser("userId") userId: string): Promise<TResponse<any>> {
        return await this.notificationSettingService.markAllAsRead(userId);
    }

    // ------------------- Delete notification -------------------
    @Delete("/:notificationId")
    @ApiOperation({ summary: "Delete a specific notification" })
    async deleteNotification(
        @GetUser("userId") userId: string,
        @Param("notificationId") notificationId: string,
    ): Promise<TResponse<any>> {
        return await this.notificationSettingService.deleteNotification(userId, notificationId);
    }

    // ------------------- Get unread count -------------------
    @Get("/unread-count")
    @ApiOperation({ summary: "Get count of unread notifications" })
    async getUnreadCount(@GetUser("userId") userId: string): Promise<TResponse<any>> {
        return await this.notificationSettingService.getUnreadCount(userId);
    }

    // ------------------- get all user with chant me -----
}
