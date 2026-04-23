import { Inject, Injectable, Logger } from "@nestjs/common";
import * as admin from "firebase-admin";
import {
    NotificationPayload,
    SendMultipleNotificationDto,
    SendNotificationDto,
    SendTopicNotificationDto,
} from "./dto/notification.dto";
import { FirebaseAdmin } from "./firebase.admin.provider";

@Injectable()
export class FirebaseMessagingService {
    private readonly logger = new Logger(FirebaseMessagingService.name);

    constructor(
        @Inject(FirebaseAdmin)
        private readonly firebaseApp: admin.app.App,
    ) {}

    /**
     * Send notification to a single device
     */
    async sendToDevice(
        dto: SendNotificationDto,
    ): Promise<{ success: boolean; messageId?: string; error?: string }> {
        try {
            const { fcmToken, notification, data, android, apns, webpush } = dto;

            if (!fcmToken) {
                throw new Error("FCM token is required");
            }

            const message: admin.messaging.Message = {
                token: fcmToken,
                notification: notification
                    ? {
                          title: notification.title,
                          body: notification.body,
                          imageUrl: notification.imageUrl,
                      }
                    : undefined,
                data: data || {},
                android: android
                    ? {
                          priority: android.priority || "high",
                          notification: {
                              sound: android.sound || "default",
                              channelId: android.channelId,
                              icon: android.icon,
                              color: android.color,
                              clickAction: android.clickAction,
                              tag: android.tag,
                          },
                      }
                    : undefined,
                apns: apns
                    ? {
                          payload: {
                              aps: {
                                  alert: apns.alert,
                                  badge: apns.badge,
                                  sound: apns.sound || "default",
                                  contentAvailable: apns.contentAvailable,
                                  category: apns.category,
                              },
                          },
                      }
                    : undefined,
                webpush: webpush
                    ? {
                          notification: {
                              title: webpush.title,
                              body: webpush.body,
                              icon: webpush.icon,
                              badge: webpush.badge,
                              image: webpush.image,
                          },
                          fcmOptions: {
                              link: webpush.link,
                          },
                      }
                    : undefined,
            };

            const response = await this.firebaseApp.messaging().send(message);

            this.logger.log(`Successfully sent message to device: ${response}`);

            return {
                success: true,
                messageId: response,
            };
        } catch (error) {
            this.logger.error(
                `Error sending notification to device: ${error.message}`,
                error.stack,
            );
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Send notification to multiple devices
     */
    async sendToMultipleDevices(dto: SendMultipleNotificationDto): Promise<{
        success: boolean;
        successCount: number;
        failureCount: number;
        responses?: admin.messaging.BatchResponse;
    }> {
        try {
            const { fcmTokens, notification, data, android, apns, webpush } = dto;

            if (!fcmTokens || fcmTokens.length === 0) {
                throw new Error("At least one FCM token is required");
            }

            // Filter out invalid tokens
            const validTokens = fcmTokens.filter((token) => token && token.trim() !== "");

            if (validTokens.length === 0) {
                throw new Error("No valid FCM tokens provided");
            }

            const message: admin.messaging.MulticastMessage = {
                tokens: validTokens,
                notification: notification
                    ? {
                          title: notification.title,
                          body: notification.body,
                          imageUrl: notification.imageUrl,
                      }
                    : undefined,
                data: data || {},
                android: android
                    ? {
                          priority: android.priority || "high",
                          notification: {
                              sound: android.sound || "default",
                              channelId: android.channelId,
                              icon: android.icon,
                              color: android.color,
                          },
                      }
                    : undefined,
                apns: apns
                    ? {
                          payload: {
                              aps: {
                                  alert: apns.alert,
                                  badge: apns.badge,
                                  sound: apns.sound || "default",
                              },
                          },
                      }
                    : undefined,
                webpush: webpush
                    ? {
                          notification: {
                              title: webpush.title,
                              body: webpush.body,
                              icon: webpush.icon,
                          },
                          fcmOptions: {
                              link: webpush.link,
                          },
                      }
                    : undefined,
            };

            const response = await this.firebaseApp.messaging().sendEachForMulticast(message);

            this.logger.log(
                `Successfully sent ${response.successCount} messages, ${response.failureCount} failed`,
            );

            // Log failed tokens for debugging
            if (response.failureCount > 0) {
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        this.logger.warn(
                            `Failed to send to token ${validTokens[idx]}: ${resp.error?.message}`,
                        );
                    }
                });
            }

            return {
                success: response.successCount > 0,
                successCount: response.successCount,
                failureCount: response.failureCount,
                responses: response,
            };
        } catch (error) {
            this.logger.error(
                `Error sending notifications to multiple devices: ${error.message}`,
                error.stack,
            );
            return {
                success: false,
                successCount: 0,
                failureCount: dto.fcmTokens?.length || 0,
            };
        }
    }

    /**
     * Send notification to a topic
     */
    async sendToTopic(
        dto: SendTopicNotificationDto,
    ): Promise<{ success: boolean; messageId?: string; error?: string }> {
        try {
            const { topic, notification, data, android, apns, webpush } = dto;

            if (!topic) {
                throw new Error("Topic is required");
            }

            const message: admin.messaging.Message = {
                topic: topic,
                notification: notification
                    ? {
                          title: notification.title,
                          body: notification.body,
                          imageUrl: notification.imageUrl,
                      }
                    : undefined,
                data: data || {},
                android: android
                    ? {
                          priority: android.priority || "high",
                          notification: {
                              sound: android.sound || "default",
                              channelId: android.channelId,
                              icon: android.icon,
                              color: android.color,
                          },
                      }
                    : undefined,
                apns: apns
                    ? {
                          payload: {
                              aps: {
                                  alert: apns.alert,
                                  badge: apns.badge,
                                  sound: apns.sound || "default",
                              },
                          },
                      }
                    : undefined,
                webpush: webpush
                    ? {
                          notification: {
                              title: webpush.title,
                              body: webpush.body,
                              icon: webpush.icon,
                          },
                      }
                    : undefined,
            };

            const response = await this.firebaseApp.messaging().send(message);

            this.logger.log(`Successfully sent message to topic ${topic}: ${response}`);

            return {
                success: true,
                messageId: response,
            };
        } catch (error) {
            this.logger.error(`Error sending notification to topic: ${error.message}`, error.stack);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Subscribe devices to a topic
     */
    async subscribeToTopic(
        tokens: string[],
        topic: string,
    ): Promise<{
        success: boolean;
        successCount: number;
        failureCount: number;
        errors?: any[];
    }> {
        try {
            if (!tokens || tokens.length === 0) {
                throw new Error("At least one FCM token is required");
            }

            if (!topic) {
                throw new Error("Topic is required");
            }

            const response = await this.firebaseApp.messaging().subscribeToTopic(tokens, topic);

            this.logger.log(
                `Successfully subscribed ${response.successCount} devices to topic ${topic}, ${response.failureCount} failed`,
            );

            return {
                success: response.successCount > 0,
                successCount: response.successCount,
                failureCount: response.failureCount,
                errors: response.errors,
            };
        } catch (error) {
            this.logger.error(`Error subscribing to topic: ${error.message}`, error.stack);
            return {
                success: false,
                successCount: 0,
                failureCount: tokens.length,
            };
        }
    }

    /**
     * Unsubscribe devices from a topic
     */
    async unsubscribeFromTopic(
        tokens: string[],
        topic: string,
    ): Promise<{
        success: boolean;
        successCount: number;
        failureCount: number;
        errors?: any[];
    }> {
        try {
            if (!tokens || tokens.length === 0) {
                throw new Error("At least one FCM token is required");
            }

            if (!topic) {
                throw new Error("Topic is required");
            }

            const response = await this.firebaseApp.messaging().unsubscribeFromTopic(tokens, topic);

            this.logger.log(
                `Successfully unsubscribed ${response.successCount} devices from topic ${topic}, ${response.failureCount} failed`,
            );

            return {
                success: response.successCount > 0,
                successCount: response.successCount,
                failureCount: response.failureCount,
                errors: response.errors,
            };
        } catch (error) {
            this.logger.error(`Error unsubscribing from topic: ${error.message}`, error.stack);
            return {
                success: false,
                successCount: 0,
                failureCount: tokens.length,
            };
        }
    }

    /**
     * Send notification with custom payload
     */
    async sendCustomNotification(
        fcmToken: string,
        payload: NotificationPayload,
    ): Promise<{ success: boolean; messageId?: string; error?: string }> {
        try {
            const message: admin.messaging.Message = {
                token: fcmToken,
                ...payload,
            };

            const response = await this.firebaseApp.messaging().send(message);

            this.logger.log(`Successfully sent custom notification: ${response}`);

            return {
                success: true,
                messageId: response,
            };
        } catch (error) {
            this.logger.error(`Error sending custom notification: ${error.message}`, error.stack);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Verify FCM token validity
     */
    async verifyToken(fcmToken: string): Promise<boolean> {
        try {
            await this.firebaseApp.messaging().send(
                {
                    token: fcmToken,
                    data: { test: "test" },
                },
                true,
            );
            return true;
        } catch (error) {
            this.logger.warn(`Invalid FCM token: ${error.message}`);
            return false;
        }
    }

    /**
     * Remove invalid tokens from database
     */
    async cleanupInvalidTokens(tokens: string[]): Promise<string[]> {
        const validTokens: string[] = [];

        for (const token of tokens) {
            const isValid = await this.verifyToken(token);
            if (isValid) {
                validTokens.push(token);
            }
        }

        return validTokens;
    }
}
