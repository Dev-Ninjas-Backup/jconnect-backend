# 🎨 Firebase Inquiry Notification - Flow Diagram

## Complete User Journey

```
┌─────────────────────────────────────────────────────────────────────┐
│                       USER A (Inquirer)                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ 1. Views User B's profile
                              ▼
                    ┌─────────────────────┐
                    │   Mobile App / Web  │
                    │  GET /users/:id/    │
                    │      inquiry        │
                    └─────────────────────┘
                              │
                              │ 2. JWT Token (User A)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND API ENDPOINT                             │
│  UsersController.findOneUserIdInquiry(userId, currentUserId)        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ 3. Calls service method
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│              UsersService.findOneUserIdInquiry()                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  STEP 1: Fetch User B (Service Provider)                           │
│  ├─ User details                                                    │
│  ├─ Services offered                                                │
│  ├─ Profile & social links                                          │
│  ├─ Reviews received                                                │
│  ├─ Followers & following                                           │
│  └─ ✅ User B data retrieved                                        │
│                                                                     │
│  STEP 2: Calculate Ratings                                         │
│  ├─ Average rating                                                  │
│  ├─ Total reviews count                                             │
│  └─ ✅ Stats calculated                                             │
│                                                                     │
│  STEP 3: Fetch User A (Inquirer)                                   │
│  ├─ Full name                                                       │
│  ├─ Email                                                           │
│  ├─ Profile photo                                                   │
│  └─ ✅ User A data retrieved                                        │
│                                                                     │
│  STEP 4: Emit Email Event (Existing Logic)                         │
│  ├─ Event: INQUIRY_CREATE                                           │
│  ├─ Recipients: [User B]                                            │
│  └─ ✅ Email queued for sending                                     │
│                                                                     │
│  STEP 5: Send Firebase Push Notification (NEW!) 🔥                 │
│  ├─ Build notification template                                     │
│  ├─ Title: "New Message from {User A}"                             │
│  ├─ Body: "I like your profile..."                                 │
│  ├─ Check User B's FCM token                                        │
│  ├─ Check User B's notification preferences                         │
│  ├─ Send to Firebase Cloud Messaging                               │
│  └─ Save to database (Notification table)                          │
│                                                                     │
│  STEP 6: Return Response                                            │
│  └─ ✅ User B profile + ratings + stats                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   Firebase Cloud        │     │   PostgreSQL Database   │
│   Messaging (FCM)       │     │                         │
├─────────────────────────┤     ├─────────────────────────┤
│                         │     │  Notification Table:    │
│ Sends push notification │     │  - type: "Inquiry"      │
│ to User B's device      │     │  - userId: User B ID    │
│                         │     │  - message: "I like..." │
│ ✅ iOS                  │     │  - read: false          │
│ ✅ Android              │     │  - createdAt: now       │
│ ✅ Web                  │     │                         │
│                         │     │  ✅ Saved permanently   │
└─────────────────────────┘     └─────────────────────────┘
              │
              │ Push notification delivered
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       USER B (Service Provider)                     │
│                                                                     │
│  📱 MOBILE DEVICE                                                   │
│  ╔══════════════════════════════════════╗                          │
│  ║  📬 New Message from User A          ║                          │
│  ╠══════════════════════════════════════╣                          │
│  ║                                      ║                          │
│  ║  I like your profile and I wanna     ║                          │
│  ║  buy your service - User A           ║                          │
│  ║                                      ║                          │
│  ║  [Tap to open]                       ║                          │
│  ╚══════════════════════════════════════╝                          │
│                                                                     │
│  ✅ Sound/Vibration                                                 │
│  ✅ Badge count +1                                                  │
│  ✅ Lock screen notification                                        │
│  ✅ Notification center entry                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow

### Request Flow

```
User A → API → UsersService → Prisma (User B) → Event Emitter
                                              → Firebase (User B device)
                                              → Prisma (Notification)
                                              → Response (User A)
```

### Notification Flow

```
Build Template → Check FCM Token → Check Preferences
                                 → Send to FCM
                                 → Save to DB
                                 → Log Success/Error
```

---

## 🎯 Decision Tree

```
                    Inquiry Sent
                         │
                         ▼
                 Is currentUser valid?
                    /         \
                  Yes          No
                  /             \
                 ▼               ▼
        Send Email Event    Skip notification
                 │
                 ▼
        Send Firebase Notification?
                 │
         ┌───────┴───────┐
         │               │
    Has FCM Token?   Preferences OK?
         │               │
      Yes/No          Yes/No
         │               │
         └───────┬───────┘
                 │
                 ▼
         ┌─────────────┐
         │   Success?  │
         └─────────────┘
         /             \
       Yes              No
       /                 \
      ▼                   ▼
  Send + Save        Log Error
  Continue          Continue
      \                 /
       \               /
        ▼             ▼
      Return User Profile
      (Inquiry always succeeds)
```

---

## ⚡ Performance Impact

### Before (Existing)

```
1. Database query (User B)    : ~50-100ms
2. Database query (Rating)    : ~20-50ms
3. Database query (User A)    : ~20-50ms
4. Event emit (async)         : ~1ms
5. Return response            : Immediate
─────────────────────────────────────────
Total: ~100-200ms
```

### After (With Firebase)

```
1. Database query (User B)    : ~50-100ms
2. Database query (Rating)    : ~20-50ms
3. Database query (User A)    : ~20-50ms
4. Event emit (async)         : ~1ms
5. Firebase notification      : ~50-150ms (async)
6. Database save (notification): ~20-50ms (async)
7. Return response            : Immediate
─────────────────────────────────────────
Total: ~100-200ms (same as before)
Firebase executes asynchronously after response
```

**Result:** ✅ No performance degradation

---

## 🔍 Error Handling Paths

### Happy Path ✅

```
Inquiry → Fetch Data → Emit Event → Send Firebase
       → Save DB → Log Success → Return Response
```

### User Has No FCM Token ⚠️

```
Inquiry → Fetch Data → Emit Event → Try Firebase
       → No FCM Token → Log Warning → Return Response
(Inquiry succeeds, notification skipped)
```

### Firebase Service Down ⚠️

```
Inquiry → Fetch Data → Emit Event → Try Firebase
       → Firebase Error → Catch → Log Error → Return Response
(Inquiry succeeds, notification failed gracefully)
```

### User Disabled Notifications ⚠️

```
Inquiry → Fetch Data → Emit Event → Check Preferences
       → Disabled → Skip Firebase → Return Response
(Inquiry succeeds, notification respects user preference)
```

---

## 📱 Mobile App Integration

### iOS (Swift)

```swift
// User B's app receives notification
func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification
) {
    let userInfo = notification.request.content.userInfo
    let type = userInfo["type"] as? String // "NEW_MESSAGE"
    let senderId = userInfo["senderId"] as? String

    // Show in-app notification or navigate to inquiry screen
}
```

### Android (Kotlin)

```kotlin
// User B's app receives notification
override fun onMessageReceived(message: RemoteMessage) {
    val type = message.data["type"] // "NEW_MESSAGE"
    val senderId = message.data["senderId"]

    // Show notification or navigate to inquiry screen
}
```

### React Native

```javascript
// User B's app receives notification
messaging().onMessage(async (remoteMessage) => {
    const type = remoteMessage.data.type; // "NEW_MESSAGE"
    const senderId = remoteMessage.data.senderId;

    // Show in-app notification or navigate to inquiry screen
});
```

---

## 📈 Success Metrics

### What to Monitor:

- ✅ Notification delivery rate
- ✅ Notification open rate
- ✅ Time to first response
- ✅ Conversion rate (inquiry → order)

### Firebase Console Metrics:

- Total notifications sent
- Successful deliveries
- Failed deliveries
- Device platforms (iOS/Android/Web)

---

## 🎉 Summary

**Your inquiry feature now:**

- ✅ Sends real-time push notifications
- ✅ Works across all platforms (iOS, Android, Web)
- ✅ Saves notification history to database
- ✅ Respects user preferences
- ✅ Handles errors gracefully
- ✅ Maintains existing functionality
- ✅ Zero breaking changes

**Implementation is complete and ready to use!** 🚀
