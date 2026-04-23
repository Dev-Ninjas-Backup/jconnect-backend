# 🔔 Firebase Inquiry Notification Implementation

## ✅ Implementation Complete

Firebase push notifications have been successfully integrated into the **Inquiry Message** feature without changing your existing code logic.

---

## 📋 What Was Added

### 1. **Import Statements** (`users.service.ts`)

```typescript
import { FirebaseNotificationService } from "@main/shared/notification/firebase-notification.service";
import { NotificationType } from "src/lib/firebase/dto/notification.dto";
```

### 2. **Service Injection** (`users.service.ts`)

```typescript
constructor(
    private prisma: PrismaService,
    private utils: UtilsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly firebaseNotificationService: FirebaseNotificationService, // ✅ Added
) {}
```

### 3. **Module Import** (`users.module.ts`)

```typescript
import { NotificationModule } from "@main/shared/notification/notification.module";

@Module({
    imports: [NotificationModule], // ✅ Added
    controllers: [UsersController],
    providers: [UsersService, AwsService],
})
```

### 4. **Firebase Notification Logic** (`findOneUserIdInquiry` method)

Added **after** the existing `eventEmitter.emit()` call:

```typescript
// -------------------------- Firebase Push Notification --------------------------
// Send Firebase push notification for inquiry
try {
    const inquiryMessage = `I like your profile and I wanna buy your service - ${currentUser.full_name}`;

    // Build notification using the NEW_MESSAGE template (most appropriate for inquiries)
    const notification = this.firebaseNotificationService.buildNotificationTemplate(
        NotificationType.NEW_MESSAGE,
        {
            senderName: currentUser.full_name,
            senderId: currentUser.id,
            messagePreview: inquiryMessage,
            conversationId: `inquiry_${currentUser.id}_${user.id}`, // Unique inquiry ID
        },
    );

    // Send notification to the service provider (user being inquired)
    // saveToDb: true - will save to notification table
    await this.firebaseNotificationService.sendToUser(
        user.id,
        notification,
        true, // Save to database
    );

    console.log(
        `✅ Firebase notification sent for inquiry from ${currentUser.full_name} to ${user.full_name || user.email}`,
    );
} catch (firebaseError) {
    // Don't throw error - inquiry should succeed even if notification fails
    console.error("⚠️ Firebase notification failed for inquiry:", firebaseError.message);
}
```

---

## 🎯 How It Works

### Flow Diagram

```
User A views User B's profile
         ↓
User A clicks "Send Inquiry"
         ↓
findOneUserIdInquiry(userB.id, userA.id) is called
         ↓
1. Fetch User B's details (service provider)
2. Fetch User A's details (inquirer)
3. Calculate ratings, followers, etc.
         ↓
4. Emit Event (existing logic) ✅
         ↓
5. Send Firebase Push Notification (NEW!) 🔥
   - Build notification template
   - Send to User B's device
   - Save to database
         ↓
6. Return user profile with stats
```

---

## 📱 Notification Details

### Notification Type

- **Type:** `NEW_MESSAGE`
- **Reason:** Inquiry is essentially a message from potential customer

### Notification Content

```json
{
    "title": "New Message from [Sender Name]",
    "body": "I like your profile and I wanna buy your service - [Sender Name]",
    "data": {
        "type": "NEW_MESSAGE",
        "senderId": "[User A ID]",
        "senderName": "[User A Full Name]",
        "conversationId": "inquiry_[userA_id]_[userB_id]",
        "timestamp": "2026-03-02T..."
    }
}
```

### Platform-Specific Enhancements

- **Android:** High priority notification with sound
- **iOS:** Badge count +1, critical alert sound
- **Web:** Desktop notification with click action

---

## 🔍 Code Analysis

### Your Original Code Structure

```typescript
@HandleError("Failed to send inquiry", "User")
async findOneUserIdInquiry(id: string, currentUserId: string) {
    // 1. Fetch user being inquired (service provider)
    const user = await this.prisma.user.findUnique({...});

    // 2. Calculate ratings
    const avgRating = await this.prisma.review.aggregate({...});

    // 3. Fetch current user (inquirer)
    const currentUser = await this.prisma.user.findUnique({...});

    // 4. Emit email notification event
    if (currentUser) {
        this.eventEmitter.emit(EVENT_TYPES.INQUIRY_CREATE, {...});
    }

    // 5. Return enriched user data
    return {...};
}
```

### What We Added (No Changes to Flow)

- ✅ **No changes** to your existing logic
- ✅ **No changes** to database queries
- ✅ **No changes** to event emission
- ✅ **Only added** Firebase push notification after event emission
- ✅ **Graceful error handling** - inquiry succeeds even if notification fails

---

## 🧪 Testing

### 1. **Test Without Mobile App** (Server Logs)

```bash
# Start the server
npm run start:dev

# Make inquiry request
curl -X GET http://localhost:5050/users/{userId}/inquiry \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Check server logs for:
✅ Firebase notification sent for inquiry from John Doe to Jane Smith
```

### 2. **Test With Mobile App** (Real Device)

#### Prerequisites:

- User B must have FCM token saved in database
- Mobile app must be installed on device
- Firebase credentials must be configured in `.env`

#### Test Steps:

1. **User A** logs into mobile app
2. **User A** views **User B's** profile
3. **User A** sends inquiry message
4. **User B** should receive push notification:
    ```
    New Message from User A
    I like your profile and I wanna buy your service - User A
    ```

### 3. **Test Notification Preferences**

The notification respects user preferences in `NotificationToggle` table:

```typescript
// Notification will be sent only if User B has these enabled:
- message: true  // Message notifications enabled
- Service: true  // Service-related notifications enabled
```

---

## 📊 Database Impact

### Notification Record Created

When notification is sent, a record is created in `Notification` table:

```prisma
{
  id: "uuid",
  type: "Inquiry", // Mapped to Prisma NotificationType.Inquiry
  userId: "User B ID", // Recipient
  message: "I like your profile and I wanna buy your service - User A",
  read: false,
  createdAt: "2026-03-02T...",
}
```

---

## 🚀 Expected Behavior

### Success Case

1. ✅ User profile is fetched
2. ✅ Ratings are calculated
3. ✅ Email event is emitted (existing)
4. ✅ Firebase notification is sent
5. ✅ Notification is saved to database
6. ✅ User data is returned
7. ✅ Console log: `Firebase notification sent for inquiry`

### Failure Case (Firebase error)

1. ✅ User profile is fetched
2. ✅ Ratings are calculated
3. ✅ Email event is emitted (existing)
4. ⚠️ Firebase notification fails (e.g., no FCM token)
5. ⚠️ Console log: `Firebase notification failed for inquiry: [error]`
6. ✅ **Inquiry still succeeds** - user data is returned normally

---

## 🎨 Customization Options

### Change Notification Message

```typescript
const inquiryMessage = `Custom message here - ${currentUser.full_name}`;
```

### Use Different Notification Type

```typescript
// Instead of NEW_MESSAGE, you could use:
NotificationType.SERVICE_REQUEST; // For service-specific inquiries
NotificationType.CUSTOM; // For custom handling
```

### Add Custom Data

```typescript
const notification = this.firebaseNotificationService.buildNotificationTemplate(
    NotificationType.NEW_MESSAGE,
    {
        senderName: currentUser.full_name,
        senderId: currentUser.id,
        messagePreview: inquiryMessage,
        conversationId: `inquiry_${currentUser.id}_${user.id}`,
        // Add custom fields:
        senderPhoto: currentUser.profilePhoto,
        senderRole: currentUser.role,
        serviceInterest: user.services[0]?.title, // Service they're interested in
    },
);
```

### Don't Save to Database

```typescript
await this.firebaseNotificationService.sendToUser(
    user.id,
    notification,
    false, // Don't save to database
);
```

---

## 🐛 Troubleshooting

### Issue: "Firebase notification failed"

**Possible Causes:**

1. User B doesn't have FCM token in database
2. FCM token is expired/invalid
3. Firebase credentials not configured
4. User B has notifications disabled

**Solutions:**

```typescript
// Check if user has FCM token
const user = await this.prisma.user.findUnique({
    where: { id: user.id },
    select: { fcmToken: true },
});
console.log("User FCM Token:", user.fcmToken);

// Check user notification preferences
const prefs = await this.prisma.notificationToggle.findUnique({
    where: { userId: user.id },
});
console.log("Notification Preferences:", prefs);
```

### Issue: "No notification received on mobile"

**Checklist:**

- ✅ Server logs show "Firebase notification sent"
- ✅ User has FCM token in database
- ✅ Mobile app has notification permissions
- ✅ Mobile app is registered with Firebase
- ✅ FCM token was sent to backend
- ✅ App is handling `onMessage` events

---

## 📈 Monitoring

### Server Logs

```bash
# Successful notification
✅ Firebase notification sent for inquiry from John Doe to Jane Smith

# Failed notification (but inquiry succeeded)
⚠️ Firebase notification failed for inquiry: No FCM token found for user
```

### Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Cloud Messaging**
4. View delivery reports and statistics

---

## 🔐 Security

### User Privacy

- ✅ Only sends notification to intended recipient (User B)
- ✅ Respects user notification preferences
- ✅ Doesn't expose sensitive user data

### Error Handling

- ✅ Graceful error handling - doesn't crash the inquiry
- ✅ Logs errors for debugging
- ✅ Doesn't expose Firebase errors to client

---

## 📝 Summary

### Changes Made

| File               | Change                      | Impact                 |
| ------------------ | --------------------------- | ---------------------- |
| `users.service.ts` | Added imports               | No breaking changes    |
| `users.service.ts` | Injected service            | No breaking changes    |
| `users.service.ts` | Added notification logic    | Enhanced functionality |
| `users.module.ts`  | Imported NotificationModule | Dependency added       |

### Benefits

- ✅ **Real-time notifications** - Users get instant push notifications
- ✅ **Better engagement** - Higher response rate to inquiries
- ✅ **Cross-platform** - Works on iOS, Android, and Web
- ✅ **Persistent** - Saved to database for history
- ✅ **Respects preferences** - Users can disable if needed
- ✅ **Non-breaking** - Original functionality unchanged

### Next Steps

1. ✅ Code is ready - no further changes needed
2. 🔧 Configure Firebase credentials in `.env`
3. 📱 Test with mobile app
4. 🎨 Customize notification message if desired
5. 📊 Monitor notification delivery rates

---

## 🎉 Done!

Your inquiry feature now sends Firebase push notifications automatically!

**No code changes required** - the implementation is complete and ready to use. Just ensure Firebase credentials are configured in your `.env` file.
