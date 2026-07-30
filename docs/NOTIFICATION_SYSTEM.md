# Notification System Documentation

> **System:** JConnect Backend
> **Stack:** NestJS + Prisma + PostgreSQL + Socket.IO + Firebase Cloud Messaging (FCM)
> **Last Updated:** July 30, 2026

This document describes the entire notification surface of the backend. It covers two parallel
channels that work together:

1. **Firebase Cloud Messaging (FCM)** — push notifications to mobile / web devices.
2. **Socket.IO gateways** — real-time in-app events (chat, order, repost, notification).

It also documents the persistence layer (in-app notification history) and the user-level
toggles that control which notifications get delivered.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Notification Channels](#2-notification-channels)
3. [FCM (Push Notifications)](#3-fcm-push-notifications)
   - 3.1 [Setup & Environment](#31-setup--environment)
   - 3.2 [Token Lifecycle](#32-token-lifecycle)
   - 3.3 [NotificationTemplate & NotificationType](#33-notificationtemplate--notificationtype)
   - 3.4 [Sending APIs](#34-sending-apis)
   - 3.5 [REST Endpoints](#35-rest-endpoints)
   - 3.6 [Per-User Notification Toggles](#36-per-user-notification-toggles)
   - 3.7 [Database Persistence (Notification + UserNotification)](#37-database-persistence-notification--usernotification)
4. [Socket.IO Gateways](#4-socketio-gateways)
   - 4.1 [`/notification` — NotificationGateway](#41-notification--notificationgateway)
   - 4.2 [`/order` — OrderGateway](#42-order--ordergateway)
   - 4.3 [`/dj/chat` — PrivateChatGateway](#43-djchat--privatechatgateway)
   - 4.4 [Custom-service-request & repost gateways](#44-custom-service-request--repost-gateways)
5. [Event Catalog](#5-event-catalog)
6. [Quick Recipes](#6-quick-recipes)
7. [Troubleshooting & FAQ](#7-troubleshooting--faq)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                          CLIENT (App / Web)                      │
│   • Holds FCM token (mobile)                                     │
│   • Maintains Socket.IO connection to relevant namespace(s)     │
└──────────────────┬───────────────────────────┬───────────────────┘
                   │                           │
            REST / HTTP                   WebSocket
                   │                           │
┌──────────────────▼───────────────────────────▼───────────────────┐
│                       NestJS Backend                             │
│                                                                  │
│   ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐   │
│   │  Controllers    │  │   Services      │  │  Gateways      │   │
│   │  /firebase-*    │  │ FirebaseNotif.  │  │ /notification  │   │
│   │  /notification* │  │ NotificationSett│  │ /order         │   │
│   │  /orders        │  │ OrdersService   │  │ /dj/chat       │   │
│   │  /private-chat  │  │ PrivateChatServ │  │ /repost*       │   │
│   └────────┬────────┘  └────────┬────────┘  └───────┬────────┘   │
│            │                   │                   │            │
│            └─────────────┬─────┴───────┬───────────┘            │
│                          ▼             ▼                        │
│            ┌──────────────────┐  ┌────────────────┐              │
│            │  PrismaService   │  │ Firebase Admin │              │
│            │  (PostgreSQL)    │  │     SDK        │              │
│            └──────────────────┘  └───────┬────────┘              │
└──────────────────────────────────────────┼───────────────────────┘
                                           │
                                           ▼
                              ┌────────────────────────┐
                              │  Firebase Cloud Msg.   │
                              │  → APNs (iOS)          │
                              │  → FCM (Android/Web)   │
                              └────────────────────────┘
```

### Source-of-truth model

| Concern | Owner |
| ------- | ----- |
| Push delivery | `FirebaseMessagingService` + `FirebaseNotificationService` |
| Per-user preferences | `NotificationToggle` row (`@prisma/notification-toggle`) |
| Notification history | `Notification` + `UserNotification` (Prisma) |
| In-app real-time feed | `NotificationGateway` (`/notification`) |
| Chat real-time | `PrivateChatGateway` (`/dj/chat`) |
| Order real-time | `OrderGateway` (`/order`) |
| Repost real-time | `Repost*Gateway` (`/repost-order`, `/repost-listing`) |

---

## 2. Notification Channels

There are **three** distinct channels, each useful for a different scenario:

| Channel | Latency | Use case | Survives app backgrounding? |
| ------- | ------- | -------- | --------------------------- |
| **FCM push** | Async (queued by Google) | OS-level banner/alert when app is closed | ✅ Yes |
| **Socket.IO** | Realtime (<100ms) | In-app banners, chat updates, live timers | ❌ No (needs open socket) |
| **In-app history (DB)** | Read on demand | Notification list, badge counts | ✅ Yes |

> Best practice: emit on **both** Socket.IO and FCM. The Socket.IO event powers the in-app
> toast/banner, while FCM ensures the user is alerted even if the app is killed.

---

## 3. FCM (Push Notifications)

### 3.1 Setup & Environment

The Firebase Admin SDK is initialized exactly once in `FirebaseAdminProvider`:

```ts
// src/lib/firebase/firebase.admin.provider.ts
admin.initializeApp({
    credential: admin.credential.cert({
        projectId:        process.env.FIREBASE_PROJECT_ID,
        clientEmail:      process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:       process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
});
```

Required `.env` variables:

```dotenv
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

The module is registered globally in `src/lib/lib.module.ts` so any module can inject
`FirebaseMessagingService` or `FirebaseNotificationService`.

### 3.2 Token Lifecycle

1. **Mobile/Web client** receives a token from the FCM SDK.
2. **Client → Backend** — `POST /firebase-notifications/update-fcm-token` with body
   `{ fcmToken: string, platform?: 'android'|'ios'|'web', deviceId?: string }`.
3. **Backend** — `FirebaseNotificationService.updateFcmToken(userId, fcmToken)`
   persists the token on the `User` row.

```ts
// src/main/shared/notification/firebase-notification.service.ts
async updateFcmToken(userId: string, fcmToken: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { fcmToken } });
}
```

Tokens are also validated lazily when sending (see `verifyToken` / `cleanupInvalidTokens`)
and removed if FCM rejects them.

### 3.3 NotificationTemplate & NotificationType

`NotificationTemplate` is the typed envelope for any push:

```ts
interface NotificationTemplate {
    title: string;
    body: string;
    type: NotificationType;       // used by toggle filtering
    data?: Record<string, string>; // custom payload (URLs, ids)
}
```

`NotificationType` (defined in `src/lib/firebase/dto/notification.dto.ts`) is a string union:

| Type | Used for |
| ---- | -------- |
| `NEW_MESSAGE` | Private chat |
| `NEW_FOLLOWER`, `NEW_LIKE`, `NEW_COMMENT` | Social graph |
| `SERVICE_REQUEST` | Generic service request |
| `SERVICE_REQUEST_ACCEPTED` / `_DECLINED` | Service-request lifecycle |
| `ORDER_UPDATE`, `NEW_ORDER` | Order status changes |
| `PAYMENT_RECEIVED` | Escrow release |
| `REVIEW_RECEIVED` | New seller review |
| `UPLOAD_PROOF` | Seller uploaded proof files |
| `SERVICE_UPDATE` | Listing updates |
| `ANNOUNCEMENT`, `CUSTOM` | Admin/manual |
| `follow` | Follower notification |

Use `buildNotificationTemplate(type, data)` to get a pre-formatted title/body for any
type — it produces a `NotificationTemplate` based on the registered template at the
bottom of `FirebaseNotificationService`.

### 3.4 Sending APIs

All FCM sends go through `FirebaseNotificationService` (high-level) which:
1. Resolves the user's FCM token from DB.
2. Filters against `NotificationToggle`.
3. Delegates to `FirebaseMessagingService.sendToDevice` / `sendToMultipleDevices` /
   `sendToTopic`.
4. Optionally saves the notification to the DB.

```ts
// Send to a single user
const result = await this.firebaseNotificationService.sendToUser(
    buyerId,
    {
        title: "Order Accepted",
        body:  "Seller has accepted your order",
        type:  NotificationType.ORDER_UPDATE,
        data:  { orderId, orderCode, status: "IN_PROGRESS" },
    },
    true, // saveToDb
);

// Send to many users
await this.firebaseNotificationService.sendToMultipleUsers(
    [userId1, userId2, userId3],
    { title, body, type: NotificationType.ANNOUNCEMENT },
    true,
);

// Send to a topic (broadcast)
await this.firebaseNotificationService.sendToTopic("all_users", template);
```

Each call returns:

```ts
{ success: boolean, messageId?: string, error?: string }
```

or, for `sendToMultipleUsers`:

```ts
{ successCount: number, failureCount: number }
```

### 3.5 REST Endpoints

All under `/firebase-notifications`:

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `POST` | `/update-fcm-token` | Bearer | Persist the device token |
| `POST` | `/subscribe-topic` | Bearer | Subscribe user to a topic |
| `POST` | `/unsubscribe-topic` | Bearer | Unsubscribe from a topic |
| `POST` | `/test/:userId` | Bearer | Send a test notification (dev) |

The `NotificationSettingController` exposes per-user preferences under
`/notification-setting`:

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET`  | `/notification-setting` | Get current user's toggle row |
| `PATCH` | `/notification-setting` | Update toggles |
| `GET`  | `/notification-setting/user-specific-notification` | List user's notifications (latest 50) |
| `PATCH` | `/notification-setting/mark-read/:notificationId` | Mark one as read |
| `PATCH` | `/notification-setting/mark-all-read` | Mark all as read |
| `DELETE` | `/notification-setting/:notificationId` | Delete a notification |
| `GET`  | `/notification-setting/unread-count` | Get unread count |

### 3.6 Per-User Notification Toggles

The `NotificationToggle` Prisma model (see `prisma/schema/notification-toggle.prisma`)
stores one row per user with per-category booleans:

```
email, userUpdates, serviceCreate, review, post, message, Inquiry,
userRegistration, Service, follow, ORDER_UPDATE, UploadProof,
PaymentReminder, NEW_ORDER, UPLOAD_PROOF, SERVICE_REQUEST_ACCEPTED,
SERVICE_REQUEST_REJECTED, SERVICE_REQUEST_CANCELLED, PAYMENT_SUCCESSFUL,
PAYMENT_FAILED, INQUIRY_RESPONSE, REVIEW_RECEIVED, POST_LIKED,
POST_COMMENTED, POST_SHARED, POST_REPLIED, …
```

Before any send, `FirebaseNotificationService.checkNotificationSettings` resolves the
toggle column for the requested `NotificationType`. If the toggle is `false`, the push
is **not sent** and the function returns `{ success: false, error: "User has disabled..." }`.

| `NotificationType` | Toggle column |
| ------------------ | ------------- |
| `NEW_MESSAGE` | `message` |
| `SERVICE_REQUEST*` | `Service` |
| `REVIEW_RECEIVED` | `review` |
| `ANNOUNCEMENT` | `post` |
| `ORDER_UPDATE` | `ORDER_UPDATE` |
| `PAYMENT_RECEIVED` | `PaymentReminder` |

### 3.7 Database Persistence (Notification + UserNotification)

When `saveToDb=true` and the FCM call (or notification eligibility check) succeeds,
`FirebaseNotificationService.saveNotificationToDb` writes:

- One row to `Notification` (id, userId, title, message, metadata JSON).
- One row to `UserNotification` (userId, notificationId, type, read=false).

`mapToPrismaNotificationType` converts the high-level `NotificationType` to a value
matching the `NotificationType` enum in `prisma/schema/notification.prisma`:

```
NotificationType.SERVICE_REQUEST → "Service"
NotificationType.PAYMENT_RECEIVED → "Payment"
NotificationType.NEW_MESSAGE      → "Inquiry"
NotificationType.SERVICE_REQUEST_DECLINED → "Service"
…
```

Users then read this history via `GET /notification-setting/user-specific-notification`.

---

## 4. Socket.IO Gateways

Each gateway is a NestJS `@WebSocketGateway` with its own namespace. All namespaces
enable CORS for any origin (`cors: { origin: "*" }`).

| Namespace | File | Purpose |
| --------- | ---- | ------- |
| `/notification` | `src/main/shared/notification/notification-gateway/notification.gateway.ts` | In-app notification feed |
| `/order` | `src/main/order/order.gateway.ts` | Order lifecycle events |
| `/dj/chat` | `src/main/shared/private-message/privateChatGateway/privateChatGateway.ts` | Private 1:1 chat + service-request cards |
| `/repost-order` | `src/main/repost-order/.../repost-order.gateway.ts` | Repost order lifecycle |
| `/repost-listing` | `src/main/repost-listing/.../repost-listing.gateway.ts` | Repost listing events |

### 4.1 `/notification` — NotificationGateway

This is the **canonical in-app notification stream**. It tracks sockets in an
in-memory `Map<userId, Set<Socket>>` so the same user can be online from multiple
devices.

#### Connection

```js
const socket = io("wss://api.example.com/notification", {
    auth: { token: `Bearer ${jwt}` },     // or Authorization header
    transports: ["websocket"],
});
```

On connect the gateway:
1. Verifies the JWT via `JwtService`.
2. Loads `User` + `NotificationToggle`.
3. Auto-creates a `NotificationToggle` row if missing.
4. Builds a `PayloadForSocketClient` (the user's toggles) and stores it on
   `client.data.user`.
5. Adds the socket to the user's set.

#### Client ↔ Server

| Direction | Event | Payload |
| --------- | ----- | ------- |
| C → S | `ping` | — |
| S → C | `pong` | — |
| C → S | `EVENT_TYPES.USERREGISTRATION_CREATE` | `purpose` string |

#### Helpers

```ts
notifySingleUser(userId, event, data)
notifyMultipleUsers(userIds, event, data)
notifyAllUsers(event, data)
```

#### Event-emitter bridge

`NotificationGateway` is also a **listener** for `@nestjs/event-emitter` events.
When a domain module emits one of these, the gateway fans it out:

| `EVENT_TYPES` constant | Domain emitter | What it does |
| ---------------------- | -------------- | ------------ |
| `user.create` | Auth service | New user registration → fanout to admins |
| `service.create` | Service service | New listing created |
| `inquiry.create` | Inquiry service | New inquiry/incoming request |
| `service_request.accepted` | Service-request service | Seller accepted a request |
| `service_request.declined` | Service-request service | Seller declined a request |

For each event the gateway:
1. Filters recipients by their `NotificationToggle` row.
2. Persists to `Notification` + `UserNotification`.
3. Pushes a `Notification` envelope to every connected socket of each recipient.

`Notification` envelope:

```ts
interface Notification {
    type: string;             // event type id
    title: string;
    message: string;
    createdAt: Date;
    meta: Record<string, any>;
}
```

#### Minimal client example

```js
socket.on("user.create", (n)      => console.log("registration", n));
socket.on("service.create", (n)   => console.log("new service", n));
socket.on("inquiry.create", (n)   => console.log("inquiry", n));
socket.on("service_request.accepted", (n) => console.log("accepted", n));
socket.on("service_request.declined", (n) => console.log("declined", n));
```

### 4.2 `/order` — OrderGateway

Namespace: `wss://<host>/order`. Documented in detail in
[`ORDER_SOCKET_GUIDE.md`](./ORDER_SOCKET_GUIDE.md).

Highlights relevant to the notification system:

- Auto-joins the buyer/seller to a personal room `<userId>` on connect.
- Optional per-order room `order:<orderId>` via `order:join_order`.
- Events: `order:created`, `order:in_progress`, `order:proof_submitted`,
  `order:released`, `order:cancelled`, `order:delivery_date_updated`,
  `order:proof_cancelled`, `order:deleted`, `order:service_request_updated`.

> When `OrderService.updateStatus` runs, it calls `OrderGateway.emitStatusChange` so
> the matching event is fanned out to **both** the buyer and seller (and to any
> socket that joined `order:<orderId>`). The same call site also dispatches a
> `FirebaseNotificationService.sendToUser(...)` push for the buyer.

### 4.3 `/dj/chat` — PrivateChatGateway

Namespace: `wss://<host>/dj/chat`. Documented in detail in
[`PRIVATE_MESSAGE_SOCKET_GUIDE.md`](./PRIVATE_MESSAGE_SOCKET_GUIDE.md) and
[`SERVICE_REQUEST_UPDATE_SOCKET_GUIDE.md`](./SERVICE_REQUEST_UPDATE_SOCKET_GUIDE.md).

Highlights:

- `private:new_message`, `private:send_message` — 1:1 chat.
- `private:new_conversation`, `private:conversation_list` — conversation list updates.
- `serviceRequestUpdated` — emitted by `PrivateChatService.updateIsDeclined` so the
  chat card flips between **Paid / Accepted / Declined** in real time.
- `serviceRequestFilesUpdated` — emitted by `PrivateChatService.updateUploadedFiles`
  when the buyer resubmits files after a decline.

`PrivateChatService` also calls `OrderGateway.emitServiceRequestUpdated(...)` so that
the order info page on the **buyer side** gets the same event and refreshes its
promotion info / timeline.

### 4.4 Custom-service-request & repost gateways

Each repost module owns its own namespace and follows the same pattern as
`OrderGateway`. See:
- `docs/REPOST_SOCKET_GUIDE.md`
- `docs/CUSTOM_SERVICE_REQUEST_SOCKET_INTEGRATION.md`

---

## 5. Event Catalog

A consolidated view of every event the system emits. The `Channel` column tells you
where to listen.

| Event | Channel | Payload | Trigger |
| ----- | ------- | ------- | ------- |
| `order:created` | Socket `/order` + FCM (`NEW_ORDER`) | Order row | `POST /payments/make-payment` |
| `order:in_progress` | Socket `/order` + FCM (`ORDER_UPDATE`) | Order row | Seller sets status to `IN_PROGRESS` |
| `order:proof_submitted` | Socket `/order` + FCM (`UPLOAD_PROOF`) | Order row + proof URLs | `POST /orders/ProofUpload` |
| `order:released` | Socket `/order` + FCM (`PAYMENT_RECEIVED`) | Order row | Buyer confirms delivery / admin capture |
| `order:cancelled` | Socket `/order` + FCM (`ORDER_UPDATE`) | Order row | Order cancelled/refunded |
| `order:delivery_date_updated` | Socket `/order` | Order row | `PATCH /orders/:id/delivery-date` |
| `order:proof_cancelled` | Socket `/order` | Order row | `PATCH /orders/:id/cancel-proof?isCancalProofSubmitted=true` |
| `order:deleted` | Socket `/order` | Order row | `DELETE /orders/delete/:orderId` |
| `order:service_request_updated` | Socket `/order` | `{ ...serviceRequest, orderId, timestamp }` | Seller accept/decline OR buyer resubmit |
| `private:new_message` | Socket `/dj/chat` | `Message` row | `private:send_message` client event |
| `private:new_conversation` | Socket `/dj/chat` | Conversation list | New chat created |
| `serviceRequestUpdated` | Socket `/dj/chat` | ServiceRequest row | Seller accept/decline |
| `serviceRequestFilesUpdated` | Socket `/dj/chat` | ServiceRequest row | Buyer resubmits files |
| `user.create` | Socket `/notification` + DB | `Notification` | New user registered |
| `service.create` | Socket `/notification` + DB | `Notification` | New service listed |
| `inquiry.create` | Socket `/notification` + DB | `Notification` | New inquiry/incoming request |
| `service_request.accepted` | Socket `/notification` + DB | `Notification` | Seller accepts |
| `service_request.declined` | Socket `/notification` + DB | `Notification` | Seller declines |

---

## 6. Quick Recipes

### 6.1 Send a push + persist history (most common)

```ts
const tpl = this.firebaseNotificationService.buildNotificationTemplate(
    NotificationType.SERVICE_REQUEST_ACCEPTED,
    {
        sellerName,
        serviceName,
        serviceRequestId,
        serviceId,
        sellerId,
    },
);

await this.firebaseNotificationService.sendToUser(buyerId, tpl, true);
```

### 6.2 Broadcast to every connected user

```ts
await this.firebaseNotificationService.sendToTopic("all_users", {
    title: "Maintenance in 30 minutes",
    body:  "We will be deploying a fix at 14:00 UTC.",
    type:  NotificationType.ANNOUNCEMENT,
});
```

### 6.3 Emit a real-time order update + Socket fanout + push

`OrdersService.updateStatus` does all three in one place:

```ts
this.orderGateway.emitStatusChange(updated);

await this.firebaseNotificationService.sendToUser(
    order.buyerId,
    {
        title: "✅ Order Accepted",
        body:  "Seller has accepted your order",
        type:  NotificationType.ORDER_UPDATE,
        data:  { orderId, orderCode, status: "IN_PROGRESS" },
    },
    true,
);
```

### 6.4 Trigger an event-emitter notification

Useful when the emitter lives in a different module (e.g. auth emits `user.create`).

```ts
this.eventEmitter.emit(EVENT_TYPES.SERVICE_REQUEST_ACCEPTED, {
    info: {
        serviceRequestId: id,
        serviceId,
        serviceName,
        sellerId,
        sellerName,
        buyerId,
        status: "ACCEPTED",
        actionAt: new Date(),
    },
});
```

`NotificationGateway` will pick it up and (1) persist it, (2) push it to every socket
of users whose `NotificationToggle` allows it.

### 6.5 Make a socket client connect to multiple namespaces

```js
const notif   = io("/notification", { auth: { token } });
const order   = io("/order",       { auth: { token } });
const chat    = io("/dj/chat",     { auth: { token } });

notif.on("service_request.accepted", n => refresh(n));
order.on("order:in_progress",        o => timeline(o));
chat .on("serviceRequestUpdated",   s => refreshCard(s));
```

---

## 7. Troubleshooting & FAQ

**Q. The push is not received even though `success: true` is returned.**
- Check the user has a non-empty `fcmToken` in `User`.
- Confirm `NotificationToggle` allows that `NotificationType`. The function
  silently returns `{ success: false, error: 'User has disabled…' }` if disabled.
- For iOS, ensure the device has granted notification permission and the APNS key is
  configured in the Firebase project.

**Q. Socket connects then immediately disconnects.**
- You forgot the JWT. The gateway emits `*:error` then `client.disconnect(true)`.
- The JWT is valid but the user doesn't exist in the DB.

**Q. The notification appears in the DB but no Socket.IO event reaches the client.**
- The user has no open socket (tab closed / app backgrounded). In that case you must
  rely on FCM.
- Or the user's `NotificationToggle` for that `NotificationType` is off. The gateway
  filters before emitting.

**Q. Order events arrive twice.**
- You joined both the personal `<userId>` room and the per-order `order:<orderId>`
  room. That's expected — events are emitted to both. Filter by event name on the
  client side if you need to de-dup.

**Q. How do I subscribe a user to a topic?**
```ts
await this.firebaseNotificationService.subscribeUserToTopic(userId, "news");
```
Or hit `POST /firebase-notifications/subscribe-topic` with `{ topic: "news" }`.

**Q. The FCM Admin SDK initialization throws "already initialized".**
The provider guards with `if (admin.apps.length === 0)`. If you see this error, ensure
`FirebaseAdminProvider` is only registered once — typically via the global
`FirebaseModule` in `src/lib/lib.module.ts`.

---

## Appendix A — File map

```
src/lib/firebase/
├── firebase.admin.provider.ts          # admin.initializeApp(...)
├── firebase-messaging.service.ts       # low-level FCM SDK wrappers
├── firebase.module.ts                  # @Global() module
└── dto/notification.dto.ts             # DTOs + NotificationType enum

src/main/shared/notification/
├── firebase-notification.service.ts    # high-level FCM facade
├── firebase-notification.controller.ts # /firebase-notifications REST
├── notification.service.ts             # CRUD over Notification + UserNotification
├── notification.controller.ts          # /notification-setting REST
├── notification.module.ts              # exports both services
├── notification-gateway/
│   ├── notification.gateway.ts         # /notification Socket.IO gateway
│   └── notification-gateway.module.ts  # @Global() module
├── interface/
│   ├── events.name.ts                  # EVENT_TYPES + meta interfaces
│   ├── events-payload.ts               # Notification envelope + event shapes
│   ├── queue-name.ts                   # legacy queue identifiers
│   └── socket-client-payload.ts        # toggle flags exposed to socket client
├── entities/notification.entity.ts
└── dto/create-notification.dto.ts

src/main/order/order.gateway.ts          # /order namespace
src/main/shared/private-message/privateChatGateway/privateChatGateway.ts  # /dj/chat
```

## Appendix B — Module registration cheat-sheet

| Module | File | Imports |
| ------ | ---- | ------- |
| `LibModule` (`src/lib/lib.module.ts`) | `FirebaseModule`, `NotificationModuleGateway` (both `@Global()`) |
| `NotificationModule` | `NotificationSettingService`, `FirebaseNotificationService` |
| `OrdersModule` | `StripeModule`, `NotificationModule`, `ConfigModule`, `PrivateMessageModule` |
| `PrivateMessageModule` | `NotificationModule`, `OrdersModule` |
| `PaymentsModule` | `StripeModule`, `NotificationModule`, `OrdersModule`, `PrivateMessageModule` |

Both `FirebaseModule` and `NotificationModuleGateway` are `@Global()`, so any service
can inject `FirebaseMessagingService`, `FirebaseNotificationService`, or
`NotificationGateway` without re-importing.