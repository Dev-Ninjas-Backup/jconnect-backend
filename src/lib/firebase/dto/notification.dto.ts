import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    IsArray,
    IsBoolean,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    ValidateNested,
} from "class-validator";

// Base Notification Content
export class NotificationContent {
    @ApiProperty({ description: "Notification title", example: "New Message" })
    @IsString()
    title: string;

    @ApiProperty({ description: "Notification body", example: "You have a new message from John" })
    @IsString()
    body: string;

    @ApiPropertyOptional({
        description: "Notification image URL",
        example: "https://example.com/image.jpg",
    })
    @IsOptional()
    @IsString()
    imageUrl?: string;
}

// Android Specific Configuration
export class AndroidConfig {
    @ApiPropertyOptional({
        description: "Android notification priority",
        example: "high",
        enum: ["high", "normal"],
    })
    @IsOptional()
    @IsString()
    priority?: "high" | "normal";

    @ApiPropertyOptional({ description: "Notification sound", example: "default" })
    @IsOptional()
    @IsString()
    sound?: string;

    @ApiPropertyOptional({
        description: "Android notification channel ID",
        example: "default_channel",
    })
    @IsOptional()
    @IsString()
    channelId?: string;

    @ApiPropertyOptional({ description: "Notification icon", example: "ic_notification" })
    @IsOptional()
    @IsString()
    icon?: string;

    @ApiPropertyOptional({ description: "Notification color", example: "#FF0000" })
    @IsOptional()
    @IsString()
    color?: string;

    @ApiPropertyOptional({ description: "Click action", example: "FLUTTER_NOTIFICATION_CLICK" })
    @IsOptional()
    @IsString()
    clickAction?: string;

    @ApiPropertyOptional({ description: "Notification tag", example: "message_tag" })
    @IsOptional()
    @IsString()
    tag?: string;
}

// iOS (APNS) Specific Configuration
export class ApnsConfig {
    @ApiPropertyOptional({
        description: "APNS alert object",
        example: { title: "Title", body: "Body" },
    })
    @IsOptional()
    @IsObject()
    alert?: {
        title?: string;
        body?: string;
        subtitle?: string;
    };

    @ApiPropertyOptional({ description: "Badge count", example: 1 })
    @IsOptional()
    @IsNumber()
    badge?: number;

    @ApiPropertyOptional({ description: "Notification sound", example: "default" })
    @IsOptional()
    @IsString()
    sound?: string;

    @ApiPropertyOptional({ description: "Content available flag", example: true })
    @IsOptional()
    @IsBoolean()
    contentAvailable?: boolean;

    @ApiPropertyOptional({ description: "Notification category", example: "MESSAGE_CATEGORY" })
    @IsOptional()
    @IsString()
    category?: string;
}

// Web Push Configuration
export class WebPushConfig {
    @ApiPropertyOptional({ description: "Web notification title", example: "New Message" })
    @IsOptional()
    @IsString()
    title?: string;

    @ApiPropertyOptional({
        description: "Web notification body",
        example: "You have a new message",
    })
    @IsOptional()
    @IsString()
    body?: string;

    @ApiPropertyOptional({ description: "Web notification icon", example: "/icon.png" })
    @IsOptional()
    @IsString()
    icon?: string;

    @ApiPropertyOptional({ description: "Web notification badge", example: "/badge.png" })
    @IsOptional()
    @IsString()
    badge?: string;

    @ApiPropertyOptional({ description: "Web notification image", example: "/image.jpg" })
    @IsOptional()
    @IsString()
    image?: string;

    @ApiPropertyOptional({ description: "Click action link", example: "https://example.com/chat" })
    @IsOptional()
    @IsString()
    link?: string;
}

// Send notification to single device
export class SendNotificationDto {
    @ApiProperty({ description: "FCM token of the target device", example: "fcm_token_here" })
    @IsString()
    fcmToken: string;

    @ApiPropertyOptional({ description: "Notification content", type: NotificationContent })
    @IsOptional()
    @ValidateNested()
    @Type(() => NotificationContent)
    notification?: NotificationContent;

    @ApiPropertyOptional({
        description: "Custom data payload",
        example: { userId: "123", type: "message" },
    })
    @IsOptional()
    @IsObject()
    data?: Record<string, string>;

    @ApiPropertyOptional({ description: "Android specific configuration", type: AndroidConfig })
    @IsOptional()
    @ValidateNested()
    @Type(() => AndroidConfig)
    android?: AndroidConfig;

    @ApiPropertyOptional({ description: "iOS specific configuration", type: ApnsConfig })
    @IsOptional()
    @ValidateNested()
    @Type(() => ApnsConfig)
    apns?: ApnsConfig;

    @ApiPropertyOptional({ description: "Web push configuration", type: WebPushConfig })
    @IsOptional()
    @ValidateNested()
    @Type(() => WebPushConfig)
    webpush?: WebPushConfig;
}

// Send notification to multiple devices
export class SendMultipleNotificationDto {
    @ApiProperty({
        description: "Array of FCM tokens",
        example: ["token1", "token2", "token3"],
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    fcmTokens: string[];

    @ApiPropertyOptional({ description: "Notification content", type: NotificationContent })
    @IsOptional()
    @ValidateNested()
    @Type(() => NotificationContent)
    notification?: NotificationContent;

    @ApiPropertyOptional({ description: "Custom data payload", example: { type: "announcement" } })
    @IsOptional()
    @IsObject()
    data?: Record<string, string>;

    @ApiPropertyOptional({ description: "Android specific configuration", type: AndroidConfig })
    @IsOptional()
    @ValidateNested()
    @Type(() => AndroidConfig)
    android?: AndroidConfig;

    @ApiPropertyOptional({ description: "iOS specific configuration", type: ApnsConfig })
    @IsOptional()
    @ValidateNested()
    @Type(() => ApnsConfig)
    apns?: ApnsConfig;

    @ApiPropertyOptional({ description: "Web push configuration", type: WebPushConfig })
    @IsOptional()
    @ValidateNested()
    @Type(() => WebPushConfig)
    webpush?: WebPushConfig;
}

// Send notification to topic
export class SendTopicNotificationDto {
    @ApiProperty({ description: "Topic name", example: "all_users" })
    @IsString()
    topic: string;

    @ApiPropertyOptional({ description: "Notification content", type: NotificationContent })
    @IsOptional()
    @ValidateNested()
    @Type(() => NotificationContent)
    notification?: NotificationContent;

    @ApiPropertyOptional({ description: "Custom data payload", example: { type: "announcement" } })
    @IsOptional()
    @IsObject()
    data?: Record<string, string>;

    @ApiPropertyOptional({ description: "Android specific configuration", type: AndroidConfig })
    @IsOptional()
    @ValidateNested()
    @Type(() => AndroidConfig)
    android?: AndroidConfig;

    @ApiPropertyOptional({ description: "iOS specific configuration", type: ApnsConfig })
    @IsOptional()
    @ValidateNested()
    @Type(() => ApnsConfig)
    apns?: ApnsConfig;

    @ApiPropertyOptional({ description: "Web push configuration", type: WebPushConfig })
    @IsOptional()
    @ValidateNested()
    @Type(() => WebPushConfig)
    webpush?: WebPushConfig;
}

// Subscribe/Unsubscribe to topic
export class TopicSubscriptionDto {
    @ApiProperty({
        description: "Array of FCM tokens",
        type: [String],
        example: ["token1", "token2"],
    })
    @IsArray()
    @IsString({ each: true })
    tokens: string[];

    @ApiProperty({ description: "Topic name", example: "news_updates" })
    @IsString()
    topic: string;
}

// Update FCM Token
export class UpdateFcmTokenDto {
    @ApiProperty({ description: "FCM token", example: "fcm_token_here" })
    @IsString()
    fcmToken: string;

    @ApiPropertyOptional({
        description: "Device platform",
        example: "android",
        enum: ["android", "ios", "web"],
    })
    @IsOptional()
    @IsString()
    platform?: "android" | "ios" | "web";

    @ApiPropertyOptional({ description: "Device ID", example: "device_unique_id" })
    @IsOptional()
    @IsString()
    deviceId?: string;
}

// Notification Payload (for custom notifications)
export class NotificationPayload {
    @ApiPropertyOptional({ description: "Notification object" })
    @IsOptional()
    @IsObject()
    notification?: {
        title?: string;
        body?: string;
        imageUrl?: string;
    };

    @ApiPropertyOptional({ description: "Custom data" })
    @IsOptional()
    @IsObject()
    data?: Record<string, string>;

    @ApiPropertyOptional({ description: "Android configuration" })
    @IsOptional()
    @IsObject()
    android?: any;

    @ApiPropertyOptional({ description: "APNS configuration" })
    @IsOptional()
    @IsObject()
    apns?: any;

    @ApiPropertyOptional({ description: "Web push configuration" })
    @IsOptional()
    @IsObject()
    webpush?: any;
}

// Notification template types
export enum NotificationType {
    NEW_MESSAGE = "NEW_MESSAGE",
    NEW_FOLLOWER = "NEW_FOLLOWER",
    NEW_LIKE = "NEW_LIKE",
    NEW_COMMENT = "NEW_COMMENT",
    SERVICE_REQUEST = "SERVICE_REQUEST",
    ORDER_UPDATE = "ORDER_UPDATE",
    PAYMENT_RECEIVED = "PAYMENT_RECEIVED",
    REVIEW_RECEIVED = "REVIEW_RECEIVED",
    ANNOUNCEMENT = "ANNOUNCEMENT",
    CUSTOM = "CUSTOM",
    SERVICE_REQUEST_ACCEPTED = "SERVICE_REQUEST_ACCEPTED",
    SERVICE_REQUEST_DECLINED = "SERVICE_REQUEST_DECLINED",
    SERVICE_UPDATE = "SERVICE_UPDATE",
    UPLOAD_PROOF = "UPLOAD_PROOF",
    follow = "follow",
    NEW_ORDER = "NEW_ORDER",
}

// Send templated notification
export class SendTemplatedNotificationDto {
    @ApiProperty({ description: "FCM token or array of tokens" })
    @IsString()
    fcmToken: string | string[];

    @ApiProperty({ description: "Notification type", enum: NotificationType })
    @IsString()
    type: NotificationType;

    @ApiProperty({ description: "Template data", example: { userName: "John", message: "Hello" } })
    @IsObject()
    data: Record<string, any>;
}
