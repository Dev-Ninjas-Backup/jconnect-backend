# Firebase Notification Backend Architecture Documentation

**Version:** 1.0  
**Last Updated:** March 2, 2026  
**System:** JConnect Backend - Firebase Cloud Messaging Integration  
**Environment:** NestJS + Prisma + PostgreSQL + Firebase Admin SDK

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Module Structure](#2-module-structure)
3. [Firebase Initialization](#3-firebase-initialization)
4. [Token Management System](#4-token-management-system)
5. [Notification Sending Flow](#5-notification-sending-flow)
6. [Payload Design Strategy](#6-payload-design-strategy)
7. [Database Schema Strategy](#7-database-schema-strategy)
8. [Security Architecture](#8-security-architecture)
9. [Environment Strategy](#9-environment-strategy)
10. [Error Handling & Logging](#10-error-handling--logging)
11. [Performance Considerations](#11-performance-considerations)
12. [Testing Strategy](#12-testing-strategy)
13. [Production Checklist](#13-production-checklist)
14. [Common Issues & Solutions](#14-common-issues--solutions)

---

## 1. System Overview

### 1.1 High-Level Architecture

The backend implements a multi-layered Firebase Cloud Messaging (FCM) notification system that integrates with the existing authentication and user management infrastructure.

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│  (Mobile App - iOS/Android/Web)                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 1. FCM Token Registration
                         │ 2. JWT Authentication
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API GATEWAY LAYER                           │
│  • JWT Validation Middleware                                    │
│  • Role-Based Access Control                                    │
│  • Rate Limiting                                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CONTROLLER LAYER                              │
│  FirebaseNotificationController                                 │
│  • /firebase-notifications/update-fcm-token                     │
│  • /firebase-notifications/subscribe-topic                      │
│  • /firebase-notifications/unsubscribe-topic                    │
│  • /firebase-notifications/test/:userId                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                                │
│  ┌───────────────────────────────────────────────────────┐      │
│  │ FirebaseNotificationService (Business Logic)          │      │
│  │ • User preference checking                            │      │
│  │ • Template building                                   │      │
│  │ • Database persistence                                │      │
│  │ • Multi-user handling                                 │      │
│  └───────────────────┬───────────────────────────────────┘      │
│                      │                                          │
│  ┌───────────────────▼───────────────────────────────────┐      │
│  │ FirebaseMessagingService (Low-Level FCM)              │      │
│  │ • Direct Firebase SDK calls                           │      │
│  │ • Token management                                    │      │
│  │ • Topic subscriptions                                 │      │
│  │ • Error handling                                      │      │
│  └───────────────────┬───────────────────────────────────┘      │
└────────────────────────┼────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  FIREBASE ADMIN SDK                             │
│  • Service Account Authentication                               │
│  • FCM API Communication                                        │
│  • Token Validation                                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  FIREBASE CLOUD MESSAGING                       │
│  • Message Routing                                              │
│  • Platform-Specific Delivery                                   │
│  • Token Lifecycle Management                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              DEVICE LAYER (End Users)                           │
│  iOS Devices    Android Devices    Web Browsers                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     DATABASE LAYER                              │
│  PostgreSQL + Prisma ORM                                        │
│  • User (fcmToken field)                                        │
│  • Notification (notification records)                          │
│  • UserNotification (linking table)                             │
│  • NotificationToggle (user preferences)                        │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Backend → Firebase → Device Flow

```
TRIGGER EVENT
    │
    ├─ User Action (login, message, order, etc.)
    ├─ System Event (cron job, webhook)
    └─ Admin Action (announcement)
    │
    ▼
SERVICE LAYER
    │
    ├─ Business Logic Validation
    ├─ User Preference Check (NotificationToggle)
    ├─ FCM Token Retrieval (User.fcmToken)
    └─ Template Building (NotificationTemplate)
    │
    ▼
FCM SERVICE LAYER
    │
    ├─ Payload Construction
    ├─ Platform-Specific Configuration
    │   ├─ Android (priority, sound, channel)
    │   ├─ iOS (badge, sound, alert)
    │   └─ Web (icon, badge, link)
    └─ Firebase Admin SDK Call
    │
    ▼
FIREBASE CLOUD MESSAGING
    │
    ├─ Message Validation
    ├─ Token Validation
    ├─ Platform Routing
    └─ Delivery Attempt
    │
    ▼
DEVICE PUSH NOTIFICATION SERVICE
    │
    ├─ APNs (iOS)
    ├─ FCM (Android)
    └─ Web Push (Browser)
    │
    ▼
USER DEVICE
    │
    ├─ Notification Display
    ├─ Badge Update
    └─ User Interaction
```

### 1.3 Authentication & Authorization Flow

```
CLIENT REQUEST
    │
    ▼
JWT MIDDLEWARE (@ValidateAuth Decorator)
    │
    ├─ Extract JWT from Authorization header
    ├─ Verify JWT signature
    ├─ Decode user claims (userId, role, email)
    └─ Attach user to request context
    │
    ▼
CONTROLLER HANDLER (@GetUser Decorator)
    │
    ├─ Extract userId from request
    └─ Pass to service layer
    │
    ▼
SERVICE LAYER
    │
    ├─ Token Ownership Validation
    │   └─ Ensure user can only update their own FCM token
    ├─ Role-Based Logic (if applicable)
    │   └─ Admin can send to all users
    │   └─ Regular user can only send to specific recipients
    └─ Execute business logic
```

---

## 2. Module Structure

### 2.1 Firebase Core Module

**Location:** `src/lib/firebase/`

**Purpose:** Low-level Firebase Admin SDK integration and direct FCM operations.

**Components:**

- **FirebaseAdminProvider:** Singleton provider that initializes Firebase Admin SDK using service account credentials from environment variables. Implements singleton pattern to prevent multiple Firebase app instances.

- **FirebaseModule:** Global NestJS module that exports Firebase providers and services, making them available throughout the application without repeated imports.

- **FirebaseMessagingService:** Core FCM service that wraps Firebase Admin SDK messaging operations. Handles direct communication with Firebase Cloud Messaging API including sending messages, subscribing to topics, and token management.

- **DTOs (Data Transfer Objects):** Type-safe classes with validation decorators for notification payloads, ensuring data integrity at API boundaries.

**Responsibility Matrix:**

| Component                | Responsibility                | Dependencies                                    |
| ------------------------ | ----------------------------- | ----------------------------------------------- |
| FirebaseAdminProvider    | Initialize Firebase Admin SDK | Environment variables                           |
| FirebaseModule           | Export providers globally     | FirebaseAdminProvider, FirebaseMessagingService |
| FirebaseMessagingService | Direct FCM API calls          | Firebase Admin SDK                              |
| DTOs                     | Request/response validation   | class-validator, class-transformer              |

### 2.2 Notification Business Logic Module

**Location:** `src/main/shared/notification/`

**Purpose:** High-level notification logic, user preferences, database integration.

**Components:**

- **FirebaseNotificationService:** Business logic layer that orchestrates notification sending. Integrates user preferences from database, builds notification templates, handles multi-user scenarios, and persists notification records.

- **FirebaseNotificationController:** RESTful API endpoints for FCM token management and notification operations. Protected by JWT authentication middleware.

- **NotificationModule:** Module that imports Firebase core module and provides notification services to other application modules.

**Responsibility Matrix:**

| Component                      | Responsibility                | Dependencies                            |
| ------------------------------ | ----------------------------- | --------------------------------------- |
| FirebaseNotificationService    | Business logic, templates, DB | PrismaService, FirebaseMessagingService |
| FirebaseNotificationController | API endpoints, validation     | FirebaseNotificationService, JWT        |
| NotificationModule             | Module configuration          | FirebaseModule, PrismaModule            |

### 2.3 Integration Points

**Service Integration Pattern:**

Any service in the application can send notifications by:

1. Importing NotificationModule
2. Injecting FirebaseNotificationService
3. Building notification template
4. Calling send method with user ID

**Example Integration Points:**

- **AuthService:** Sends welcome notifications on user registration
- **MessageService:** Sends new message notifications
- **OrderService:** Sends order status update notifications
- **UserService:** Sends inquiry notifications when profile viewed
- **PaymentService:** Sends payment confirmation notifications

**Module Dependency Tree:**

```
AppModule
├─ AuthModule
├─ UserModule (imports NotificationModule)
│   └─ UsersService (uses FirebaseNotificationService)
├─ OrderModule (imports NotificationModule)
├─ MessageModule (imports NotificationModule)
└─ NotificationModule
    ├─ imports: [FirebaseModule, PrismaModule]
    ├─ providers: [FirebaseNotificationService]
    ├─ controllers: [FirebaseNotificationController]
    └─ exports: [FirebaseNotificationService]

FirebaseModule (Global)
├─ providers: [FirebaseAdminProvider, FirebaseMessagingService]
└─ exports: [FirebaseAdminProvider, FirebaseMessagingService]
```

---

## 3. Firebase Initialization

### 3.1 Environment Variable Strategy

**Required Variables:**

- **FIREBASE_PROJECT_ID:** Firebase project identifier from service account JSON
- **FIREBASE_CLIENT_EMAIL:** Service account email address
- **FIREBASE_PRIVATE_KEY:** Service account private key (PEM format with newline characters)

**Variable Format Requirements:**

- Private key must be enclosed in double quotes
- Newline characters must be preserved as `\n`
- No spaces or special characters in project ID
- Client email must match service account format

**Environment Configuration Pattern:**

The system uses a centralized environment enum that maps environment variable names to type-safe constants. This prevents typos and provides IDE autocompletion throughout the codebase.

### 3.2 Service Account Management

**Initialization Flow:**

1. Application bootstrap loads environment variables
2. FirebaseAdminProvider factory function executes
3. Checks if Firebase app already initialized (singleton pattern)
4. If not initialized, creates credential object from environment variables
5. Initializes Firebase Admin SDK with service account credentials
6. Returns singleton app instance for dependency injection

**Credential Security:**

- Service account credentials never logged or exposed in error messages
- Private key stored in environment variables, not in codebase
- Environment files excluded from version control
- Different service accounts for development and production

**Credential Rotation Strategy:**

When rotating service account credentials:

1. Generate new service account key in Firebase Console
2. Update environment variables in deployment environment
3. Restart application servers
4. Verify new credentials working
5. Revoke old service account key in Firebase Console
6. Monitor for any authentication errors

### 3.3 Development vs Production Configuration

**Development Environment:**

- Uses development Firebase project
- Less restrictive error logging (full stack traces)
- Test FCM tokens allowed
- Sandbox mode for testing
- Local environment variables from `.env` file

**Production Environment:**

- Uses production Firebase project
- Minimal error exposure to clients
- Real device tokens only
- Rate limiting enabled
- Environment variables from secure deployment platform
- Monitoring and alerting configured

**Configuration Separation:**

- Different Firebase projects for dev/staging/production
- Separate service accounts with different permissions
- Environment-specific database connections
- Conditional logic based on NODE_ENV variable

**Firebase Project Isolation:**

```
Development Firebase Project
├─ Service Account (dev-service-account@...)
├─ Test Users
├─ Development FCM tokens
└─ Relaxed security rules

Production Firebase Project
├─ Service Account (prod-service-account@...)
├─ Real Users
├─ Production FCM tokens
└─ Strict security rules
```

---

## 4. Token Management System

### 4.1 Token Registration API Flow

**Endpoint:** `POST /firebase-notifications/update-fcm-token`

**Authentication:** JWT required (user must be authenticated)

**Request Flow:**

```
CLIENT (Mobile App)
    │
    ├─ On App Launch or Login
    ├─ Request notification permissions
    ├─ Obtain FCM token from Firebase SDK
    │
    ▼
API REQUEST
    │
    ├─ POST /firebase-notifications/update-fcm-token
    ├─ Headers: Authorization: Bearer <JWT>
    ├─ Body: { "fcmToken": "fcm_token_string", "platform": "ios" }
    │
    ▼
JWT MIDDLEWARE
    │
    ├─ Validate JWT signature
    ├─ Extract userId from token claims
    ├─ Attach userId to request context
    │
    ▼
CONTROLLER
    │
    ├─ Extract userId from @GetUser decorator
    ├─ Extract fcmToken from request body
    ├─ Call FirebaseNotificationService.updateFcmToken()
    │
    ▼
SERVICE LAYER
    │
    ├─ Validate fcmToken format
    ├─ Update User record in database
    │   └─ UPDATE users SET fcmToken = ? WHERE id = ?
    ├─ Log token update event
    │
    ▼
DATABASE
    │
    ├─ User.fcmToken updated
    └─ Commit transaction
    │
    ▼
RESPONSE
    │
    └─ { "success": true, "message": "FCM token updated successfully" }
```

**Token Validation:**

- Token must be non-empty string
- Token length typically 152-200 characters
- Format validation (starts with expected prefix)
- Not validated against Firebase (trust client SDK)

### 4.2 Token Refresh Flow

**Trigger Scenarios:**

- App reinstallation
- Token expiration (Firebase manages this)
- Device OS update
- App updates
- Firebase SDK internal refresh

**Automatic Refresh Pattern:**

Mobile apps should implement token refresh listener and automatically send updated tokens to backend when Firebase SDK triggers refresh callback.

**Client Implementation Pattern:**

On token refresh event from Firebase SDK:

1. Obtain new FCM token
2. Check if token different from cached value
3. If different, call backend update endpoint
4. Cache new token locally
5. Log refresh event

**Backend Handling:**

Backend treats refresh as normal token update. No special handling required. Previous token automatically invalidated by Firebase when new token issued.

### 4.3 Token Deduplication Strategy

**Problem:** User might attempt to register same token multiple times.

**Solution Pattern:**

- Database field allows null or single string value
- Each user has one fcmToken field
- New token update overwrites previous value
- No duplicate token storage needed

**Multi-Device Consideration:**

Current implementation stores single token per user. For true multi-device support, would require separate DeviceToken table with one-to-many relationship to User.

**Single Token Limitation:**

With current schema, if user logs in on multiple devices, only most recent device receives notifications. This is acceptable for MVP but should be addressed for production multi-device support.

### 4.4 Multi-Device Handling

**Current Implementation:** Single token per user stored in User table.

**Limitation:** Last registered device overwrites previous tokens.

**Production Multi-Device Architecture (Recommended):**

```
User Table
├─ id (primary key)
├─ email
├─ ... (other fields)
└─ NO fcmToken field

Device Table (NEW)
├─ id (primary key)
├─ userId (foreign key → User)
├─ fcmToken (unique)
├─ platform (ios | android | web)
├─ deviceId (unique device identifier)
├─ isActive (boolean)
├─ lastUsed (timestamp)
└─ createdAt (timestamp)

Query Pattern for Multi-Device:
SELECT fcmToken FROM devices
WHERE userId = ?
AND isActive = true
```

**Benefits of Multi-Device Table:**

- Support multiple devices per user
- Track device usage patterns
- Implement device management (revoke access)
- Platform-specific notification targeting
- Inactive device cleanup

### 4.5 Logout Token Invalidation

**Current Implementation:** Token remains in database after logout.

**Security Implication:** User continues receiving notifications after logout until next login overwrites token.

**Recommended Logout Flow:**

```
Client Logout
    │
    ▼
API Call: POST /auth/logout
    │
    ├─ Clear server-side session
    ├─ Revoke JWT (if using token blacklist)
    ├─ Clear FCM token from database
    │   └─ UPDATE users SET fcmToken = NULL WHERE id = ?
    └─ Return success
    │
    ▼
Client
    │
    ├─ Clear local storage
    ├─ Clear FCM token cache
    └─ Redirect to login
```

**Implementation Priority:** Medium (user data leak risk exists but limited to notification content)

---

## 5. Notification Sending Flow

### 5.1 Trigger Sources

**1. User Actions:**

- Login/Registration: Welcome notification
- Message sent: New message notification to recipient
- Profile inquiry: Inquiry notification to profile owner
- Follow user: New follower notification
- Like/Comment: Social interaction notification

**2. System Events:**

- Order status change: Automated order update
- Payment processed: Payment confirmation
- Review received: New review notification
- Subscription expiry: Renewal reminder

**3. Admin Actions:**

- Platform announcement: Broadcast to all users or segments
- Maintenance notification: System downtime alert
- Promotional messages: Marketing campaigns

**4. Scheduled Events:**

- Cron jobs triggering reminders
- Batch notification processing
- Digest notifications (daily/weekly summaries)

### 5.2 Service Layer Logic

**High-Level Service Methods:**

**sendToUser(userId, template, saveToDb):**

Purpose: Send notification to single user

Logic Flow:

1. Retrieve user's FCM token from database
2. Validate token exists and non-empty
3. Check user notification preferences
4. Exit early if user disabled this notification type
5. Build FCM payload with platform-specific configs
6. Call low-level FCM service
7. If successful and saveToDb true, persist to database
8. Return success/failure result

**sendToMultipleUsers(userIds, template, saveToDb):**

Purpose: Send same notification to multiple users

Logic Flow:

1. Batch retrieve FCM tokens for all user IDs
2. Filter out users without valid tokens
3. Check notification preferences for each user
4. Build list of eligible tokens
5. Call Firebase multicast send (up to 500 tokens per call)
6. Handle partial failures (some tokens invalid)
7. Persist notifications for successful sends
8. Return success/failure counts

**sendToTopic(topic, template):**

Purpose: Send to all subscribers of topic

Logic Flow:

1. Build notification payload
2. Call Firebase topic send
3. Firebase handles delivery to all subscribed tokens
4. No database persistence (too many recipients)
5. Return overall success/failure

### 5.3 Role-Based Filtering Logic

**Permission Model:**

- Regular users: Can trigger notifications to users they interact with
- Service providers: Can notify their clients
- Admins: Can send to any user or broadcast to all

**Implementation Pattern:**

Role validation happens at business logic layer before calling notification service. Authorization checks ensure user can only send notifications within their permission scope.

**Example Role Logic:**

```
If user sends message:
    - Verify sender and recipient exist
    - Verify conversation authorized
    - Send notification to recipient only

If admin sends announcement:
    - Verify sender has admin role
    - Allow broadcast to all users or filtered segments
    - Log admin action for audit trail
```

### 5.4 Targeted vs Broadcast Messages

**Targeted Notifications:**

- Sent to specific user IDs
- Use sendToUser or sendToMultipleUsers
- Database persistence enabled
- User preferences respected
- Examples: Direct messages, order updates, reviews

**Broadcast Notifications:**

- Sent to topic subscribers
- Use sendToTopic
- No database persistence
- May bypass some preference checks
- Examples: System announcements, maintenance alerts

**Broadcast Strategy:**

For true broadcast to all users, two approaches:

1. **Topic Subscription:** Subscribe all users to "all_users" topic at registration
2. **Batch Processing:** Query all active users, extract tokens, send in batches

Topic subscription recommended for large user bases (more efficient).

### 5.5 Retry Logic

**Firebase SDK Built-In Retry:**

Firebase Admin SDK handles transient failures automatically with exponential backoff.

**Application-Level Retry Strategy:**

For critical notifications, implement application-level retry:

1. Catch FCM service errors
2. Log failure with context
3. Queue retry in background job
4. Attempt up to 3 retries with increasing delays
5. Mark as permanently failed after max retries

**Retry Queue Pattern (Recommended for Production):**

```
Notification Queue (BullMQ or similar)
├─ Job: Send notification
├─ Attempts: 3
├─ Backoff: Exponential (1min, 5min, 15min)
├─ On success: Remove from queue
├─ On failure: Retry or move to dead letter queue
└─ Dead letter queue: Manual review
```

### 5.6 Failure Handling

**Token Validation Failures:**

- Invalid token format: Log and remove from database
- Token expired: Firebase returns error, remove token
- Token unregistered: User uninstalled app, clear token

**Network Failures:**

- Timeout: Retry with exponential backoff
- Connection error: Queue for later retry
- Firebase service down: Fallback to email notification

**Permission Failures:**

- User disabled notifications: Skip sending, return gracefully
- App lacks notification permission: Log, notify user to enable

**Graceful Degradation:**

Notification failures should never block primary business logic. User should not see error if notification send fails. Business operation completes successfully, notification failure logged for monitoring.

**Error Response Pattern:**

Service layer returns result object:

- success: boolean
- messageId: string (if successful)
- error: string (if failed)

Caller decides whether to propagate error or handle silently.

---

## 6. Payload Design Strategy

### 6.1 Notification Payload Structure

**Visual Notification (Displayed to User):**

Contains user-facing content that appears in system notification tray.

Components:

- **Title:** Short, attention-grabbing text (50 chars recommended)
- **Body:** Detailed message content (200 chars recommended)
- **Image:** Optional image URL for rich notifications
- **Icon:** App icon or custom icon (Android)
- **Badge:** Badge count (iOS)
- **Sound:** Notification sound identifier

### 6.2 Data Payload Structure

**Background Data (For App Logic):**

Contains structured data for app to process when notification received.

Components:

- **type:** NotificationType enum value
- **entityId:** ID of related entity (userId, messageId, orderId, etc.)
- **timestamp:** ISO timestamp of event
- **action:** Deep link action (navigate to screen)
- **metadata:** Additional JSON data

**Data Payload Benefits:**

- App can react even if notification not displayed
- Enables silent notifications for data sync
- Supports complex app navigation
- Allows notification grouping by type

### 6.3 Hybrid Payload Strategy

**Recommended Production Pattern:**

Send both notification (visual) and data (background) payloads together.

**Rationale:**

- **Foreground scenario:** App displays custom in-app notification using data payload
- **Background scenario:** System displays visual notification
- **Killed app scenario:** Tapping notification launches app with data payload for deep linking

**Hybrid Payload Example:**

```
{
  notification: {
    title: "New Message",
    body: "John sent: Hello!"
  },
  data: {
    type: "NEW_MESSAGE",
    senderId: "user123",
    conversationId: "conv456",
    timestamp: "2026-03-02T10:30:00Z",
    action: "OPEN_CHAT"
  }
}
```

### 6.4 Silent Notification Structure

**Purpose:** Deliver data to app without user-visible notification.

**Use Cases:**

- Background data synchronization
- Real-time status updates
- Chat typing indicators
- Location updates

**Platform Implementations:**

**Android:** Data-only message (no notification key)

**iOS:** Content-available flag with minimal notification

**Important Limitations:**

- iOS background fetch restrictions
- Android Doze mode may delay delivery
- Not reliable for time-critical updates
- Should not replace real-time WebSocket connections

### 6.5 Deep Link Structure

**Deep Linking Strategy:**

Data payload includes action parameter that tells app which screen to open and with what context.

**Deep Link Action Patterns:**

- OPEN_CHAT → conversationId
- VIEW_ORDER → orderId
- VIEW_PROFILE → userId
- VIEW_SERVICE → serviceId
- OPEN_PAYMENT → paymentId

**Client Implementation Pattern:**

App receives notification data, parses action and parameters, uses navigation library to route to appropriate screen with pre-loaded data.

**Benefits:**

- Seamless user experience
- Direct navigation to relevant content
- Reduces steps to reach desired destination
- Increases engagement rates

---

## 7. Database Schema Strategy

### 7.1 Token Storage Model

**Current Implementation:**

User table contains fcmToken field as nullable string.

**Schema Design:**

```
User Table:
├─ id: UUID (primary key)
├─ email: String (unique)
├─ fcmToken: String? (nullable, default empty string)
├─ ... (other user fields)
```

**Design Rationale:**

- Simple implementation for single-device support
- Minimal schema changes to existing system
- Direct user-to-token relationship
- Nullable allows users without mobile app

**Indexing Considerations:**

- Primary lookup by userId (already indexed via primary key)
- No index on fcmToken needed (not queried directly)
- If implementing token-based user lookup, add index on fcmToken

### 7.2 User Relation Strategy

**One-to-One Relationship:**

User hasOne FCM token (current implementation).

**Limitation:** Only supports one active device per user.

**Production Multi-Device Pattern (Recommended):**

User hasMany Devices (one-to-many relationship).

**Benefits:**

- Support unlimited devices per user
- Track device metadata
- Implement device management
- Platform-specific targeting

### 7.3 Role Relation Integration

**Role-Based Notification Logic:**

System uses existing Role enum from Prisma schema.

**Role Values:**

- User: Regular platform users
- Artist: Service providers
- Admin: Platform administrators

**Role-Based Filtering:**

Notification service can filter recipients by role for targeted campaigns.

**Example Use Case:**

Admin broadcasts announcement only to Artist role users about new platform feature for service providers.

**Implementation Pattern:**

Query users by role, extract FCM tokens, send batch notification.

### 7.4 Notification Records Storage

**Notification Table:**

Stores notification history for user notification center.

**Schema Structure:**

```
Notification Table:
├─ id: UUID (primary key)
├─ userId: UUID (foreign key → User)
├─ title: String
├─ message: Text
├─ entityId: String? (optional related entity ID)
├─ read: Boolean (default false)
├─ metadata: JSON (additional data)
├─ createdAt: Timestamp
├─ updatedAt: Timestamp

Indexes:
├─ userId (for user's notification list)
├─ read (for unread count queries)
├─ createdAt (for chronological ordering)
```

**UserNotification Linking Table:**

Many-to-many relationship between users and notifications.

**Purpose:** Allow same notification visible to multiple users (broadcast scenarios).

**Schema Structure:**

```
UserNotification Table:
├─ id: UUID (primary key)
├─ userId: UUID (foreign key → User)
├─ notificationId: UUID (foreign key → Notification)
├─ type: NotificationType? (enum)
├─ read: Boolean (default false)
├─ createdAt: Timestamp
├─ updatedAt: Timestamp

Unique Constraint: (userId, notificationId)
```

### 7.5 Notification Preferences Storage

**NotificationToggle Table:**

Stores user preferences for notification types.

**Schema Structure:**

```
NotificationToggle Table:
├─ id: UUID (primary key)
├─ userId: UUID (foreign key → User, unique)
├─ email: Boolean (default true)
├─ message: Boolean (default true)
├─ Service: Boolean (default true)
├─ review: Boolean (default true)
├─ post: Boolean (default true)
├─ Inquiry: Boolean (default true)
├─ userRegistration: Boolean (default true)
├─ ... (additional toggle fields)
```

**Default Behavior:**

All notification types enabled by default. User can selectively disable.

**Preference Checking Logic:**

Before sending notification:

1. Query NotificationToggle for user
2. Check relevant boolean field for notification type
3. If disabled, skip sending
4. If no toggle record exists, assume enabled

**Type Mapping Strategy:**

Service maps custom NotificationType enum values to NotificationToggle field names.

Example mappings:

- NEW_MESSAGE → message field
- SERVICE_REQUEST → Service field
- REVIEW_RECEIVED → review field
- ANNOUNCEMENT → post field

### 7.6 Multi-Tenant Handling

**Current Implementation:** Single-tenant architecture.

**Multi-Tenant Considerations (If Applicable):**

If platform expands to multi-tenant model:

1. Add tenantId to User table
2. Scope all queries by tenantId
3. Separate Firebase projects per tenant
4. Tenant-specific notification templates
5. Isolated notification history per tenant

**Not applicable to current JConnect implementation** (single marketplace platform).

---

## 8. Security Architecture

### 8.1 JWT Validation Strategy

**Authentication Middleware:**

All notification endpoints protected by ValidateAuth decorator.

**Validation Flow:**

1. Extract JWT from Authorization header (Bearer scheme)
2. Verify signature using secret key
3. Check expiration timestamp
4. Decode payload and extract claims
5. Attach user context to request object
6. Pass to controller handler

**JWT Claims Used:**

- userId: Primary user identifier
- email: User email address
- role: User role (User, Artist, Admin)
- iat: Issued at timestamp
- exp: Expiration timestamp

**Security Considerations:**

- Short-lived tokens (recommended: 15-60 minutes)
- Refresh token mechanism for token renewal
- Token revocation on logout
- IP-based rate limiting to prevent abuse

### 8.2 Token Ownership Validation

**Principle:** User can only update their own FCM token.

**Validation Pattern:**

Controller extracts userId from JWT using GetUser decorator. Service layer updates only that user's token. No way for user to update another user's token.

**Endpoint Security:**

```
POST /firebase-notifications/update-fcm-token
Headers: Authorization: Bearer <JWT>
Body: { fcmToken: "..." }

Backend Logic:
1. JWT middleware extracts userId from token
2. Controller receives userId via GetUser decorator
3. Service updates User.fcmToken WHERE id = userId
4. No userId passed in request body (security by design)
```

**Prevents Token Hijacking:**

Malicious user cannot register their FCM token for another user's account because userId comes from authenticated JWT, not request body.

### 8.3 Preventing Unauthorized Token Injection

**Attack Vector:** Attacker tries to register their FCM token for victim's account.

**Protection Mechanisms:**

1. **Authentication Required:** All token endpoints require valid JWT
2. **Implicit User Context:** UserId from JWT, not request parameter
3. **No Public Endpoints:** No unauthenticated token registration
4. **Rate Limiting:** Prevent brute force token updates

**Additional Protection (Recommended):**

Implement device fingerprinting to detect suspicious token changes:

- Log IP address on token updates
- Alert on rapid token changes from different IPs
- Require re-authentication for token change from new location

### 8.4 Protecting Firebase Credentials

**Service Account Security:**

**Storage:**

- Never commit credentials to version control
- Store in environment variables
- Use secure secret management (AWS Secrets Manager, Azure Key Vault)
- Different service accounts for dev/staging/production

**Access Control:**

- Principle of least privilege for service account permissions
- Read-only database access for service account
- Only necessary Firebase APIs enabled
- Regular credential rotation (quarterly recommended)

**Runtime Protection:**

- Credentials loaded at startup, not accessed repeatedly
- No logging of credential values
- Error messages don't expose credential fragments
- Firebase Admin SDK handles credential security internally

**Monitoring:**

- Alert on credential usage from unexpected locations
- Monitor Firebase Console for unauthorized access
- Track service account key usage
- Implement credential compromise response plan

### 8.5 Authorization Patterns

**Permission Model:**

- **Own Data:** Users can update their own FCM token
- **Interaction Data:** Users can trigger notifications for users they interact with
- **Admin Actions:** Admins can send to any user or broadcast

**Example Authorization Checks:**

**Send Message Notification:**

- Verify sender is authenticated
- Verify sender and recipient have conversation
- Verify sender not blocked by recipient
- Then allow notification send

**Send Announcement:**

- Verify sender has admin role
- Log announcement action
- Allow broadcast send

**Update FCM Token:**

- Verify user authenticated
- Implicitly verify token ownership via JWT userId
- No additional checks needed

---

## 9. Environment Strategy

### 9.1 Development Setup

**Firebase Configuration:**

- Separate development Firebase project
- Test service account with limited permissions
- Local environment variables from `.env` file
- Mock notification testing without real devices

**Environment File Structure:**

```
.env (local development, gitignored)
├─ FIREBASE_PROJECT_ID="dev-jconnect"
├─ FIREBASE_CLIENT_EMAIL="dev@jconnect.iam.gserviceaccount.com"
├─ FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
├─ DATABASE_URL="postgresql://localhost:5432/jconnect_dev"
└─ NODE_ENV="development"
```

**Development Best Practices:**

- Use test user accounts
- Generate test FCM tokens from Firebase Console
- Enable verbose logging
- Disable rate limiting for testing
- Use local database instance

### 9.2 Production Setup

**Firebase Configuration:**

- Dedicated production Firebase project
- Production service account with audited permissions
- Environment variables from deployment platform
- Real device tokens only

**Environment Variable Sources:**

- **Cloud Platforms:** AWS Parameter Store, Azure App Configuration
- **Container Orchestration:** Kubernetes Secrets
- **Platform Services:** Heroku Config Vars, Vercel Environment Variables
- **Secret Management:** HashiCorp Vault, Google Secret Manager

**Production Security:**

- Enable rate limiting
- Implement monitoring and alerting
- Use production-grade error tracking
- Enable audit logging
- Restrict service account permissions
- Regular credential rotation

### 9.3 Firebase Project Separation

**Why Separate Projects:**

- Isolate production user data
- Prevent accidental test notifications to real users
- Different security rules per environment
- Separate billing and usage quotas
- Independent Firebase Console access control

**Project Naming Convention:**

- Development: `jconnect-dev`
- Staging: `jconnect-staging`
- Production: `jconnect-prod`

**Migration Considerations:**

- Tokens from dev project don't work in production
- Users must re-register tokens when moving between environments
- No data migration needed between Firebase projects
- Keep project configurations in sync manually

### 9.4 Configuration Management

**Environment Variable Hierarchy:**

1. System environment variables (highest priority)
2. Deployment platform configuration
3. `.env` file (development only)
4. Application defaults (lowest priority)

**Configuration Validation:**

On application startup:

1. Check all required environment variables present
2. Validate format (URLs, emails, JSON structure)
3. Log configuration status (without exposing secrets)
4. Fail fast if critical configuration missing

**Configuration Change Process:**

1. Update environment variables in deployment platform
2. Restart application servers (zero-downtime deployment)
3. Verify new configuration loaded via health check endpoint
4. Monitor for errors in first few minutes
5. Rollback if issues detected

**Secrets Rotation Workflow:**

1. Generate new service account key in Firebase Console
2. Stage new credentials in deployment platform
3. Deploy updated configuration
4. Verify application functioning with new credentials
5. Revoke old service account key
6. Document rotation in security log

---

## 10. Error Handling & Logging

### 10.1 Firebase Error Handling Strategy

**Error Categories:**

**1. Token Errors:**

- Invalid token format
- Token not registered
- Token expired
- Token not found

**Handling:** Log error, clear token from database, return graceful failure.

**2. Permission Errors:**

- User disabled notifications
- App lacks notification permission
- Service account permission denied

**Handling:** Log warning, skip sending, return success (not a system error).

**3. Network Errors:**

- Connection timeout
- DNS resolution failure
- Firebase service unavailable

**Handling:** Log error, queue for retry, return failure status.

**4. Quota Errors:**

- Rate limit exceeded
- Daily quota exhausted
- Concurrent request limit

**Handling:** Log critical error, implement backoff, alert operations team.

**Error Propagation Pattern:**

Service layer catches all Firebase errors, logs context, returns structured result object. Controller decides whether to return error to client or handle silently.

**Never Expose Firebase Internal Errors to Client:**

Bad: Returning raw Firebase error message
Good: Return generic "Notification send failed" message

### 10.2 Expired Token Cleanup

**Detection Strategy:**

Firebase returns specific error codes for expired/invalid tokens:

- messaging/invalid-registration-token
- messaging/registration-token-not-registered

**Automatic Cleanup Logic:**

When these errors detected:

1. Log token removal event
2. Update user record to clear fcmToken field
3. Optionally notify user (via email) to re-register device

**Batch Cleanup Job (Recommended):**

Daily cron job to proactively clean invalid tokens:

1. Query users with non-null fcmToken
2. Validate tokens with Firebase SDK (batch validation)
3. Clear invalid tokens from database
4. Log cleanup statistics

**Benefits:**

- Improved send success rates
- Reduced FCM quota usage
- Cleaner database

### 10.3 Logging Best Practices

**Structured Logging:**

Use NestJS Logger with structured log format (JSON).

**Log Levels:**

- **DEBUG:** Detailed flow information (development only)
- **LOG:** Normal operational messages
- **WARN:** Degraded functionality but system operational
- **ERROR:** Error conditions requiring attention
- **FATAL:** Critical errors causing system failure

**What to Log:**

**Success Cases:**

- Token updated for user X
- Notification sent successfully to user Y
- Z users subscribed to topic

**Failure Cases:**

- Failed to send notification to user X: reason
- Invalid FCM token cleared for user Y
- Firebase API returned error: error code

**What NOT to Log:**

- FCM tokens (sensitive data)
- Firebase credentials
- Complete user data
- Full error stack traces in production

**Log Context:**

Include relevant context in all logs:

- userId (for correlation)
- notificationType
- timestamp
- request ID (for tracing)
- environment (dev/prod)

### 10.4 Monitoring Strategy

**Key Metrics to Monitor:**

**1. Notification Volume:**

- Total notifications sent per hour/day
- Success rate percentage
- Failure rate by error type

**2. Performance Metrics:**

- Average send latency
- P95/P99 latency
- Queue depth (if using queue)

**3. Token Health:**

- Active tokens count
- Invalid token rate
- Token churn rate

**4. User Engagement:**

- Notification open rate (requires mobile analytics)
- Delivery rate
- User opt-out rate

**Alerting Thresholds:**

- Success rate drops below 90%
- Error rate exceeds 5%
- Firebase quota approaching limit
- Credential expiration approaching
- Abnormal spike in notification volume

**Monitoring Tools:**

- Application Performance Monitoring (APM): New Relic, Datadog
- Firebase Console: Built-in analytics and reporting
- Custom dashboards: Grafana, Kibana
- Log aggregation: Elasticsearch, CloudWatch Logs

**Health Check Endpoint:**

Implement health check that verifies:

- Firebase SDK initialized
- Service account credentials valid
- Database connection healthy
- Recent notifications sending successfully

---

## 11. Performance Considerations

### 11.1 Bulk Send Strategy

**Challenge:** Sending notifications to thousands of users.

**Firebase Limitations:**

- Maximum 500 tokens per multicast message
- Rate limits on API calls
- Response time increases with batch size

**Optimal Batch Processing:**

1. Query users in batches of 500
2. Extract FCM tokens
3. Filter invalid/null tokens
4. Send using Firebase multicast API
5. Process next batch
6. Handle partial failures

**Parallel Processing Pattern:**

For very large sends (10,000+ users):

1. Divide recipients into chunks
2. Process chunks in parallel (limit concurrency)
3. Use job queue (BullMQ recommended)
4. Monitor job completion
5. Aggregate results

**Benefits:**

- Improved throughput
- Better resource utilization
- Graceful handling of failures
- Ability to pause/resume large sends

### 11.2 Queue Usage

**Use Cases for Message Queue:**

- Bulk notification processing
- Retry failed sends
- Scheduled notifications
- Rate limiting compliance
- Decoupling notification send from business logic

**Queue Architecture Pattern:**

```
Business Logic
    │
    └─ Queue: "notification-send"
           ├─ Job: Send to user X
           ├─ Job: Send to user Y
           ├─ Job: Send to user Z
           │
           ▼
    Queue Worker (processes jobs)
           │
           ├─ Fetch job from queue
           ├─ Send notification via FCM
           ├─ Handle result
           ├─ Remove job or retry
           └─ Process next job
```

**Queue Benefits:**

- Asynchronous processing (don't block API responses)
- Automatic retry with exponential backoff
- Job prioritization
- Monitoring and visibility
- Horizontal scaling of workers

**Recommended Queue Implementation:**

BullMQ (Redis-based) for Node.js/NestJS applications.

### 11.3 Rate Limiting

**Firebase Quotas:**

- Free tier: Limited messages per day
- Paid tier: Higher limits but still rate limited
- Burst limit: Maximum concurrent connections

**Application-Level Rate Limiting:**

Implement rate limiting on notification endpoints to prevent abuse:

- Per user: Max 10 notifications sent per minute
- Per IP: Max 100 API calls per minute
- Global: Max 1000 notifications per second

**Rate Limiting Strategy:**

Use Redis-based rate limiter (express-rate-limit with Redis store).

**Graceful Degradation:**

When approaching rate limits:

1. Return 429 Too Many Requests status
2. Include Retry-After header
3. Queue excess requests
4. Log rate limit events
5. Alert if sustained high rate

**Firebase API Rate Limit Handling:**

When Firebase API returns rate limit error:

1. Implement exponential backoff
2. Queue message for retry
3. Don't retry immediately
4. Monitor for sustained rate limiting (may indicate issue)

### 11.4 Caching Strategy

**Token Caching:**

**Problem:** Repeated database queries for same user's FCM token.

**Solution:** Implement in-memory cache with TTL.

**Implementation Pattern:**

```
Request → Check Redis cache → If hit, return token
                            → If miss, query database
                            → Cache for 5 minutes
                            → Return token
```

**Cache Invalidation:**

Clear cached token when:

- User updates FCM token
- Token detected as invalid
- User logs out

**User Preference Caching:**

Cache NotificationToggle records with 10-minute TTL.

**Benefits:**

- Reduced database load
- Faster notification sends
- Better scalability

**Cache Consistency:**

Use cache-aside pattern with write-through on updates to maintain consistency.

---

## 12. Testing Strategy

### 12.1 Manual Testing Approach

**Development Testing:**

1. **Token Registration:**
    - Login to mobile app (dev environment)
    - Observe FCM token logged in app console
    - Call update-fcm-token endpoint via Postman
    - Verify token saved in database

2. **Notification Sending:**
    - Call test notification endpoint
    - Verify notification received on device
    - Check notification content matches expected
    - Verify deep link opens correct screen

3. **Preference Testing:**
    - Disable notification type in user settings
    - Trigger notification of that type
    - Verify notification not sent
    - Re-enable and verify notification sent

**Test Checklist:**

- [ ] Token registration successful
- [ ] Token persisted in database
- [ ] Notification received on iOS device
- [ ] Notification received on Android device
- [ ] Notification received on web browser
- [ ] Deep link navigation works
- [ ] Badge count updates (iOS)
- [ ] Notification sound plays
- [ ] User preferences respected
- [ ] Token cleared on logout

### 12.2 Backend-Triggered Testing

**Automated Test Scenarios:**

**Unit Tests:**

Test individual service methods in isolation:

- buildNotificationTemplate returns correct structure
- checkNotificationSettings returns boolean based on preferences
- updateFcmToken updates database correctly

**Integration Tests:**

Test full flow with mocked Firebase SDK:

- Send notification flow from controller to database
- Multi-user send with mixed valid/invalid tokens
- Topic subscription and notification send

**Example Test Structure:**

Test updateFcmToken method:

1. Setup: Create test user in database
2. Execute: Call updateFcmToken with new token
3. Assert: User.fcmToken updated in database
4. Cleanup: Delete test user

**End-to-End Tests:**

Test complete flow with real Firebase test project:

1. Register test device token
2. Trigger notification from business logic
3. Verify notification sent via Firebase Console
4. Verify notification record in database

### 12.3 Staging Verification

**Staging Environment:**

Separate staging environment with:

- Staging Firebase project
- Staging database
- Test user accounts
- Real device testing

**Staging Test Plan:**

1. **Smoke Tests:**
    - Application starts successfully
    - Firebase initialized
    - Health check passes

2. **Functional Tests:**
    - All notification endpoints accessible
    - Token management working
    - Notifications deliver to test devices

3. **Load Tests:**
    - Bulk send to 100 test users
    - Measure performance metrics
    - Verify no errors under load

4. **Security Tests:**
    - JWT authentication enforced
    - Token ownership validated
    - Rate limiting functional

**Approval Gates:**

Before promoting to production:

- [ ] All tests passing in staging
- [ ] Performance benchmarks met
- [ ] Security audit completed
- [ ] Documentation updated
- [ ] Rollback plan documented

### 12.4 Testing Tools

**Postman/Insomnia:**

API endpoint testing with saved collections for:

- Token registration
- Notification sending
- Topic management
- Error scenarios

**Firebase Console:**

- View sent messages
- Check delivery statistics
- Test message composer
- Monitor errors

**Device Testing:**

- iOS Simulator (basic testing)
- Android Emulator (basic testing)
- Physical devices (production testing)

**Load Testing:**

- Artillery or k6 for API load testing
- Simulate bulk notification scenarios
- Measure latency and success rates

---

## 13. Production Checklist

### 13.1 Pre-Deployment

**Firebase Configuration:**

- [ ] Production Firebase project created
- [ ] Production service account generated
- [ ] Service account permissions reviewed and minimized
- [ ] Environment variables configured in deployment platform
- [ ] Firebase credentials tested in staging

**Database:**

- [ ] User table has fcmToken field (nullable)
- [ ] Notification table schema deployed
- [ ] UserNotification table created
- [ ] NotificationToggle table with default values
- [ ] Database indexes created on userId, createdAt, read fields
- [ ] Database backup strategy in place

**Code:**

- [ ] All TypeScript compilation errors resolved
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Code reviewed and approved
- [ ] Security audit completed
- [ ] Dependencies audited for vulnerabilities

**Documentation:**

- [ ] API documentation updated
- [ ] Internal architecture docs complete
- [ ] Runbook for common issues created
- [ ] Monitoring dashboards configured

### 13.2 Deployment Steps

1. **Deploy Application:**
    - Build production Docker image
    - Deploy to container orchestration platform
    - Run database migrations
    - Verify environment variables loaded

2. **Verify Firebase Connection:**
    - Check application logs for Firebase initialization
    - Call health check endpoint
    - Send test notification to staging device

3. **Smoke Test:**
    - Register test user
    - Update FCM token
    - Send test notification
    - Verify notification received

4. **Monitor Initial Traffic:**
    - Watch error rates
    - Monitor response times
    - Check Firebase Console for sent messages
    - Review application logs

5. **Gradual Rollout:**
    - Enable for 10% of users first
    - Monitor for 1 hour
    - Increase to 50% if no issues
    - Monitor for 2 hours
    - Roll out to 100%

### 13.3 Post-Deployment

**Monitoring Setup:**

- [ ] Application metrics dashboard created
- [ ] Firebase Console monitoring configured
- [ ] Alerting rules configured
- [ ] On-call rotation notified
- [ ] Incident response plan reviewed

**User Communication:**

- [ ] Release notes published
- [ ] User documentation updated
- [ ] Support team briefed
- [ ] Known issues documented

**Performance Baseline:**

- [ ] Notification send success rate measured
- [ ] Average latency documented
- [ ] Error rate tracked
- [ ] User engagement metrics baseline established

**Optimization:**

- [ ] Identify slow queries
- [ ] Optimize database indexes if needed
- [ ] Review and adjust batch sizes
- [ ] Fine-tune rate limiting

### 13.4 Rollback Plan

**Rollback Triggers:**

- Success rate drops below 80%
- Error rate exceeds 10%
- System instability detected
- Critical security issue discovered

**Rollback Process:**

1. Stop traffic to new version
2. Route traffic to previous version
3. Verify previous version functioning
4. Investigate root cause
5. Document incident
6. Plan fix and redeployment

**Database Rollback:**

If schema changes deployed:

- Run reverse migration scripts
- Verify data integrity
- Test application functionality

---

## 14. Common Issues & Solutions

### 14.1 Token Not Saving

**Symptoms:**

- updateFcmToken endpoint returns success
- But token null in database
- Or token different from sent value

**Possible Causes:**

1. **TypeScript type mismatch:** Prisma client doesn't recognize fcmToken field

**Solution:** Regenerate Prisma client with `npx prisma generate`

2. **Database constraint violation:** Unique constraint or invalid format

**Solution:** Check database schema, verify no unique constraint on fcmToken

3. **Transaction rollback:** Error in related operation causes rollback

**Solution:** Wrap token update in try-catch, commit transaction explicitly

4. **Multiple database instances:** Different database URL in environment

**Solution:** Verify DATABASE_URL environment variable

**Debug Steps:**

1. Check application logs for database errors
2. Query database directly to verify token
3. Add console.log before and after update
4. Test with Postman/curl to isolate frontend issues

### 14.2 Notifications Not Received

**Symptoms:**

- Backend returns success
- No notification appears on device

**Diagnostic Flowchart:**

```
Is fcmToken saved in database?
    ├─ No → User never registered token
    │        Solution: Call update-fcm-token endpoint
    └─ Yes → Is token valid?
             ├─ No → Token expired or invalid
             │        Solution: Clear and re-register token
             └─ Yes → Check user preferences
                      ├─ Disabled → User disabled this notification type
                      │            Solution: Enable in settings
                      └─ Enabled → Check Firebase Console
                                   ├─ Error logged → Fix error
                                   └─ Success logged → Check device
                                                       ├─ Permissions → Grant permissions
                                                       ├─ Internet → Check connectivity
                                                       └─ App state → Restart app
```

**Common Causes:**

1. **Device Permissions:** User denied notification permissions

**Solution:** Prompt user to enable in device settings

2. **Invalid Token:** Token expired or device uninstalled app

**Solution:** Clear token, have user re-register

3. **Firebase Configuration:** Wrong project or credentials

**Solution:** Verify FIREBASE_PROJECT_ID matches mobile app

4. **Network Issues:** Firebase service unreachable

**Solution:** Check Firebase status page, retry later

5. **App State:** App force-stopped or in doze mode (Android)

**Solution:** User-initiated action or high-priority notification

### 14.3 Firebase Initialization Failed

**Error Message:**

```
❌ Failed to initialize Firebase Admin SDK: [error]
```

**Causes and Solutions:**

**1. Missing Environment Variables:**

Error: "Firebase configuration is incomplete"

Solution: Verify all three variables present:

- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY

**2. Invalid Private Key Format:**

Error: "Error parsing private key"

Solution: Ensure private key:

- Enclosed in double quotes
- Contains `\n` for newlines
- Complete from BEGIN to END markers

**3. Invalid Credentials:**

Error: "Invalid service account"

Solution:

- Regenerate service account key
- Verify correct project
- Check service account not disabled

**4. Network Issues:**

Error: "Unable to reach Firebase"

Solution:

- Check internet connectivity
- Verify firewall allows Firebase API
- Check corporate proxy settings

**5. Duplicate Initialization:**

Error: "Firebase app already exists"

Solution: Already fixed in code with singleton pattern check

**Debug Steps:**

1. Check environment variables loaded:

    ```
    console.log('Project ID:', process.env.FIREBASE_PROJECT_ID)
    ```

2. Test credentials with Firebase CLI

3. Verify service account active in Firebase Console

4. Check application logs for detailed error

### 14.4 High Error Rate

**Symptom:**

- Many notifications failing
- Success rate below 90%

**Investigation Steps:**

**1. Check Error Types:**

Query logs for error codes:

- messaging/invalid-registration-token → Batch token cleanup
- messaging/server-unavailable → Firebase outage
- messaging/quota-exceeded → Rate limiting

**2. Analyze Token Health:**

Run query to identify invalid tokens:

```
SELECT count(*) FROM users
WHERE fcmToken IS NOT NULL
AND fcmToken != ''
AND (last_notification_failed = true OR last_active < NOW() - INTERVAL '30 days')
```

**3. Check Firebase Console:**

- View error statistics
- Check quota usage
- Review delivery reports

**Solutions:**

**Token Cleanup:**

- Run batch validation job
- Clear invalid tokens
- Implement automatic cleanup

**Rate Limiting:**

- Reduce send rate
- Implement queue
- Upgrade Firebase plan

**Firebase Outage:**

- Check status page
- Implement retry queue
- Consider backup notification channel

### 14.5 Performance Degradation

**Symptoms:**

- Slow API responses
- Increasing latency
- Database connection pool exhausted

**Causes and Solutions:**

**1. Database Query Performance:**

Symptom: Slow queries for user tokens

Solution:

- Add database index on userId
- Implement caching layer
- Optimize query patterns

**2. Firebase API Latency:**

Symptom: Slow Firebase SDK calls

Solution:

- Implement timeout configuration
- Use multicast for bulk sends
- Monitor Firebase status

**3. Memory Leaks:**

Symptom: Increasing memory usage

Solution:

- Review and fix promise leaks
- Ensure database connections closed
- Monitor and alert on memory usage

**4. Concurrent Request Overload:**

Symptom: Server CPU at 100%

Solution:

- Implement request queue
- Scale horizontally
- Optimize resource usage

**Performance Optimization:**

1. Enable caching for tokens and preferences
2. Batch database operations
3. Use connection pooling
4. Implement queue for async processing
5. Monitor and optimize slow queries

---

## Appendix A: Key System Metrics

**Success Criteria:**

- Notification send success rate: > 95%
- Average send latency: < 500ms
- Token registration success: > 99%
- System uptime: > 99.9%
- Error rate: < 1%

**Monitoring Dashboards:**

1. **Operational Dashboard:**
    - Real-time notification volume
    - Success/failure rates
    - Active device count
    - API response times

2. **User Engagement Dashboard:**
    - Notification open rates
    - User opt-out rates
    - Notification preferences distribution
    - Platform distribution (iOS/Android/Web)

3. **Error Dashboard:**
    - Error rate trends
    - Top error types
    - Failed token list
    - Firebase API errors

---

## Appendix B: Notification Type Reference

**Implemented Notification Types:**

1. **NEW_MESSAGE:** Direct messages between users
2. **NEW_FOLLOWER:** User gained new follower
3. **NEW_LIKE:** Content liked by another user
4. **NEW_COMMENT:** Comment on user's content
5. **SERVICE_REQUEST:** Client requested service
6. **ORDER_UPDATE:** Order status changed
7. **PAYMENT_RECEIVED:** Payment completed
8. **REVIEW_RECEIVED:** New review submitted
9. **ANNOUNCEMENT:** Platform-wide announcement
10. **CUSTOM:** Custom notification format

**Prisma Database NotificationType Enum:**

- Service
- Payment
- UserRegistration
- Inquiry

**Mapping Strategy:**

Custom types mapped to Prisma enum where possible, others use null value.

---

## Appendix C: API Endpoint Reference

**Base URL:** `/firebase-notifications`

**Endpoints:**

1. **POST /update-fcm-token**
    - Auth: Required
    - Body: { fcmToken, platform?, deviceId? }
    - Response: { success, message }

2. **POST /subscribe-topic**
    - Auth: Required
    - Body: { topic }
    - Response: { success }

3. **POST /unsubscribe-topic**
    - Auth: Required
    - Body: { topic }
    - Response: { success }

4. **POST /test/:userId**
    - Auth: Required
    - Purpose: Testing
    - Response: { success, messageId?, error? }

---

## Appendix D: Environment Variables Reference

**Required Variables:**

| Variable              | Format            | Example                                                         |
| --------------------- | ----------------- | --------------------------------------------------------------- |
| FIREBASE_PROJECT_ID   | String            | jconnect-prod                                                   |
| FIREBASE_CLIENT_EMAIL | Email             | firebase-adminsdk@project.iam.gserviceaccount.com               |
| FIREBASE_PRIVATE_KEY  | PEM Key           | "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" |
| DATABASE_URL          | Connection String | postgresql://user:pass@host:5432/db                             |
| NODE_ENV              | String            | production                                                      |

---

**END OF DOCUMENTATION**

---

This documentation represents the complete Firebase Cloud Messaging backend architecture for the JConnect platform. For implementation questions or issues not covered here, consult Firebase Admin SDK documentation or contact the platform development team.

**Document Version:** 1.0  
**Last Review:** March 2, 2026  
**Next Review:** June 2, 2026
