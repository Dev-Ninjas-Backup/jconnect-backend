# 🏗️ Firebase Notification System Architecture

## 📊 System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        JConnect Backend                              │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Application Layer                          │   │
│  │                                                               │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │   │
│  │  │   Message    │  │   Order      │  │   Social     │      │   │
│  │  │   Service    │  │   Service    │  │   Service    │      │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │   │
│  │         │                  │                  │              │   │
│  │         └──────────────────┼──────────────────┘              │   │
│  │                            │                                 │   │
│  └────────────────────────────┼─────────────────────────────────┘   │
│                               │                                      │
│  ┌────────────────────────────▼─────────────────────────────────┐   │
│  │          FirebaseNotificationService                         │   │
│  │  ┌────────────────────────────────────────────────────────┐ │   │
│  │  │  • buildNotificationTemplate()                          │ │   │
│  │  │  • sendToUser()                                         │ │   │
│  │  │  • sendToMultipleUsers()                                │ │   │
│  │  │  • sendToTopic()                                        │ │   │
│  │  │  • checkNotificationSettings()                          │ │   │
│  │  │  • saveNotificationToDb()                               │ │   │
│  │  └────────────────────────────────────────────────────────┘ │   │
│  └────────────────────────────┬─────────────────────────────────┘   │
│                               │                                      │
│  ┌────────────────────────────▼─────────────────────────────────┐   │
│  │          FirebaseMessagingService                            │   │
│  │  ┌────────────────────────────────────────────────────────┐ │   │
│  │  │  • sendToDevice()                                       │ │   │
│  │  │  • sendToMultipleDevices()                              │ │   │
│  │  │  • sendToTopic()                                        │ │   │
│  │  │  • subscribeToTopic()                                   │ │   │
│  │  │  • unsubscribeFromTopic()                               │ │   │
│  │  │  • verifyToken()                                        │ │   │
│  │  └────────────────────────────────────────────────────────┘ │   │
│  └────────────────────────────┬─────────────────────────────────┘   │
│                               │                                      │
│  ┌────────────────────────────▼─────────────────────────────────┐   │
│  │              Firebase Admin SDK                              │   │
│  │  ┌────────────────────────────────────────────────────────┐ │   │
│  │  │  Firebase Admin Initialized with Service Account       │ │   │
│  │  │  • messaging().send()                                   │ │   │
│  │  │  • messaging().sendEachForMulticast()                   │ │   │
│  │  └────────────────────────────────────────────────────────┘ │   │
│  └────────────────────────────┬─────────────────────────────────┘   │
│                               │                                      │
└───────────────────────────────┼──────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Firebase Cloud      │
                    │   Messaging (FCM)     │
                    └───────────┬───────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                ▼               ▼               ▼
          ┌─────────┐     ┌─────────┐     ┌─────────┐
          │ Android │     │   iOS   │     │   Web   │
          │ Device  │     │ Device  │     │ Browser │
          └─────────┘     └─────────┘     └─────────┘
```

## 🔄 Notification Flow

### 1. Send Notification Flow

```
User Action → Service → FirebaseNotificationService → FirebaseMessagingService → FCM → Device

Example: Sending a message

1. User sends message
   ↓
2. MessageService.sendMessage()
   ↓
3. Save message to database
   ↓
4. FirebaseNotificationService.buildNotificationTemplate()
   ↓
5. Check user notification settings
   ↓
6. FirebaseMessagingService.sendToDevice()
   ↓
7. Firebase Admin SDK messaging().send()
   ↓
8. Firebase Cloud Messaging
   ↓
9. Device receives notification
   ↓
10. Save notification to database
```

### 2. Token Update Flow

```
App Launch → Get FCM Token → API Call → Update Database

1. App launches
   ↓
2. Request notification permissions
   ↓
3. Get FCM token from Firebase SDK
   ↓
4. POST /firebase-notifications/update-fcm-token
   ↓
5. FirebaseNotificationService.updateFcmToken()
   ↓
6. Update user.fcmToken in database
```

### 3. Topic Subscription Flow

```
User Action → API Call → Firebase SDK → Topic Subscription

1. User subscribes to topic
   ↓
2. POST /firebase-notifications/subscribe-topic
   ↓
3. FirebaseNotificationService.subscribeUserToTopic()
   ↓
4. Get user FCM token from database
   ↓
5. FirebaseMessagingService.subscribeToTopic()
   ↓
6. Firebase Admin SDK messaging().subscribeToTopic()
```

## 📦 Module Structure

```
src/
├── lib/
│   └── firebase/
│       ├── firebase.admin.provider.ts       [Provider]
│       │   • Initializes Firebase Admin SDK
│       │   • Manages credentials
│       │
│       ├── firebase.module.ts               [Module]
│       │   • Exports Firebase providers
│       │   • Global module
│       │
│       ├── firebase-messaging.service.ts    [Service]
│       │   • Low-level FCM operations
│       │   • Direct Firebase SDK calls
│       │
│       └── dto/
│           └── notification.dto.ts          [DTOs]
│               • Validation classes
│               • Type definitions
│
└── main/
    └── shared/
        └── notification/
            ├── notification.module.ts                    [Module]
            │   • Imports Firebase module
            │   • Provides services
            │
            ├── firebase-notification.service.ts         [Service]
            │   • Business logic layer
            │   • Template building
            │   • Settings integration
            │   • Database operations
            │
            ├── firebase-notification.controller.ts      [Controller]
            │   • API endpoints
            │   • Request validation
            │
            └── notification-integration-example.service.ts [Examples]
                • Usage patterns
                • Integration samples
```

## 🔌 API Layer

```
┌─────────────────────────────────────────────────────────────┐
│                    REST API Endpoints                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  POST /firebase-notifications/update-fcm-token              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Authorization: Bearer <token>                         │   │
│  │ Body: { fcmToken, platform, deviceId }               │   │
│  │ → Update user's FCM token in database                │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  POST /firebase-notifications/subscribe-topic               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Body: { topic }                                       │   │
│  │ → Subscribe user's device to FCM topic               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  POST /firebase-notifications/unsubscribe-topic             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Body: { topic }                                       │   │
│  │ → Unsubscribe user's device from FCM topic           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  POST /firebase-notifications/test/:userId                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ → Send test notification to user                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 💾 Database Schema

```
┌─────────────────────────────────────────────────────────────┐
│                          User                                │
├─────────────────────────────────────────────────────────────┤
│ id: String                                                   │
│ email: String                                                │
│ full_name: String                                            │
│ fcmToken: String?          ← FCM token stored here          │
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ 1:1
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   NotificationToggle                         │
├─────────────────────────────────────────────────────────────┤
│ id: String                                                   │
│ userId: String                                               │
│ email: Boolean                                               │
│ message: Boolean         ← Notification preferences         │
│ userUpdates: Boolean                                         │
│ serviceCreate: Boolean                                       │
│ review: Boolean                                              │
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ 1:N
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      Notification                            │
├─────────────────────────────────────────────────────────────┤
│ id: String                                                   │
│ title: String                                                │
│ message: String                                              │
│ metadata: JSON           ← Notification content             │
│ createdAt: DateTime                                          │
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ 1:N
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   UserNotification                           │
├─────────────────────────────────────────────────────────────┤
│ id: String                                                   │
│ userId: String                                               │
│ notificationId: String                                       │
│ type: NotificationType   ← Link to notification type        │
│ read: Boolean                                                │
│ createdAt: DateTime                                          │
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Notification Types Hierarchy

```
NotificationType (Enum)
├── NEW_MESSAGE          → Chat/Messaging notifications
├── NEW_FOLLOWER         → Social interaction
├── NEW_LIKE             → Content engagement
├── NEW_COMMENT          → Content engagement
├── SERVICE_REQUEST      → Business transactions
├── ORDER_UPDATE         → Order management
├── PAYMENT_RECEIVED     → Payment events
├── REVIEW_RECEIVED      → Review system
├── ANNOUNCEMENT         → System announcements
└── CUSTOM               → Custom notifications
```

## 🔐 Security & Settings Flow

```
Notification Request
        │
        ▼
┌─────────────────────┐
│ Check User Settings │
└─────────┬───────────┘
          │
          ▼
    ┌─────────┐
    │ Enabled?│
    └────┬────┘
         │
    ┌────┴────┐
    │         │
   Yes       No
    │         │
    ▼         ▼
  Send     Cancel
```

## 📊 Data Flow Diagram

```
┌──────────────┐
│ Client App   │
└──────┬───────┘
       │ 1. Get FCM Token
       │
       ▼
┌──────────────────┐
│ Firebase SDK     │
└──────┬───────────┘
       │ 2. Return Token
       │
       ▼
┌──────────────────┐      3. Update Token
│ Backend API      │◄─────────────────────
└──────┬───────────┘
       │ 4. Save to DB
       │
       ▼
┌──────────────────┐
│ PostgreSQL       │
└──────────────────┘

[Later when event occurs]

┌──────────────────┐
│ Event Trigger    │ (e.g., New Message)
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Service Layer    │
└──────┬───────────┘
       │ Build Notification
       │
       ▼
┌──────────────────┐
│ Check Settings   │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Send via FCM     │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Save to DB       │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Client Receives  │
└──────────────────┘
```

## 🚀 Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Production                            │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │           Load Balancer                        │    │
│  └───────────────────┬────────────────────────────┘    │
│                      │                                  │
│          ┌───────────┴───────────┐                      │
│          │                       │                      │
│  ┌───────▼──────┐        ┌──────▼───────┐              │
│  │  App Server  │        │  App Server  │              │
│  │     (1)      │        │     (2)      │              │
│  └───────┬──────┘        └──────┬───────┘              │
│          │                      │                       │
│          └──────────┬───────────┘                       │
│                     │                                   │
│          ┌──────────▼──────────┐                        │
│          │   PostgreSQL DB     │                        │
│          │   (with fcmToken)   │                        │
│          └──────────┬──────────┘                        │
│                     │                                   │
└─────────────────────┼───────────────────────────────────┘
                      │
                      │ Firebase Admin SDK
                      │
                      ▼
           ┌────────────────────┐
           │  Firebase Cloud    │
           │   Messaging API    │
           └────────────────────┘
```

## 🔄 Complete Lifecycle

```
1. App Installation
   ↓
2. User Login
   ↓
3. Get FCM Token
   ↓
4. Send Token to Backend
   ↓
5. Store in Database
   ↓
[User uses app normally]
   ↓
6. Event Occurs (e.g., new message)
   ↓
7. Backend Service Triggered
   ↓
8. Build Notification Template
   ↓
9. Check User Settings
   ↓
10. Retrieve FCM Token from DB
   ↓
11. Send to Firebase Admin SDK
   ↓
12. Firebase Processes Request
   ↓
13. FCM Delivers to Device
   ↓
14. Save Notification to DB
   ↓
15. User Sees Notification
   ↓
16. User Taps Notification
   ↓
17. App Opens Relevant Screen
```

---

This architecture provides:

- ✅ Separation of concerns
- ✅ Scalability
- ✅ Maintainability
- ✅ Testability
- ✅ Security
- ✅ User preferences
- ✅ Database persistence
- ✅ Multi-platform support
