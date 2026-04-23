import { Injectable, Logger } from "@nestjs/common";
import { NotificationType } from "src/lib/firebase/dto/notification.dto";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { FirebaseNotificationService } from "./firebase-notification.service";

/**
 * Example service showing how to integrate Firebase notifications
 * into various parts of your application
 */
@Injectable()
export class NotificationIntegrationExampleService {
    private readonly logger = new Logger(NotificationIntegrationExampleService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly firebaseNotificationService: FirebaseNotificationService,
    ) {}

    /**
     * Example: Send notification when a new message is received
     */
    async onNewMessage(
        senderId: string,
        receiverId: string,
        conversationId: string,
        messageContent: string,
    ) {
        try {
            // Get sender details
            const sender = await this.prisma.user.findUnique({
                where: { id: senderId },
                select: { full_name: true, profilePhoto: true },
            });

            if (!sender) {
                return;
            }

            // Build and send notification
            const notification = this.firebaseNotificationService.buildNotificationTemplate(
                NotificationType.NEW_MESSAGE,
                {
                    senderName: sender.full_name,
                    senderId: senderId,
                    messagePreview: messageContent.substring(0, 100),
                    conversationId: conversationId,
                },
            );

            await this.firebaseNotificationService.sendToUser(receiverId, notification, true);

            this.logger.log(`Message notification sent to user ${receiverId}`);
        } catch (error) {
            this.logger.error(`Failed to send message notification: ${error.message}`);
        }
    }

    /**
     * Example: Send notification when someone follows a user
     */
    async onNewFollower(followerId: string, followeeId: string) {
        try {
            const follower = await this.prisma.user.findUnique({
                where: { id: followerId },
                select: { full_name: true, profilePhoto: true },
            });

            if (!follower) {
                return;
            }

            const notification = this.firebaseNotificationService.buildNotificationTemplate(
                NotificationType.NEW_FOLLOWER,
                {
                    followerName: follower.full_name,
                    followerId: followerId,
                },
            );

            await this.firebaseNotificationService.sendToUser(followeeId, notification, true);

            this.logger.log(`Follower notification sent to user ${followeeId}`);
        } catch (error) {
            this.logger.error(`Failed to send follower notification: ${error.message}`);
        }
    }

    /**
     * Example: Send notification for new service request
     */
    async onServiceRequest(
        requestId: string,
        clientId: string,
        providerId: string,
        serviceId: string,
    ) {
        try {
            const [client, service] = await Promise.all([
                this.prisma.user.findUnique({
                    where: { id: clientId },
                    select: { full_name: true },
                }),
                this.prisma.service.findUnique({
                    where: { id: serviceId },
                    select: { serviceName: true },
                }),
            ]);

            if (!client || !service) {
                return;
            }

            const notification = this.firebaseNotificationService.buildNotificationTemplate(
                NotificationType.SERVICE_REQUEST,
                {
                    clientName: client.full_name,
                    serviceName: service.serviceName,
                    requestId: requestId,
                    serviceId: serviceId,
                },
            );

            await this.firebaseNotificationService.sendToUser(providerId, notification, true);

            this.logger.log(`Service request notification sent to provider ${providerId}`);
        } catch (error) {
            this.logger.error(`Failed to send service request notification: ${error.message}`);
        }
    }

    /**
     * Example: Send notification for order status update
     */
    async onOrderStatusUpdate(orderId: string, buyerId: string, newStatus: string) {
        try {
            const notification = this.firebaseNotificationService.buildNotificationTemplate(
                NotificationType.ORDER_UPDATE,
                {
                    orderId: orderId,
                    status: newStatus,
                },
            );

            await this.firebaseNotificationService.sendToUser(buyerId, notification, true);

            this.logger.log(`Order update notification sent to buyer ${buyerId}`);
        } catch (error) {
            this.logger.error(`Failed to send order update notification: ${error.message}`);
        }
    }

    /**
     * Example: Send notification for payment received
     */
    async onPaymentReceived(
        paymentId: string,
        payerId: string,
        receiverId: string,
        amount: number,
    ) {
        try {
            const payer = await this.prisma.user.findUnique({
                where: { id: payerId },
                select: { full_name: true },
            });

            if (!payer) {
                return;
            }

            const notification = this.firebaseNotificationService.buildNotificationTemplate(
                NotificationType.PAYMENT_RECEIVED,
                {
                    paymentId: paymentId,
                    amount: amount,
                    payerName: payer.full_name,
                },
            );

            await this.firebaseNotificationService.sendToUser(receiverId, notification, true);

            this.logger.log(`Payment notification sent to receiver ${receiverId}`);
        } catch (error) {
            this.logger.error(`Failed to send payment notification: ${error.message}`);
        }
    }

    /**
     * Example: Send notification for new review
     */
    async onReviewReceived(
        reviewId: string,
        reviewerId: string,
        reviewedUserId: string,
        rating: number,
    ) {
        try {
            const reviewer = await this.prisma.user.findUnique({
                where: { id: reviewerId },
                select: { full_name: true },
            });

            if (!reviewer) {
                return;
            }

            const notification = this.firebaseNotificationService.buildNotificationTemplate(
                NotificationType.REVIEW_RECEIVED,
                {
                    reviewId: reviewId,
                    reviewerName: reviewer.full_name,
                    rating: rating,
                },
            );

            await this.firebaseNotificationService.sendToUser(reviewedUserId, notification, true);

            this.logger.log(`Review notification sent to user ${reviewedUserId}`);
        } catch (error) {
            this.logger.error(`Failed to send review notification: ${error.message}`);
        }
    }

    /**
     * Example: Send notification for post like
     */
    async onPostLiked(postId: string, likerId: string, postOwnerId: string) {
        try {
            // Don't notify if user likes their own post
            if (likerId === postOwnerId) {
                return;
            }

            const liker = await this.prisma.user.findUnique({
                where: { id: likerId },
                select: { full_name: true },
            });

            if (!liker) {
                return;
            }

            const notification = this.firebaseNotificationService.buildNotificationTemplate(
                NotificationType.NEW_LIKE,
                {
                    userName: liker.full_name,
                    userId: likerId,
                    contentId: postId,
                    contentType: "post",
                },
            );

            await this.firebaseNotificationService.sendToUser(postOwnerId, notification, true);

            this.logger.log(`Like notification sent to user ${postOwnerId}`);
        } catch (error) {
            this.logger.error(`Failed to send like notification: ${error.message}`);
        }
    }

    /**
     * Example: Send notification for new comment
     */
    async onNewComment(
        commentId: string,
        commenterId: string,
        postOwnerId: string,
        postId: string,
        commentText: string,
    ) {
        try {
            // Don't notify if user comments on their own post
            if (commenterId === postOwnerId) {
                return;
            }

            const commenter = await this.prisma.user.findUnique({
                where: { id: commenterId },
                select: { full_name: true },
            });

            if (!commenter) {
                return;
            }

            const notification = this.firebaseNotificationService.buildNotificationTemplate(
                NotificationType.NEW_COMMENT,
                {
                    userName: commenter.full_name,
                    userId: commenterId,
                    contentId: postId,
                    commentId: commentId,
                    contentType: "post",
                    commentPreview: commentText.substring(0, 50),
                },
            );

            await this.firebaseNotificationService.sendToUser(postOwnerId, notification, true);

            this.logger.log(`Comment notification sent to user ${postOwnerId}`);
        } catch (error) {
            this.logger.error(`Failed to send comment notification: ${error.message}`);
        }
    }

    /**
     * Example: Send announcement to multiple users
     */
    async sendAnnouncementToUsers(
        userIds: string[],
        title: string,
        message: string,
        announcementId: string,
    ) {
        try {
            const notification = this.firebaseNotificationService.buildNotificationTemplate(
                NotificationType.ANNOUNCEMENT,
                {
                    title: title,
                    message: message,
                    announcementId: announcementId,
                },
            );

            const result = await this.firebaseNotificationService.sendToMultipleUsers(
                userIds,
                notification,
                true,
            );

            this.logger.log(
                `Announcement sent: ${result.successCount} successful, ${result.failureCount} failed`,
            );

            return result;
        } catch (error) {
            this.logger.error(`Failed to send announcement: ${error.message}`);
            return { successCount: 0, failureCount: userIds.length };
        }
    }

    /**
     * Example: Send global announcement via topic
     */
    async sendGlobalAnnouncement(title: string, message: string, announcementId: string) {
        try {
            const notification = this.firebaseNotificationService.buildNotificationTemplate(
                NotificationType.ANNOUNCEMENT,
                {
                    title: title,
                    message: message,
                    announcementId: announcementId,
                },
            );

            const result = await this.firebaseNotificationService.sendToTopic(
                "all_users",
                notification,
            );

            this.logger.log(`Global announcement sent to topic 'all_users'`);

            return result;
        } catch (error) {
            this.logger.error(`Failed to send global announcement: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Example: Subscribe new users to default topics
     */
    async subscribeNewUserToDefaultTopics(userId: string) {
        try {
            const defaultTopics = ["all_users", "announcements"];

            for (const topic of defaultTopics) {
                await this.firebaseNotificationService.subscribeUserToTopic(userId, topic);
            }

            this.logger.log(`User ${userId} subscribed to default topics`);
        } catch (error) {
            this.logger.error(`Failed to subscribe user to default topics: ${error.message}`);
        }
    }

    /**
     * Example: Update FCM token on user login
     */
    async updateUserFcmTokenOnLogin(userId: string, fcmToken: string) {
        try {
            if (!fcmToken || fcmToken === "") {
                return;
            }

            await this.firebaseNotificationService.updateFcmToken(userId, fcmToken);

            this.logger.log(`FCM token updated for user ${userId}`);
        } catch (error) {
            this.logger.error(`Failed to update FCM token: ${error.message}`);
        }
    }
}
