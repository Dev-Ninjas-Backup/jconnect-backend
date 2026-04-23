# Firebase Notification Integration Guide

## Overview

This guide shows how to integrate Firebase Cloud Messaging (FCM) notifications into your existing JConnect backend services.

## Setup

### 1. Environment Variables

Add these to your `.env` file:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourPrivateKey\n-----END PRIVATE KEY-----\n"
```

### 2. Service Integration

The `FirebaseNotificationService` is now available globally. Inject it into any service:

```typescript
import { Injectable } from "@nestjs/common";
import { FirebaseNotificationService } from "src/main/shared/notification/firebase-notification.service";
import { NotificationType } from "src/lib/firebase/dto/notification.dto";

@Injectable()
export class YourService {
    constructor(private readonly firebaseNotificationService: FirebaseNotificationService) {}

    async someMethod() {
        // Your logic here
    }
}
```

## Usage Examples

### 1. Send Notification When User Receives a Message

```typescript
// In your message service
async sendMessage(senderId: string, receiverId: string, message: string) {
  // Save message to database
  const savedMessage = await this.prisma.message.create({
    data: { senderId, receiverId, content: message }
  });

  // Get sender info
  const sender = await this.prisma.user.findUnique({
    where: { id: senderId },
    select: { full_name: true }
  });

  // Build notification template
  const notification = this.firebaseNotificationService.buildNotificationTemplate(
    NotificationType.NEW_MESSAGE,
    {
      senderName: sender.full_name,
      senderId: senderId,
      messagePreview: message.substring(0, 50),
      conversationId: savedMessage.conversationId,
    }
  );

  // Send Firebase notification
  await this.firebaseNotificationService.sendToUser(
    receiverId,
    notification,
    true // Save to database
  );

  return savedMessage;
}
```

### 2. Send Notification When User Gets a New Follower

```typescript
async followUser(followerId: string, followeeId: string) {
  // Create follow relationship
  await this.prisma.follower.create({
    data: { followerId, followeeId }
  });

  // Get follower info
  const follower = await this.prisma.user.findUnique({
    where: { id: followerId },
    select: { full_name: true }
  });

  // Send notification
  const notification = this.firebaseNotificationService.buildNotificationTemplate(
    NotificationType.NEW_FOLLOWER,
    {
      followerName: follower.full_name,
      followerId: followerId,
    }
  );

  await this.firebaseNotificationService.sendToUser(followeeId, notification);
}
```

### 3. Send Notification for Service Request

```typescript
async createServiceRequest(clientId: string, providerId: string, serviceId: string) {
  // Create service request
  const request = await this.prisma.serviceRequest.create({
    data: { clientId, providerId, serviceId }
  });

  // Get client and service info
  const [client, service] = await Promise.all([
    this.prisma.user.findUnique({ where: { id: clientId } }),
    this.prisma.service.findUnique({ where: { id: serviceId } }),
  ]);

  // Send notification to service provider
  const notification = this.firebaseNotificationService.buildNotificationTemplate(
    NotificationType.SERVICE_REQUEST,
    {
      clientName: client.full_name,
      serviceName: service.title,
      requestId: request.id,
      serviceId: serviceId,
    }
  );

  await this.firebaseNotificationService.sendToUser(providerId, notification);
}
```

### 4. Send Notification for Order Update

```typescript
async updateOrderStatus(orderId: string, newStatus: string) {
  // Update order
  const order = await this.prisma.order.update({
    where: { id: orderId },
    data: { status: newStatus },
    include: { buyer: true }
  });

  // Send notification to buyer
  const notification = this.firebaseNotificationService.buildNotificationTemplate(
    NotificationType.ORDER_UPDATE,
    {
      orderId: orderId,
      status: newStatus,
    }
  );

  await this.firebaseNotificationService.sendToUser(order.buyer.id, notification);
}
```

### 5. Send Notification for Payment Received

```typescript
async processPayment(paymentData: any) {
  // Process payment
  const payment = await this.prisma.payment.create({
    data: paymentData
  });

  // Get payer info
  const payer = await this.prisma.user.findUnique({
    where: { id: payment.payerId }
  });

  // Send notification to receiver
  const notification = this.firebaseNotificationService.buildNotificationTemplate(
    NotificationType.PAYMENT_RECEIVED,
    {
      paymentId: payment.id,
      amount: payment.amount,
      payerName: payer.full_name,
    }
  );

  await this.firebaseNotificationService.sendToUser(
    payment.receiverId,
    notification
  );
}
```

### 6. Send Notification for New Review

```typescript
async createReview(reviewData: any) {
  // Create review
  const review = await this.prisma.review.create({
    data: reviewData,
    include: { reviewer: true }
  });

  // Send notification to reviewed user
  const notification = this.firebaseNotificationService.buildNotificationTemplate(
    NotificationType.REVIEW_RECEIVED,
    {
      reviewId: review.id,
      reviewerName: review.reviewer.full_name,
      rating: review.rating,
    }
  );

  await this.firebaseNotificationService.sendToUser(
    review.reviewedUserId,
    notification
  );
}
```

### 7. Send Notification to Multiple Users

```typescript
async sendAnnouncementToUsers(userIds: string[], announcement: any) {
  const notification = this.firebaseNotificationService.buildNotificationTemplate(
    NotificationType.ANNOUNCEMENT,
    {
      title: announcement.title,
      message: announcement.message,
      announcementId: announcement.id,
    }
  );

  const result = await this.firebaseNotificationService.sendToMultipleUsers(
    userIds,
    notification,
    true
  );

  return {
    success: result.successCount > 0,
    sent: result.successCount,
    failed: result.failureCount,
  };
}
```

### 8. Send Notification to Topic (All Users)

```typescript
async sendGlobalAnnouncement(announcement: any) {
  const notification = this.firebaseNotificationService.buildNotificationTemplate(
    NotificationType.ANNOUNCEMENT,
    {
      title: announcement.title,
      message: announcement.message,
      announcementId: announcement.id,
    }
  );

  // Send to all users subscribed to "all_users" topic
  await this.firebaseNotificationService.sendToTopic(
    'all_users',
    notification
  );
}
```

### 9. Update User's FCM Token (On Login)

```typescript
async login(loginDto: LoginDto) {
  // Your existing login logic
  const user = await this.authenticateUser(loginDto);

  // Update FCM token if provided
  if (loginDto.fcmToken) {
    await this.firebaseNotificationService.updateFcmToken(
      user.id,
      loginDto.fcmToken
    );
  }

  return { token: this.generateJwt(user), user };
}
```

### 10. Send Custom Notification

```typescript
async sendCustomNotification(userId: string, title: string, body: string, data: any) {
  const notification = this.firebaseNotificationService.buildNotificationTemplate(
    NotificationType.CUSTOM,
    {
      title: title,
      body: body,
      data: data,
    }
  );

  return await this.firebaseNotificationService.sendToUser(userId, notification);
}
```

## Available Notification Types

```typescript
enum NotificationType {
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
}
```

## API Endpoints

The following endpoints are available for mobile/web clients:

### Update FCM Token

```
POST /firebase-notifications/update-fcm-token
Authorization: Bearer <token>

Body:
{
  "fcmToken": "your-fcm-token",
  "platform": "android", // optional: "android" | "ios" | "web"
  "deviceId": "device-unique-id" // optional
}
```

### Subscribe to Topic

```
POST /firebase-notifications/subscribe-topic
Authorization: Bearer <token>

Body:
{
  "topic": "news_updates"
}
```

### Unsubscribe from Topic

```
POST /firebase-notifications/unsubscribe-topic
Authorization: Bearer <token>

Body:
{
  "topic": "news_updates"
}
```

### Test Notification

```
POST /firebase-notifications/test/:userId
Authorization: Bearer <token>
```

## Notification Settings

Users can control which types of notifications they receive through the existing notification toggle settings:

```
GET /notification-setting
PATCH /notification-setting

Body:
{
  "email": true,
  "message": true,
  "userUpdates": true,
  "serviceCreate": true,
  "review": true,
  "post": true
}
```

The Firebase notification service automatically checks these settings before sending notifications.

## Best Practices

1. **Always check notification settings** - The service does this automatically
2. **Use appropriate notification types** - This helps with analytics and user preferences
3. **Keep notification messages concise** - Mobile notifications have character limits
4. **Include relevant data** - Add IDs and context for deep linking
5. **Handle errors gracefully** - FCM tokens can become invalid
6. **Test on real devices** - Emulators may not always work correctly

## Troubleshooting

### FCM Token Not Working

- Ensure Firebase credentials are correct in `.env`
- Verify the token is not expired
- Check if the user has uninstalled/reinstalled the app

### Notifications Not Received

- Check user's notification settings
- Verify the device is connected to the internet
- Ensure the app has notification permissions
- Check Firebase Console for delivery reports

### Invalid Token Errors

- Tokens expire when:
    - User uninstalls the app
    - User clears app data
    - Token refresh by Firebase
- Implement token refresh logic on the client side

## Frontend Integration (React Native / Flutter)

### Getting FCM Token

```javascript
// React Native with @react-native-firebase/messaging
import messaging from "@react-native-firebase/messaging";

async function requestUserPermission() {
    const authStatus = await messaging().requestPermission();
    const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
        const fcmToken = await messaging().getToken();
        // Send this token to your backend
        await updateFcmToken(fcmToken);
    }
}
```

### Handling Notifications

```javascript
// Listen for foreground notifications
messaging().onMessage(async (remoteMessage) => {
    console.log("Notification received in foreground:", remoteMessage);
    // Show local notification or update UI
});

// Handle notification tap when app is in background
messaging().onNotificationOpenedApp((remoteMessage) => {
    console.log("Notification opened app from background:", remoteMessage);
    // Navigate to relevant screen
});

// Handle notification tap when app was killed
messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
        if (remoteMessage) {
            console.log("Notification opened app from killed state:", remoteMessage);
            // Navigate to relevant screen
        }
    });
```

## Monitoring and Analytics

Monitor notification delivery in:

1. Firebase Console > Cloud Messaging
2. Your backend logs (FirebaseNotificationService)
3. Application logs on the client side

## Next Steps

1. Add Firebase credentials to your `.env` file
2. Integrate notification sending in your existing services
3. Test with real devices
4. Monitor delivery rates
5. Add analytics for notification engagement
