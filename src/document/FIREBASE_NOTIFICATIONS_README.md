# Firebase Push Notifications - Complete Setup

## 📱 Overview

This implementation provides a complete Firebase Cloud Messaging (FCM) push notification system for the JConnect backend, including:

- ✅ Send notifications to individual users
- ✅ Send batch notifications to multiple users
- ✅ Topic-based notifications (broadcast to all users)
- ✅ Notification templates for common use cases
- ✅ User notification preferences/settings integration
- ✅ Database persistence for notification history
- ✅ Platform-specific configurations (Android, iOS, Web)
- ✅ RESTful API endpoints for client integration

## 🗂️ File Structure

```
src/
├── lib/
│   └── firebase/
│       ├── firebase.admin.provider.ts          # Firebase Admin SDK initialization
│       ├── firebase.module.ts                   # Firebase module configuration
│       ├── firebase-messaging.service.ts        # Core FCM service
│       └── dto/
│           └── notification.dto.ts              # DTOs and types
└── main/
    └── shared/
        └── notification/
            ├── firebase-notification.service.ts           # High-level notification service
            ├── firebase-notification.controller.ts        # API endpoints
            ├── notification-integration-example.service.ts # Usage examples
            └── notification.module.ts                     # Module registration
```

## 🚀 Setup Instructions

### Step 1: Firebase Console Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create a new one)
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Save the JSON file securely

### Step 2: Environment Variables

Add these variables to your `.env` file:

```env
# Firebase Cloud Messaging Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourPrivateKeyHere\n-----END PRIVATE KEY-----\n"
```

**Important:** Make sure to include the quotes around the private key and keep the `\n` characters.

### Step 3: Database Schema

The system uses the existing `fcmToken` field in the User model:

```prisma
model User {
  // ... other fields
  fcmToken String? @default("")
  // ... other fields
}
```

No additional migrations needed! ✅

### Step 4: Verify Installation

Run the application and check the logs:

```bash
npm run start:dev
```

You should see:

```
[FirebaseModule] Firebase Admin SDK initialized successfully
```

## 📡 API Endpoints

### 1. Update FCM Token

**Endpoint:** `POST /firebase-notifications/update-fcm-token`

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Body:**

```json
{
    "fcmToken": "your-device-fcm-token",
    "platform": "android",
    "deviceId": "unique-device-id"
}
```

**Response:**

```json
{
    "success": true,
    "message": "FCM token updated successfully"
}
```

### 2. Subscribe to Topic

**Endpoint:** `POST /firebase-notifications/subscribe-topic`

**Body:**

```json
{
    "topic": "announcements"
}
```

### 3. Unsubscribe from Topic

**Endpoint:** `POST /firebase-notifications/unsubscribe-topic`

**Body:**

```json
{
    "topic": "announcements"
}
```

### 4. Test Notification

**Endpoint:** `POST /firebase-notifications/test/:userId`

Sends a test notification to the specified user.

## 💻 Backend Integration Examples

### Example 1: Send Notification on New Message

```typescript
import { FirebaseNotificationService } from "./firebase-notification.service";
import { NotificationType } from "src/lib/firebase/dto/notification.dto";

@Injectable()
export class MessageService {
    constructor(private readonly firebaseNotificationService: FirebaseNotificationService) {}

    async sendMessage(senderId: string, receiverId: string, message: string) {
        // Save message to database
        const savedMessage = await this.saveMessage(senderId, receiverId, message);

        // Get sender info
        const sender = await this.getUser(senderId);

        // Build notification
        const notification = this.firebaseNotificationService.buildNotificationTemplate(
            NotificationType.NEW_MESSAGE,
            {
                senderName: sender.full_name,
                senderId: senderId,
                messagePreview: message.substring(0, 100),
                conversationId: savedMessage.conversationId,
            },
        );

        // Send FCM notification
        await this.firebaseNotificationService.sendToUser(
            receiverId,
            notification,
            true, // Save to database
        );

        return savedMessage;
    }
}
```

### Example 2: Send Notification on New Follower

```typescript
async followUser(followerId: string, followeeId: string) {
  // Create follow relationship
  await this.createFollow(followerId, followeeId);

  // Get follower info
  const follower = await this.getUser(followerId);

  // Send notification
  const notification = this.firebaseNotificationService.buildNotificationTemplate(
    NotificationType.NEW_FOLLOWER,
    {
      followerName: follower.full_name,
      followerId: followerId,
    },
  );

  await this.firebaseNotificationService.sendToUser(followeeId, notification);
}
```

### Example 3: Send Announcement to Multiple Users

```typescript
async sendAnnouncement(userIds: string[], title: string, message: string) {
  const notification = this.firebaseNotificationService.buildNotificationTemplate(
    NotificationType.ANNOUNCEMENT,
    {
      title: title,
      message: message,
      announcementId: 'announcement-id',
    },
  );

  const result = await this.firebaseNotificationService.sendToMultipleUsers(
    userIds,
    notification,
    true
  );

  return {
    sent: result.successCount,
    failed: result.failureCount,
  };
}
```

## 📱 Mobile App Integration

### React Native (using @react-native-firebase/messaging)

#### 1. Install Dependencies

```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
```

#### 2. Request Permission & Get Token

```javascript
import messaging from "@react-native-firebase/messaging";

async function requestUserPermission() {
    const authStatus = await messaging().requestPermission();
    const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
        const token = await messaging().getToken();

        // Send token to backend
        await fetch("https://your-api.com/firebase-notifications/update-fcm-token", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${userJwtToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                fcmToken: token,
                platform: Platform.OS,
            }),
        });
    }
}
```

#### 3. Handle Notifications

```javascript
import { useEffect } from "react";
import messaging from "@react-native-firebase/messaging";

function App() {
    useEffect(() => {
        // Handle foreground notifications
        const unsubscribe = messaging().onMessage(async (remoteMessage) => {
            console.log("Notification in foreground:", remoteMessage);
            // Show local notification or update UI
        });

        // Handle notification tap when app is in background
        messaging().onNotificationOpenedApp((remoteMessage) => {
            console.log("Notification opened from background:", remoteMessage);
            // Navigate to relevant screen
            navigation.navigate("Chat", {
                conversationId: remoteMessage.data.conversationId,
            });
        });

        // Handle notification tap when app was killed
        messaging()
            .getInitialNotification()
            .then((remoteMessage) => {
                if (remoteMessage) {
                    console.log("Notification opened from killed state:", remoteMessage);
                    // Navigate to relevant screen
                }
            });

        return unsubscribe;
    }, []);

    return <YourApp />;
}
```

#### 4. Handle Token Refresh

```javascript
useEffect(() => {
    const unsubscribe = messaging().onTokenRefresh((token) => {
        // Update token on backend
        updateFcmToken(token);
    });

    return unsubscribe;
}, []);
```

### Flutter (using firebase_messaging)

#### 1. Add Dependencies

```yaml
# pubspec.yaml
dependencies:
    firebase_core: ^2.24.0
    firebase_messaging: ^14.7.0
```

#### 2. Initialize & Get Token

```dart
import 'package:firebase_messaging/firebase_messaging.dart';

Future<void> initializeFirebase() async {
  await Firebase.initializeApp();

  // Request permission
  NotificationSettings settings = await FirebaseMessaging.instance.requestPermission();

  if (settings.authorizationStatus == AuthorizationStatus.authorized) {
    // Get token
    String? token = await FirebaseMessaging.instance.getToken();

    if (token != null) {
      // Send to backend
      await updateFcmToken(token);
    }
  }
}
```

#### 3. Handle Notifications

```dart
void setupNotificationHandlers() {
  // Foreground notifications
  FirebaseMessaging.onMessage.listen((RemoteMessage message) {
    print('Got a message in foreground: ${message.notification?.title}');
    // Show local notification
  });

  // Background notification tap
  FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
    print('Notification tapped: ${message.data}');
    // Navigate to screen
    Navigator.pushNamed(context, '/chat', arguments: message.data);
  });

  // Handle notification when app is terminated
  FirebaseMessaging.instance.getInitialMessage().then((RemoteMessage? message) {
    if (message != null) {
      // Handle navigation
    }
  });
}
```

## 🔔 Notification Types

The system supports the following notification types:

| Type               | Description              | Use Case                 |
| ------------------ | ------------------------ | ------------------------ |
| `NEW_MESSAGE`      | New chat message         | Messaging system         |
| `NEW_FOLLOWER`     | New follower             | Social features          |
| `NEW_LIKE`         | Content liked            | Posts/content engagement |
| `NEW_COMMENT`      | New comment              | Posts/content engagement |
| `SERVICE_REQUEST`  | Service request received | Service marketplace      |
| `ORDER_UPDATE`     | Order status changed     | Order management         |
| `PAYMENT_RECEIVED` | Payment received         | Payments                 |
| `REVIEW_RECEIVED`  | New review               | Reviews/ratings          |
| `ANNOUNCEMENT`     | System announcement      | Admin announcements      |
| `CUSTOM`           | Custom notification      | Any other use case       |

## ⚙️ Notification Settings

Users can control notifications via the existing settings endpoint:

```
GET  /notification-setting
PATCH /notification-setting
```

The Firebase notification service automatically respects these settings before sending notifications.

## 🧪 Testing

### 1. Test with Postman

Use the `/firebase-notifications/test/:userId` endpoint to send a test notification.

### 2. Test with cURL

```bash
curl -X POST https://your-api.com/firebase-notifications/test/user-id \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Monitor in Firebase Console

Go to Firebase Console → Cloud Messaging → Send test message

## 🐛 Troubleshooting

### Issue: Notifications not received

**Solutions:**

- ✅ Check if FCM token is saved in database
- ✅ Verify Firebase credentials in `.env`
- ✅ Check user's notification settings
- ✅ Ensure device has internet connection
- ✅ Check app has notification permissions

### Issue: Invalid FCM token

**Solutions:**

- ✅ Token expires when app is uninstalled
- ✅ Implement token refresh logic on client
- ✅ Use `verifyToken()` method to check validity

### Issue: Firebase Admin SDK error

**Solutions:**

- ✅ Check `.env` variables are correct
- ✅ Ensure private key format is correct (with `\n`)
- ✅ Verify service account has Cloud Messaging permissions

## 📊 Best Practices

1. **Always update FCM token on login**
2. **Handle token refresh on client side**
3. **Respect user notification preferences**
4. **Use appropriate notification types**
5. **Include deep link data for navigation**
6. **Keep notification messages concise**
7. **Test on real devices, not just emulators**
8. **Monitor delivery rates in Firebase Console**
9. **Implement error handling for failed notifications**
10. **Clean up invalid tokens periodically**

## 📝 Additional Resources

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [React Native Firebase](https://rnfirebase.io/)
- [Flutter Firebase Messaging](https://firebase.flutter.dev/docs/messaging/overview)

## 🎉 Summary

You now have a fully functional Firebase push notification system integrated into your JConnect backend! The system includes:

✅ Complete backend implementation
✅ RESTful API endpoints
✅ Notification templates
✅ User preferences integration
✅ Database persistence
✅ Mobile integration examples
✅ Comprehensive documentation

Start sending notifications by integrating the service into your existing features! 🚀
