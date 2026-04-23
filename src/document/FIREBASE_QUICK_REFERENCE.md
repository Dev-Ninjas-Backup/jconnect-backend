# 🔥 Firebase Notifications - Quick Reference

## 🚀 Quick Start (5 Minutes)

### 1. Add Environment Variables

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-email@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourKey\n-----END PRIVATE KEY-----\n"
```

### 2. Inject Service

```typescript
import { FirebaseNotificationService } from "./firebase-notification.service";

@Injectable()
export class YourService {
    constructor(private readonly firebaseNotificationService: FirebaseNotificationService) {}
}
```

### 3. Send Notification

```typescript
const notification = this.firebaseNotificationService.buildNotificationTemplate(
    NotificationType.NEW_MESSAGE,
    { senderName: "John", messagePreview: "Hello!" },
);

await this.firebaseNotificationService.sendToUser(userId, notification);
```

---

## 📡 API Endpoints

```bash
# Update FCM Token
POST /firebase-notifications/update-fcm-token
Body: { "fcmToken": "token" }

# Subscribe to Topic
POST /firebase-notifications/subscribe-topic
Body: { "topic": "announcements" }

# Unsubscribe from Topic
POST /firebase-notifications/unsubscribe-topic
Body: { "topic": "announcements" }

# Test Notification
POST /firebase-notifications/test/:userId
```

---

## 🔔 Notification Types & Templates

### NEW_MESSAGE

```typescript
buildNotificationTemplate(NotificationType.NEW_MESSAGE, {
    senderName: string,
    senderId: string,
    messagePreview: string,
    conversationId: string,
});
```

### NEW_FOLLOWER

```typescript
buildNotificationTemplate(NotificationType.NEW_FOLLOWER, {
    followerName: string,
    followerId: string,
});
```

### NEW_LIKE

```typescript
buildNotificationTemplate(NotificationType.NEW_LIKE, {
    userName: string,
    userId: string,
    contentId: string,
    contentType: string,
});
```

### NEW_COMMENT

```typescript
buildNotificationTemplate(NotificationType.NEW_COMMENT, {
    userName: string,
    userId: string,
    contentId: string,
    commentId: string,
    contentType: string,
    commentPreview: string,
});
```

### SERVICE_REQUEST

```typescript
buildNotificationTemplate(NotificationType.SERVICE_REQUEST, {
    clientName: string,
    serviceName: string,
    requestId: string,
    serviceId: string,
});
```

### ORDER_UPDATE

```typescript
buildNotificationTemplate(NotificationType.ORDER_UPDATE, {
    orderId: string,
    status: string,
});
```

### PAYMENT_RECEIVED

```typescript
buildNotificationTemplate(NotificationType.PAYMENT_RECEIVED, {
    paymentId: string,
    amount: number,
    payerName: string,
});
```

### REVIEW_RECEIVED

```typescript
buildNotificationTemplate(NotificationType.REVIEW_RECEIVED, {
    reviewId: string,
    reviewerName: string,
    rating: number,
});
```

### ANNOUNCEMENT

```typescript
buildNotificationTemplate(NotificationType.ANNOUNCEMENT, {
    title: string,
    message: string,
    announcementId: string,
});
```

### CUSTOM

```typescript
buildNotificationTemplate(NotificationType.CUSTOM, {
    title: string,
    body: string,
    data: Record<string, any>,
});
```

---

## 💻 Common Usage Patterns

### Send to Single User

```typescript
await this.firebaseNotificationService.sendToUser(
    userId,
    notification,
    true, // save to database
);
```

### Send to Multiple Users

```typescript
const result = await this.firebaseNotificationService.sendToMultipleUsers(
    [userId1, userId2, userId3],
    notification,
    true,
);
```

### Send to Topic (All Users)

```typescript
await this.firebaseNotificationService.sendToTopic("all_users", notification);
```

### Update FCM Token

```typescript
await this.firebaseNotificationService.updateFcmToken(userId, "new-fcm-token");
```

### Subscribe to Topic

```typescript
await this.firebaseNotificationService.subscribeUserToTopic(userId, "announcements");
```

---

## 📱 Mobile Integration

### React Native

#### Install

```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
```

#### Get Token

```javascript
import messaging from "@react-native-firebase/messaging";

const token = await messaging().getToken();
```

#### Update Backend

```javascript
await api.post("/firebase-notifications/update-fcm-token", {
    fcmToken: token,
    platform: Platform.OS,
});
```

#### Handle Notifications

```javascript
// Foreground
messaging().onMessage(async (remoteMessage) => {
    console.log("Notification:", remoteMessage);
});

// Background tap
messaging().onNotificationOpenedApp((remoteMessage) => {
    // Navigate
});

// App was killed
messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
        // Navigate
    });
```

### Flutter

#### Install

```yaml
dependencies:
    firebase_core: ^2.24.0
    firebase_messaging: ^14.7.0
```

#### Get Token

```dart
String? token = await FirebaseMessaging.instance.getToken();
```

#### Update Backend

```dart
await api.post('/firebase-notifications/update-fcm-token', {
  'fcmToken': token,
  'platform': Platform.operatingSystem,
});
```

#### Handle Notifications

```dart
// Foreground
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  print('Notification: ${message.notification?.title}');
});

// Background tap
FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
  // Navigate
});

// App was killed
FirebaseMessaging.instance.getInitialMessage().then((message) {
  // Navigate
});
```

---

## 🔧 Platform-Specific Config

### Android

```typescript
android: {
  priority: 'high',
  sound: 'default',
  channelId: 'default_channel',
  icon: 'ic_notification',
  color: '#FF0000',
}
```

### iOS

```typescript
apns: {
  sound: 'default',
  badge: 1,
  contentAvailable: true,
  category: 'MESSAGE_CATEGORY',
}
```

### Web

```typescript
webpush: {
  title: 'Title',
  body: 'Body',
  icon: '/icon.png',
  link: 'https://example.com',
}
```

---

## 🎯 Integration Examples

### Message Service

```typescript
async sendMessage(senderId: string, receiverId: string, message: string) {
  const savedMessage = await this.saveMessage(senderId, receiverId, message);

  const sender = await this.getUser(senderId);
  const notification = this.firebaseNotificationService.buildNotificationTemplate(
    NotificationType.NEW_MESSAGE,
    {
      senderName: sender.full_name,
      senderId,
      messagePreview: message.substring(0, 100),
      conversationId: savedMessage.conversationId,
    }
  );

  await this.firebaseNotificationService.sendToUser(receiverId, notification);
}
```

### Follow Service

```typescript
async followUser(followerId: string, followeeId: string) {
  await this.createFollow(followerId, followeeId);

  const follower = await this.getUser(followerId);
  const notification = this.firebaseNotificationService.buildNotificationTemplate(
    NotificationType.NEW_FOLLOWER,
    { followerName: follower.full_name, followerId }
  );

  await this.firebaseNotificationService.sendToUser(followeeId, notification);
}
```

### Order Service

```typescript
async updateOrderStatus(orderId: string, newStatus: string) {
  const order = await this.updateOrder(orderId, newStatus);

  const notification = this.firebaseNotificationService.buildNotificationTemplate(
    NotificationType.ORDER_UPDATE,
    { orderId, status: newStatus }
  );

  await this.firebaseNotificationService.sendToUser(order.buyerId, notification);
}
```

---

## 🐛 Quick Troubleshooting

### Notifications Not Received

```bash
# Check FCM token
SELECT fcmToken FROM "User" WHERE id = 'user-id';

# Check notification settings
SELECT * FROM "notification-toggle" WHERE userId = 'user-id';

# Test notification
curl -X POST http://localhost:3000/firebase-notifications/test/user-id \
  -H "Authorization: Bearer token"
```

### TypeScript Errors

```bash
npx prisma generate
# Restart TS server in VS Code
```

### Firebase Initialization Failed

```bash
# Check .env variables
echo $FIREBASE_PROJECT_ID
echo $FIREBASE_CLIENT_EMAIL

# Verify private key format (should have \n)
```

---

## 📚 Documentation Files

1. **FIREBASE_NOTIFICATIONS_README.md** - Complete setup guide
2. **FIREBASE_NOTIFICATION_INTEGRATION.md** - Backend integration
3. **FIREBASE_IMPLEMENTATION_SUMMARY.md** - What's included
4. **FIREBASE_SETUP_CHECKLIST.md** - Step-by-step checklist
5. **notification-integration-example.service.ts** - Code examples

---

## ✅ Quick Checklist

- [ ] Add Firebase credentials to `.env`
- [ ] Restart server
- [ ] Update login to save FCM tokens
- [ ] Integrate into chat/messaging
- [ ] Integrate into social features
- [ ] Integrate into orders/services
- [ ] Test on real devices
- [ ] Monitor Firebase Console

---

## 🎉 That's It!

You're ready to send push notifications! 🚀

For detailed information, see the full documentation files.
