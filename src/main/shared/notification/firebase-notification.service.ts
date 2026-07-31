import { HandleError } from "@common/error/handle-error.decorator";
import { Injectable, Logger } from "@nestjs/common";
import { NotificationType } from "src/lib/firebase/dto/notification.dto";
import { FirebaseMessagingService } from "src/lib/firebase/firebase-messaging.service";
import { PrismaService } from "src/lib/prisma/prisma.service";

export interface NotificationTemplate {
    title: string;
    body: string;
    type: NotificationType;
    data?: Record<string, string>;
}

@Injectable()
export class FirebaseNotificationService {
    private readonly logger = new Logger(FirebaseNotificationService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly fcmService: FirebaseMessagingService,
    ) {}

    /**
     * ---------- Send notification to a user --------------------
     */
    async sendToUser(
        userId: string,
        notification: NotificationTemplate,
        saveToDb: boolean = true,
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // ---------------Get user's FCM token-------------------------
            const user = (await this.prisma.user.findUnique({
                where: { id: userId },
                select: { fcmToken: true } as any,
            })) as { fcmToken: string | null } | null;

            if (!user) {
                this.logger.error(`User ${userId} not found`);
                return { success: false, error: "User not found" };
            }

            if (!user.fcmToken) {
                this.logger.warn(
                    `User ${userId} has no FCM token - skipping push notification but saving to DB`,
                );
                // Save to DB even if FCM token is missing
                if (saveToDb) {
                    await this.saveNotificationToDb(userId, notification);
                }
                return { success: false, error: "User has no FCM token" };
            }

            // ------------------Check notification settings ----------------
            const canSend = await this.checkNotificationSettings(userId, notification.type);
            if (!canSend) {
                this.logger.log(`User ${userId} has disabled ${notification.type} notifications`);
                return { success: false, error: "User has disabled this notification type" };
            }

            // ------------------Send FCM notification ----------------
            this.logger.log(
                `Sending ${notification.type} notification to user ${userId} with FCM token`,
            );
            const result = await this.fcmService.sendToDevice({
                fcmToken: user.fcmToken,
                notification: {
                    title: notification.title,
                    body: notification.body,
                },
                data: {
                    type: notification.type,
                    ...notification.data,
                },
                android: {
                    priority: "high",
                    sound: "default",
                    channelId: "default_channel",
                },
                apns: {
                    sound: "default",
                    badge: 1,
                },
            });

            // ---------- Save notification to database ----------
            if (saveToDb && result.success) {
                await this.saveNotificationToDb(userId, notification);
            }

            this.logger.log(`Notification result for user ${userId}: ${JSON.stringify(result)}`);
            return result;
        } catch (error) {
            this.logger.error(
                `Error sending notification to user ${userId}: ${error.message}`,
                error.stack,
            );
            return { success: false, error: error.message };
        }
    }

    /**
     * Send notification to multiple users
     */
    async sendToMultipleUsers(
        userIds: string[],
        notification: NotificationTemplate,
        saveToDb: boolean = true,
    ): Promise<{ successCount: number; failureCount: number }> {
        try {
            // Get FCM tokens for all users
            const users = (await this.prisma.user.findMany({
                where: {
                    id: { in: userIds },
                } as any,
                select: { id: true, fcmToken: true } as any,
            })) as unknown as Array<{ id: string; fcmToken: string | null }>;

            // Filter out users without valid FCM tokens
            const validUsers = users.filter(
                (u) => u.fcmToken && u.fcmToken.trim() !== "" && u.fcmToken !== "null",
            );

            if (validUsers.length === 0) {
                this.logger.warn("No users with FCM tokens found");
                return { successCount: 0, failureCount: userIds.length };
            }

            // Filter users based on notification settings
            const eligibleUsers = await this.filterUsersByNotificationSettings(
                validUsers.map((u) => u.id),
                notification.type,
            );

            const eligibleTokens = validUsers
                .filter((u) => eligibleUsers.includes(u.id))
                .map((u) => u.fcmToken as string)
                .filter((token) => token && token.trim() !== "");

            if (eligibleTokens.length === 0) {
                return { successCount: 0, failureCount: userIds.length };
            }

            // --------------Send FCM notification to eligible users----------------
            const result = await this.fcmService.sendToMultipleDevices({
                fcmTokens: eligibleTokens,
                notification: {
                    title: notification.title,
                    body: notification.body,
                },
                data: {
                    type: notification.type,
                    ...notification.data,
                },
                android: {
                    priority: "high",
                    sound: "default",
                },
                apns: {
                    sound: "default",
                },
            });

            // ------------ Save notifications to database -----------------------
            if (saveToDb && result.successCount > 0) {
                await Promise.all(
                    eligibleUsers.map((userId) => this.saveNotificationToDb(userId, notification)),
                );
            }

            return {
                successCount: result.successCount,
                failureCount: result.failureCount,
            };
        } catch (error) {
            this.logger.error(`Error sending notifications to multiple users: ${error.message}`);
            return { successCount: 0, failureCount: userIds.length };
        }
    }

    /**
     *------ Send notification to all users subscribed to a topic -------
     */
    async sendToTopic(
        topic: string,
        notification: NotificationTemplate,
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const result = await this.fcmService.sendToTopic({
                topic,
                notification: {
                    title: notification.title,
                    body: notification.body,
                },
                data: {
                    type: notification.type,
                    ...notification.data,
                },
                android: {
                    priority: "high",
                    sound: "default",
                },
                apns: {
                    sound: "default",
                },
            });

            return result;
        } catch (error) {
            this.logger.error(`Error sending notification to topic ${topic}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     *------------- Update user's FCM token in database -------------
     */

    @HandleError("Error updating FCM token for user")
    async updateFcmToken(userId: string, fcmToken: string): Promise<void> {
        try {
            await this.prisma.user.update({
                where: { id: userId },
                data: { fcmToken } as any,
            });
            this.logger.log(`Updated FCM token for user ${userId}`);
        } catch (error) {
            this.logger.error(`Error updating FCM token for user ${userId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * ----------------Subscribe user to a topic ----------------
     */
    @HandleError("Error subscribing user to topic")
    async subscribeUserToTopic(userId: string, topic: string): Promise<{ success: boolean }> {
        try {
            const user = (await this.prisma.user.findUnique({
                where: { id: userId },
                select: { fcmToken: true } as any,
            })) as { fcmToken: string | null } | null;

            if (!user || !user.fcmToken) {
                return { success: false };
            }

            const result = await this.fcmService.subscribeToTopic([user.fcmToken], topic);
            return { success: result.success };
        } catch (error) {
            this.logger.error(
                `Error subscribing user ${userId} to topic ${topic}: ${error.message}`,
            );
            return { success: false };
        }
    }

    /**
     * --------------- Unsubscribe user from a topic ---------------
     */
    @HandleError("Error unsubscribing user from topic")
    async unsubscribeUserFromTopic(userId: string, topic: string): Promise<{ success: boolean }> {
        try {
            const user = (await this.prisma.user.findUnique({
                where: { id: userId },
                select: { fcmToken: true } as any,
            })) as { fcmToken: string | null } | null;

            if (!user || !user.fcmToken) {
                return { success: false };
            }

            const result = await this.fcmService.unsubscribeFromTopic([user.fcmToken], topic);
            return { success: result.success };
        } catch (error) {
            this.logger.error(
                `Error unsubscribing user ${userId} from topic ${topic}: ${error.message}`,
            );
            return { success: false };
        }
    }

    /**
     *  -------------- Check if user has enabled specific notification type ----------------
     */
    private async checkNotificationSettings(
        userId: string,
        type: NotificationType,
    ): Promise<boolean> {
        try {
            const settings = await this.prisma.notificationToggle.findFirst({
                where: { userId },
            });

            if (!settings) {
                return true;
            }

            const typeMapping: Partial<Record<NotificationType, string>> = {
                [NotificationType.NEW_MESSAGE]: "message",
                [NotificationType.SERVICE_REQUEST]: "Service",
                [NotificationType.REVIEW_RECEIVED]: "review",
                [NotificationType.ANNOUNCEMENT]: "post",
                [NotificationType.ORDER_UPDATE]: "order",
                [NotificationType.PAYMENT_RECEIVED]: "payment",
            };

            const settingKey = typeMapping[type];
            if (!settingKey || !(settingKey in settings)) {
                return true;
            }

            return settings[settingKey as keyof typeof settings] !== false;
        } catch (error) {
            this.logger.error(`Error checking notification settings: ${error.message}`);
            return true;
        }
    }

    /**
     *----------------  Filter users based on notification settings ------------------
     */
    private async filterUsersByNotificationSettings(
        userIds: string[],
        type: NotificationType,
    ): Promise<string[]> {
        const eligibleUsers: string[] = [];

        for (const userId of userIds) {
            const canSend = await this.checkNotificationSettings(userId, type);
            if (canSend) {
                eligibleUsers.push(userId);
            }
        }

        return eligibleUsers;
    }

    /**
     *------------------  Save notification to database ------------------
     */
    private async saveNotificationToDb(
        userId: string,
        notification: NotificationTemplate,
    ): Promise<void> {
        try {
            // -------------- Create notification record with userId ----------------
            const notificationRecord = await this.prisma.notification.create({
                data: {
                    userId: userId,
                    title: notification.title,
                    message: notification.body,
                    metadata: notification.data || {},
                },
            });

            const prismaNotificationType = this.mapToPrismaNotificationType(notification.type);

            // ---------------- Link notification to user ----------------
            await this.prisma.userNotification.create({
                data: {
                    userId,
                    notificationId: notificationRecord.id,
                    type: prismaNotificationType,
                    read: false,
                },
            });
        } catch (error) {
            this.logger.error(`Error saving notification to database: ${error.message}`);
        }
    }

    /**
     *  --------------- Map our custom NotificationType to Prisma's enum-------------------
     */
    private mapToPrismaNotificationType(type: NotificationType): any {
        const mapping: Partial<Record<NotificationType, string>> = {
            [NotificationType.SERVICE_REQUEST]: "Service",
            [NotificationType.PAYMENT_RECEIVED]: "Payment",
            [NotificationType.ORDER_UPDATE]: "Service",
            [NotificationType.NEW_MESSAGE]: "Inquiry",
            [NotificationType.NEW_FOLLOWER]: "UserRegistration",
            [NotificationType.NEW_LIKE]: "UserRegistration",
            [NotificationType.NEW_COMMENT]: "UserRegistration",
            [NotificationType.REVIEW_RECEIVED]: "UserRegistration",
            [NotificationType.ANNOUNCEMENT]: "UserRegistration",
            [NotificationType.CUSTOM]: "UserRegistration",
            [NotificationType.SERVICE_REQUEST_ACCEPTED]: "Service",
            [NotificationType.SERVICE_REQUEST_DECLINED]: "Service",
            [NotificationType.UPLOAD_PROOF]: "Service",
        };

        return mapping[type] || null;
    }

    /**
     *-------------------- Build notification templates----------------------------
     */
    buildNotificationTemplate(
        type: NotificationType,
        data: Record<string, any>,
    ): NotificationTemplate {
        const templates: Record<NotificationType, (data: any) => NotificationTemplate> = {
            [NotificationType.NEW_MESSAGE]: (d) => ({
                title: "New Message",
                body: `${d.senderName} sent you a message: ${d.messagePreview}`,
                type: NotificationType.NEW_MESSAGE,
                data: { senderId: d.senderId, conversationId: d.conversationId },
            }),
            [NotificationType.NEW_FOLLOWER]: (d) => ({
                title: "New Follower",
                body: `${d.followerName} started following you`,
                type: NotificationType.NEW_FOLLOWER,
                data: { followerId: d.followerId },
            }),
            [NotificationType.NEW_LIKE]: (d) => ({
                title: "New Like",
                body: `${d.userName} liked your ${d.contentType}`,
                type: NotificationType.NEW_LIKE,
                data: { userId: d.userId, contentId: d.contentId, contentType: d.contentType },
            }),
            [NotificationType.NEW_COMMENT]: (d) => ({
                title: "New Comment",
                body: `${d.userName} commented on your ${d.contentType}: ${d.commentPreview}`,
                type: NotificationType.NEW_COMMENT,
                data: { userId: d.userId, contentId: d.contentId, commentId: d.commentId },
            }),
            [NotificationType.SERVICE_REQUEST]: (d) => ({
                title: "New Service Request",
                body: `${d.clientName} requested your ${d.serviceName} service`,
                type: NotificationType.SERVICE_REQUEST,
                data: { requestId: d.requestId, serviceId: d.serviceId },
            }),
            [NotificationType.ORDER_UPDATE]: (d) => ({
                title: "Order Update",
                body: `Your order #${d.orderId} status: ${d.status}`,
                type: NotificationType.ORDER_UPDATE,
                data: { orderId: d.orderId, status: d.status },
            }),
            [NotificationType.PAYMENT_RECEIVED]: (d) => ({
                title: "Payment Received",
                body: `You received $${d.amount} from ${d.payerName}`,
                type: NotificationType.PAYMENT_RECEIVED,
                data: { paymentId: d.paymentId, amount: d.amount.toString() },
            }),
            [NotificationType.REVIEW_RECEIVED]: (d) => ({
                title: "New Review",
                body: `${d.reviewerName} left you a ${d.rating}-star review`,
                type: NotificationType.REVIEW_RECEIVED,
                data: { reviewId: d.reviewId, rating: d.rating.toString() },
            }),
            [NotificationType.ANNOUNCEMENT]: (d) => ({
                title: d.title || "Announcement",
                body: d.message,
                type: NotificationType.ANNOUNCEMENT,
                data: { announcementId: d.announcementId },
            }),
            [NotificationType.CUSTOM]: (d) => ({
                title: d.title,
                body: d.body,
                type: NotificationType.CUSTOM,
                data: d.data || {},
            }),
            [NotificationType.SERVICE_REQUEST_ACCEPTED]: (d) => ({
                title: "Service Request Accepted",
                body: `${d.sellerName} has accepted your service request for "${d.serviceName}"`,
                type: NotificationType.SERVICE_REQUEST_ACCEPTED,
                data: {
                    serviceRequestId: d.serviceRequestId,
                    serviceId: d.serviceId,
                    serviceName: d.serviceName,
                    sellerId: d.sellerId,
                    sellerName: d.sellerName,
                    status: "ACCEPTED",
                },
            }),
            [NotificationType.SERVICE_REQUEST_DECLINED]: (d) => ({
                title: "Service Request Declined",
                body: `${d.sellerName} has declined your service request for "${d.serviceName}". Reason: ${d.reason || "No reason provided"}`,
                type: NotificationType.SERVICE_REQUEST_DECLINED,
                data: {
                    serviceRequestId: d.serviceRequestId,
                    serviceId: d.serviceId,
                    serviceName: d.serviceName,
                    sellerId: d.sellerId,
                    sellerName: d.sellerName,
                    status: "DECLINED",
                    reason: d.reason,
                },
            }),

            [NotificationType.UPLOAD_PROOF]: (d) => ({
                title: "Proof of Work Uploaded",
                body: `${d.uploadedByName} has uploaded proof of work for "${d.serviceName}"`,
                type: NotificationType.UPLOAD_PROOF,
                data: {
                    serviceRequestId: d.serviceRequestId,
                    serviceId: d.serviceId,
                    serviceName: d.serviceName,
                    uploadedFileUrl: d.uploadedFileUrl,
                    uploadedByUserId: d.uploadedByUserId,
                },
            }),
            [NotificationType.follow]: (d) => ({
                title: "New Follower",
                body: `${d.followerName} started following you`,
                type: NotificationType.follow,
                data: { followerId: d.followerId },
            }),

            [NotificationType.SERVICE_UPDATE]: (d) => ({
                title: "Service Updated",
                body: `${d.serviceName} has been updated`,
                type: NotificationType.SERVICE_UPDATE,
                data: { serviceId: d.serviceId },
            }),
            [NotificationType.NEW_ORDER]: (d) => ({
                title: "New Order",
                body: `You have a new order for "${d.serviceName}" from ${d.clientName}`,
                type: NotificationType.NEW_ORDER,
                data: {
                    orderId: d.orderId,
                    serviceId: d.serviceId,
                    serviceName: d.serviceName,
                    clientId: d.clientId,
                    clientName: d.clientName,
                },
            }),
        };

        const template = templates[type];
        if (!template) {
            throw new Error(`Unknown notification type: ${type}`);
        }

        return template(data);
    }
}
