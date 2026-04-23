import { HandleError } from "@common/error/handle-error.decorator";
import { errorResponse, successResponse, TResponse } from "@common/utilsResponse/response.util";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { NotificationToggleDto } from "./dto/create-notification.dto";

@Injectable()
export class NotificationSettingService {
    constructor(private readonly prisma: PrismaService) {}
    // ---------------- Get notification settings ----------------
    @HandleError("Failed to get notification settings")
    async getNotificationSetting(userId: string): Promise<TResponse<any>> {
        try {
            let toggle = await this.prisma.notificationToggle.findFirst({
                where: { userId },
            });

            if (!toggle) {
                toggle = await this.prisma.notificationToggle.create({
                    data: { userId },
                });
            }

            return successResponse(toggle, "Notification settings retrieved");
        } catch (error) {
            return errorResponse("Failed to get notification settings");
        }
    }

    // ---------------- Update notification settings ----------------

    @HandleError("Failed to update notification settings")
    async updateNotificationSetting(
        userId: string,
        dto: NotificationToggleDto,
    ): Promise<TResponse<any>> {
        try {
            const existing = await this.prisma.notificationToggle.findFirst({
                where: { userId },
            });

            const toggle = existing
                ? await this.prisma.notificationToggle.update({
                      where: { id: existing.id },
                      data: dto,
                  })
                : await this.prisma.notificationToggle.create({
                      data: {
                          userId,
                          ...dto,
                      },
                  });

            return successResponse(toggle, "Notification settings updated");
        } catch (error) {
            return errorResponse("Failed to update notification settings");
        }
    }

    // ---------------- Get user-specific notifications ----------------
    @HandleError("Failed to get notifications")
    async getUserSpecificNotification(userId: string): Promise<TResponse<any>> {
        try {
            const notifications = await this.prisma.userNotification.findMany({
                where: { userId },
                include: {
                    notification: {
                        select: {
                            id: true,
                            title: true,
                            message: true,
                            entityId: true,
                            metadata: true,
                            createdAt: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                take: 50,
            });

            const formattedNotifications = notifications.map((un) => ({
                id: un.id,
                notificationId: un.notificationId,
                type: un.type,
                read: un.read,
                createdAt: un.createdAt,
                updatedAt: un.updatedAt,
                title: un.notification.title,
                message: un.notification.message,
                entityId: un.notification.entityId,
                metadata: un.notification.metadata,
                notificationCreatedAt: un.notification.createdAt,
            }));

            const unreadCount = notifications.filter((n) => !n.read).length;

            return successResponse(
                {
                    notifications: formattedNotifications,
                    unreadCount,
                    total: notifications.length,
                },
                "Notifications retrieved",
            );
        } catch (error) {
            return errorResponse("Failed to get notifications");
        }
    }

    // ---------------- Mark notification as read ----------------
    @HandleError("Failed to mark notification as read")
    async markAsRead(userId: string, notificationId: string): Promise<TResponse<any>> {
        try {
            const userNotification = await this.prisma.userNotification.updateMany({
                where: {
                    userId,
                    notificationId,
                },
                data: { read: true },
            });

            if (userNotification.count === 0) {
                return errorResponse("Notification not found");
            }

            return successResponse("Notification marked as read");
        } catch (error) {
            return errorResponse("Failed to mark notification as read");
        }
    }

    //----------------- Mark all notifications as read ---------------------
    @HandleError("Failed to mark all notifications as read")
    async markAllAsRead(userId: string): Promise<TResponse<any>> {
        try {
            await this.prisma.userNotification.updateMany({
                where: { userId, read: false },
                data: { read: true },
            });

            return successResponse("All notifications marked as read");
        } catch (error) {
            return errorResponse("Failed to mark all notifications as read");
        }
    }

    //--------------- Delete a notification ----------------
    @HandleError("Failed to delete notification")
    async deleteNotification(userId: string, notificationId: string): Promise<TResponse<any>> {
        try {
            const deleted = await this.prisma.userNotification.deleteMany({
                where: {
                    userId,
                    notificationId,
                },
            });

            if (deleted.count === 0) {
                return errorResponse("Notification not found");
            }

            return successResponse("Notification deleted");
        } catch (error) {
            return errorResponse("Failed to delete notification");
        }
    }

    // ----------------- Get unread count ----------------

    @HandleError("Failed to get unread count")
    async getUnreadCount(userId: string): Promise<TResponse<any>> {
        try {
            const count = await this.prisma.userNotification.count({
                where: { userId, read: false },
            });

            return successResponse({ count }, "Unread count retrieved");
        } catch (error) {
            return errorResponse("Failed to get unread count");
        }
    }
}
