# Da Connect — API Developer Guide

> **Base URL**: `http://localhost:3000` (development) | `https://api.daconnect.com` (production)  
> **Auth**: All protected routes require `Authorization: Bearer <JWT_TOKEN>` header.  
> **Swagger UI**: `{BASE_URL}/api`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [User Profiles & Verification](#2-user-profiles--verification)
3. [Repost Listings (Marketplace)](#3-repost-listings-marketplace)
4. [Repost Orders (Buyer & Seller Flow)](#4-repost-orders-buyer--seller-flow)
5. [Services (Professional)](#5-services-professional)
6. [Social Service Listings](#6-social-service-listings)
7. [Orders (Service Orders)](#7-orders-service-orders)
8. [Payments & Escrow](#8-payments--escrow)
9. [Reviews](#9-reviews)
10. [Notifications](#10-notifications)
11. [Disputes](#11-disputes)
12. [Admin Endpoints](#12-admin-endpoints)
13. [Enums Reference](#13-enums-reference)
14. [Notification Types Reference](#14-notification-types-reference)
15. [Order State Machines](#15-order-state-machines)
16. [WebSocket Reference — Repost](#16-websocket-reference--repost)

---

## 1. Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register with email & password |
| POST | `/auth/login` | Login → returns JWT |
| POST | `/auth/verify-otp` | Verify email OTP |
| POST | `/auth/google` | Google OAuth login |
| POST | `/auth/firebase` | Firebase (Google/Apple) login |
| POST | `/auth/phone-login` | Phone OTP login |
| POST | `/auth/forgot-password` | Send password reset email |
| POST | `/auth/reset-password` | Reset password with token |
| DELETE | `/auth/logout` | Logout (clears device token) |

**JWT Payload**
```json
{ "sub": "user-uuid", "email": "user@email.com", "roles": "ARTIST" }
```

---

## 2. User Profiles & Verification

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/me` | USER | Get own profile |
| PATCH | `/users/me` | USER | Update profile + upload photo |
| GET | `/users/check-username/:username` | Public | Check username availability |
| GET | `/users/artists` | USER | Browse all artists |
| GET | `/users/admin/unverified-profiles` | ADMIN | List users pending verification |
| PATCH | `/users/admin/verify-profile/:userId?approve=true` | ADMIN | Approve/reject verified badge |

### Profile Verification Flow (Admin)
```
1. Admin: GET /users/admin/unverified-profiles
2. Admin: PATCH /users/admin/verify-profile/{userId}?approve=true
   → User receives push: "Profile Verified" or "Profile Verification Rejected"
   → isProfileVerified field updated on User
```

---

## 3. Repost Listings (Marketplace)

Sellers (Artists) create repost listings per platform. Buyers browse and purchase.  
When a seller creates a new listing, **all their followers receive a push notification** (`FOLLOWED_SELLER_NEW_LISTING`).

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/repost-listings` | ARTIST | Create a listing |
| GET | `/repost-listings` | USER | Browse marketplace (`?platform=TIKTOK&spotlight=true`) |
| GET | `/repost-listings/spotlight` | USER | $1 Repost Spotlight listings |
| GET | `/repost-listings/following` | USER | Listings from sellers you follow |
| GET | `/repost-listings/my-listings` | ARTIST | My listings |
| GET | `/repost-listings/dashboard` | ARTIST | My listings with order counts |
| GET | `/repost-listings/:id` | USER | Get listing details |
| PATCH | `/repost-listings/:id` | ARTIST | Update listing |
| PATCH | `/repost-listings/:id/toggle-pause` | ARTIST | Pause or reactivate |
| DELETE | `/repost-listings/:id` | ARTIST | Delete listing |

### Create Listing Body
```json
{
  "platform": "INSTAGRAM_STORY",
  "price": 1.00,
  "followerCount": 15000,
  "description": "I will repost your content to my 15k followers"
}
```

### $1 Repost Spotlight
Listings priced exactly `$1.00` are **automatically** enrolled in the Spotlight program:
- `isSpotlight: true` is set automatically on create/update
- Featured first in marketplace results (`GET /repost-listings/spotlight`)
- Seller receives `LISTING_FEATURED` push notification

### Following Feed
`GET /repost-listings/following` returns only active listings from sellers the authenticated user follows.  
Results are ordered: spotlight first → newest first. Returns `[]` if the user follows no one.

### Platform Enum Values
`INSTAGRAM_STORY` | `INSTAGRAM_FEED` | `TIKTOK` | `YOUTUBE` | `FACEBOOK` | `TWITTER`

---

## 4. Repost Orders (Buyer & Seller Flow)

### Confirmed Buyer Flow (9 screens)
```
Screen 1 → Screen 2      → Screen 3       → Screen 4        → Screen 5
Select      Add Content     Make Payment     Set Timeframe     [Order submitted]
Service     URL (buyer)     (buyer, Stripe)  (buyer)
                                                               ↓
                                                         Screen 5: Seller Accepts
                                                         Screen 6: Seller Submits Proof
                                                         Screen 7: Buyer Reviews Proof
                                                         Screen 8: 1-Hour Review Window
                                                         Screen 9: Funds Released
```

### Order Status Lifecycle
```
NEW_REQUEST → ACCEPTED → PROOF_SUBMITTED → COMPLETED
                                         ↘ REDO_REQUESTED → PROOF_SUBMITTED (loop, max 3×)
           → REJECTED
           → REFUNDED  (countdown expired / buyer rejected / redo window expired)
```

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/repost-orders` | USER | Buyer: create order (screens 1–4 combined) |
| POST | `/repost-orders/:id/accept` | USER | Seller: accept request (screen 5) |
| POST | `/repost-orders/:id/reject` | USER | Seller: reject request (screen 5) |
| POST | `/repost-orders/:id/submit-proof` | USER | Seller: submit proof (screen 6) |
| POST | `/repost-orders/:id/review` | USER | Buyer: accept / reject / redo (screen 7) |
| GET | `/repost-orders/my-orders` | USER | Buyer: my orders (`?status=ACCEPTED`) |
| GET | `/repost-orders/my-seller-orders` | USER | Seller: orders on my listings |
| GET | `/repost-orders/:id` | USER | Get single order (includes `timeRemaining`) |

---

### Screen 1 → 4 — Buyer Creates Order

Screens 1–4 collect data client-side. Everything is submitted in **one API call** at the end of screen 4.

```
Screen 1 — Buyer selects a listing  →  listingId captured
Screen 2 — Buyer pastes content URL  →  contentUrl captured
Screen 3 — Buyer pays via Stripe SDK  →  paymentIntentId captured
Screen 4 — Buyer selects timeframe  →  timeframe captured → POST /repost-orders
```

```json
POST /repost-orders
{
  "listingId":       "uuid",
  "contentUrl":      "https://instagram.com/p/abc123",
  "paymentIntentId": "pi_stripe_xxx",
  "timeframe":       "ONE_HOUR"
}
```

> **Note:** `platform` and `amount` are **not** sent by the client.
> - `platform` is derived from the selected listing automatically.
> - `amount` is fixed at **$1 (100 cents)** for all repost orders.

**On success:**
- Countdown starts immediately (`countdownEndsAt = now + timeframe`)
- `platformFee = 10 cents`, `sellerAmount = 90 cents`
- Seller receives `REPOST_NEW_REQUEST` push
- Buyer receives `REPOST_ORDER_SUBMITTED` + `ESCROW_FUNDS_HELD` pushes

---

### Screen 5 — Seller Accepts / Rejects

Seller calls `GET /repost-orders/:id` to view the order and open `contentUrl` to review the content before deciding.

```
POST /repost-orders/{id}/accept  → status: ACCEPTED  (countdown active)
POST /repost-orders/{id}/reject  → status: REJECTED, buyer refunded
```

---

### Screen 6 — Seller Submits Proof

```
POST /repost-orders/{id}/submit-proof   (multipart/form-data)

Fields:
  proofType:  "SCREENSHOT" | "SCREEN_RECORDING" | "URL"
  proofUrl:   "https://..."   (required only when proofType = URL)
  files[]:    binary files    (required for SCREENSHOT or SCREEN_RECORDING, max 5)
```

- Files are uploaded to S3 automatically
- `reviewWindowEndsAt = now + 1 hour` — buyer has 1 hour to review
- If buyer does not act within 1 hour → **escrow auto-released to seller**

---

### Screen 7 — Buyer Reviews Proof

```json
POST /repost-orders/{id}/review
{ "action": "ACCEPT" }   → status: COMPLETED, escrow released to seller
{ "action": "REJECT" }   → status: REFUNDED, buyer gets money back
{ "action": "REDO"   }   → status: REDO_REQUESTED, seller has 30 min to resubmit (max 3×)
```

---

### Screen 8 — 1-Hour Review Window (Automatic)

The scheduler runs every minute. If `reviewWindowEndsAt` has passed and buyer has not acted:
- `status → COMPLETED`
- Escrow auto-released to seller
- Both parties notified: `ESCROW_FUNDS_RELEASED`

---

### Screen 9 — Funds Released

Upon completion (manual or auto-release):
- Seller receives: `REPOST_SELLER_FUNDS_RELEASED`
- Buyer receives: `REPOST_FUNDS_RELEASED`
- `isReleased: true`, `releasedAt` timestamp set

---

### Timeframe Values
| Enum | Duration |
|------|----------|
| `THIRTY_MIN` | 30 minutes |
| `ONE_HOUR` | 1 hour |
| `TWO_HOURS` | 2 hours |
| `SIX_HOURS` | 6 hours |
| `TWELVE_HOURS` | 12 hours |
| `TWENTY_FOUR_HOURS` | 24 hours |

---

### `timeRemaining` Response Field
Every `GET /repost-orders/:id` response includes:
```json
{
  "timeRemaining": {
    "expired": false,
    "ms": 3245000,
    "minutes": 54
  }
}
```
Use `minutes` or `ms` to drive your countdown UI (Screen 8).

---

### Countdown Alerts — Seller Only (Automatic)
The scheduler fires every minute and sends pushes to the seller automatically:

| Time Left | Notification |
|-----------|-------------|
| 60 min | `REPOST_EXPIRING_SOON` |
| 30 min | `REPOST_EXPIRING_SOON` |
| 15 min | `REPOST_EXPIRING_SOON` |
| 5 min | `REPOST_EXPIRING_SOON` |
| 0 min (expired, no proof) | Order → `REFUNDED`, buyer refunded |

---

## 5. Services (Professional)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/services` | ARTIST | Create service listing |
| GET | `/services` | USER | All services |
| GET | `/services/my_service` | ARTIST | My services |
| GET | `/services/:id` | USER | Service details |
| PATCH | `/services/:id` | ARTIST | Update service |
| DELETE | `/services/:id` | ARTIST | Delete service |

---

## 6. Social Service Listings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/social-service` | ARTIST | Create a social service listing |
| GET | `/social-service` | USER | All social service listings |
| GET | `/social-service/my-listings` | ARTIST | My social service listings |
| GET | `/social-service/:id` | USER | Get by ID |
| PATCH | `/social-service/:id` | ARTIST | Update (own only) |
| DELETE | `/social-service/:id` | ARTIST | Delete (own only) |

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/social-service-request` | USER | Create social service request |
| GET | `/social-service-request` | USER | All requests |
| GET | `/social-service-request/:id` | USER | Get by ID |
| PATCH | `/social-service-request/:id` | USER | Update request |
| DELETE | `/social-service-request/:id` | USER | Delete request |

---

## 7. Orders (Service Orders)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/orders/my-orders` | USER | Buyer's orders (`?status=PENDING`) |
| GET | `/orders/my_service_orders` | USER | Seller's service orders |
| GET | `/orders/my-earnings` | USER | Seller earnings summary |
| GET | `/orders/:id` | USER | Get order details |
| POST | `/orders/ProofUpload?orderId=` | USER | Seller: upload proof file |
| PATCH | `/orders/:id/status?status=` | USER | Update order status |
| PATCH | `/orders/:id/delivery-date` | USER | Update delivery date |
| PATCH | `/orders/:id/cancel-proof?isCancalProofSubmitted=` | USER | Cancel proof submission |
| DELETE | `/orders/delete/:orderId` | USER | Delete order (buyer/admin) |

### Service Order Status Flow
```
PENDING → IN_PROGRESS → PROOF_SUBMITTED → RELEASED
                      ↘ CANCELLED
```

---

## 8. Payments & Escrow

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/payments/create-customer` | USER | Create Stripe customer |
| POST | `/payments/setup-intent` | USER | Create setup intent |
| POST | `/payments/confirm-setup-intent` | USER | Confirm card |
| GET | `/payments/payment-methods` | USER | List saved cards |
| DELETE | `/payments/payment-methods/:id` | USER | Remove card |
| GET | `/payments/transactions` | USER | Transaction history |
| GET | `/payments/transactions/:id` | USER | Transaction detail |
| GET | `/payments/withdrawals` | USER | Withdrawal history |
| POST | `/payments/webhook` | Public | Stripe webhook |

**Escrow behavior:**
- Funds are held on order creation via `paymentIntentId`
- Released when buyer accepts proof OR 1-hour review window auto-expires
- Refunded when seller rejects, buyer rejects proof, or countdown expires

---

## 9. Reviews

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/reviews` | USER | Submit a review |
| GET | `/reviews/artist/:artistId` | USER | Artist's reviews |
| PATCH | `/reviews/:id` | USER | Edit review |
| DELETE | `/reviews/:id` | USER | Delete review |

---

## 10. Notifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| PATCH | `/notifications/fcm-token` | USER | Register device FCM token |
| GET | `/notifications` | USER | My notifications |
| GET | `/notifications/unread-count` | USER | Unread count |
| PATCH | `/notifications/:id/read` | USER | Mark one as read |
| PATCH | `/notifications/read-all` | USER | Mark all as read |
| DELETE | `/notifications/:id` | USER | Delete notification |

**FCM Token Registration** — call on every app open/login:
```json
PATCH /notifications/fcm-token
{ "fcmToken": "ExponentPushToken[xxx]", "platform": "android" }
```

**WebSocket** — connect to `ws://{host}` for real-time badge count updates.

---

## 11. Disputes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/disputes` | USER | Open a dispute (with file upload) |
| GET | `/disputes` | USER | All disputes |
| GET | `/disputes/my-disputes` | USER | My disputes |
| GET | `/disputes/:id` | USER | Dispute details |
| PATCH | `/disputes/:id/status` | ADMIN | Update dispute status |
| DELETE | `/disputes/:id` | ADMIN | Delete dispute |

---

## 12. Admin Endpoints

All admin endpoints require role: `ADMIN`, `SUPER_ADMIN`, `FINANCE_ADMIN`, or `SUPPORT_ADMIN`.

### Dashboard Stats
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/dashboard-stats/overview` | Users, revenue, disputes, refunds |
| GET | `/admin/dashboard-stats/revenue-by-month` | Monthly revenue chart (2 years) |
| GET | `/admin/dashboard-stats/top-sellers` | Top sellers with pagination |
| GET | `/admin/dashboard-stats/top-performing-users` | Top users by payment |
| GET | `/admin/dashboard-stats/user-activity-weekly` | Active vs inactive per day |
| GET | `/admin/dashboard-stats/totalPlatformRevenue` | Total platform revenue |

### User Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/admin/unverified-profiles` | Pending verifications |
| PATCH | `/users/admin/verify-profile/:userId?approve=true` | Approve/reject badge |
| PATCH | `/users/:id/role?role=ARTIST` | Change user role |
| DELETE | `/users/:id` | Delete user |

### Settings & Announcements
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/settings` | Platform settings |
| PATCH | `/settings` | Update platform settings |
| POST | `/settings/announcements` | Create announcement |
| GET | `/settings/announcements` | All announcements |
| DELETE | `/settings/announcements/:id` | Delete announcement |

---

## 13. Enums Reference

### Roles
| Value | Access Level |
|-------|-------------|
| `ARTIST` | Default — can create listings, receive orders |
| `USER` | Buyer only |
| `ADMIN` | Admin panel access |
| `SUPER_ADMIN` | Full access |
| `FINANCE_ADMIN` | Financial data access |
| `SUPPORT_ADMIN` | Dispute/support access |
| `ANALYST` | Read-only analytics |

### RepostPlatform
`INSTAGRAM_STORY` | `INSTAGRAM_FEED` | `TIKTOK` | `YOUTUBE` | `FACEBOOK` | `TWITTER`

### RepostOrderStatus
`NEW_REQUEST` | `ACCEPTED` | `PROOF_SUBMITTED` | `REDO_REQUESTED` | `COMPLETED` | `REJECTED` | `REFUNDED` | `DISPUTED`

### ProofType
`SCREENSHOT` | `SCREEN_RECORDING` | `URL`

### RepostTimeframe
`THIRTY_MIN` | `ONE_HOUR` | `TWO_HOURS` | `SIX_HOURS` | `TWELVE_HOURS` | `TWENTY_FOUR_HOURS`

### ServiceType (legacy)
`SOCIAL_POST` | `SERVICE`

---

## 14. Notification Types Reference

All notifications include `data.orderId` or `data.listingId` for deep linking.

### Repost — Follow
| Type | Recipient | When |
|------|-----------|------|
| `FOLLOWED_SELLER_NEW_LISTING` | Follower | A seller you follow created a new repost listing |

### Repost — Buyer Receives
| Type | When |
|------|------|
| `REPOST_ORDER_SUBMITTED` | After creating order (screen 4) |
| `REPOST_SELLER_ACCEPTED` | Seller accepted (screen 5) |
| `REPOST_SELLER_REJECTED` | Seller rejected — refund initiated |
| `REPOST_PROOF_SUBMITTED` | Seller submitted proof (screen 6) |
| `REPOST_REVIEW_WINDOW_STARTED` | 1-hour review window open (screen 8) |
| `REPOST_REDO_SUBMITTED` | Seller resubmitted revised proof |
| `REPOST_FUNDS_RELEASED` | Escrow released to seller (screen 9) |
| `REPOST_DISPUTE_UPDATED` | Dispute status changed |

### Repost — Seller Receives
| Type | When |
|------|------|
| `REPOST_NEW_REQUEST` | New order received (screen 5) |
| `REPOST_EXPIRING_SOON` | Countdown alert at 60 / 30 / 15 / 5 min |
| `REPOST_REQUEST_ACCEPTED` | Confirmed accept |
| `REPOST_PROOF_SENT` | Proof submitted confirmation (screen 6) |
| `REPOST_REDO_REQUESTED` | Buyer requested redo |
| `REPOST_SELLER_FUNDS_RELEASED` | Payment released (screen 9) |
| `REPOST_DISPUTE_OPENED` | Dispute opened |

### Escrow
| Type | Recipient | When |
|------|-----------|------|
| `ESCROW_FUNDS_HELD` | Buyer | On order creation (screen 3) |
| `ESCROW_REFUND_ISSUED` | Buyer | On seller rejection or countdown expiry |
| `ESCROW_FUNDS_RELEASED` | Both | On completion (screen 9) |
| `ESCROW_REFUND_PROCESSED` | Seller | Seller's proof was rejected by buyer |

### Listing Management — Seller
| Type | When |
|------|------|
| `LISTING_APPROVED` | New listing created (standard price) |
| `LISTING_FEATURED` | $1 listing auto-enrolled in spotlight |
| `LISTING_PAUSED` | Listing paused |
| `LISTING_REACTIVATED` | Listing reactivated |
| `LISTING_REMOVED` | Listing deleted |

### Performance — Seller
| Type | When |
|------|------|
| `NEW_REVIEW_RECEIVED` | Review posted on profile |
| `RATING_INCREASED` | Average rating went up |
| `RATING_DECREASED` | Average rating went down |
| `REPOST_MILESTONE` | Hit repost count milestone |
| `EARNINGS_MILESTONE` | Hit earnings milestone |

### System
| Type | When |
|------|------|
| `WELCOME` | First login |
| `PASSWORD_CHANGED` | Password updated |
| `LOGIN_DETECTED` | New device login |
| `PROFILE_VERIFICATION_APPROVED` | Admin verified badge |
| `PROFILE_VERIFICATION_REJECTED` | Admin rejected verification |

---

## 15. Order State Machines

### Repost Order
```
[Screen 1–4] Buyer: POST /repost-orders { listingId, contentUrl, paymentIntentId, timeframe }
    → status: NEW_REQUEST
    → platform derived from listing
    → amount fixed at $1 (100 cents)
    → platformFee: 10 cents | sellerAmount: 90 cents
    → countdown started (countdownEndsAt = now + timeframe)
    → escrow held

[Screen 5] Seller: POST /repost-orders/:id/accept
    → status: ACCEPTED

[Screen 5] Seller: POST /repost-orders/:id/reject
    → status: REJECTED
    → buyer refunded

[Screen 6] Seller: POST /repost-orders/:id/submit-proof
    → status: PROOF_SUBMITTED
    → reviewWindowEndsAt = now + 1 hour

[Screen 7] Buyer: POST /repost-orders/:id/review { action: "ACCEPT" }
    → status: COMPLETED, isReleased: true, releasedAt: now

[Screen 7] Buyer: POST /repost-orders/:id/review { action: "REJECT" }
    → status: REFUNDED

[Screen 7] Buyer: POST /repost-orders/:id/review { action: "REDO" }
    → status: REDO_REQUESTED
    → redoWindowEndsAt = now + 30 min
    → Seller resubmits → back to PROOF_SUBMITTED (max 3×)

[Scheduler — every minute]:
    if countdownEndsAt < now && status in (NEW_REQUEST | ACCEPTED)
        → status: REFUNDED, buyer notified

    if reviewWindowEndsAt < now && status = PROOF_SUBMITTED
        → status: COMPLETED (auto-release, screen 8 → 9)

    if redoWindowEndsAt < now && status = REDO_REQUESTED
        → status: REFUNDED
```

### Service Order
```
PENDING → IN_PROGRESS (seller starts work)
       → PROOF_SUBMITTED (seller uploads deliverable)
       → RELEASED (buyer approves / admin releases)
       → CANCELLED
```

---

## 16. WebSocket Reference — Repost

The Repost system uses a **hybrid REST + Socket pattern**:
- **REST endpoints** handle all mutations (auth, validation, DB writes).
- **WebSocket gateway** pushes real-time state updates to both parties immediately after each REST action — no polling required.

### Connection

```
Namespace:  /repost
Transport:  Socket.io (WebSocket with fallback)
URL:        ws://{host}/repost   (dev)
            wss://api.daconnect.com/repost   (prod)
```

**Authenticate on connect** — pass the JWT in one of two ways:

```js
// Option A — handshake auth object
const socket = io("/repost", {
  auth: { token: "Bearer <JWT_TOKEN>" },
});

// Option B — HTTP header (for server-side clients)
const socket = io("/repost", {
  extraHeaders: { Authorization: "Bearer <JWT_TOKEN>" },
});
```

On success the server emits `repost:success`:
```json
{ "userId": "user-uuid" }
```

On failure the server emits `repost:error` and disconnects:
```json
{ "message": "Missing authorization header" }
```

---

### Rooms

| Room | Joined by | Receives |
|------|-----------|---------|
| `<userId>` | Automatically on connect | All order events where the user is buyer or seller |
| `order:<orderId>` | Client calls `repost:join_order` | All events for that specific order |

Clients on a dedicated order screen should join the order room for focused updates. The personal room always receives the same events regardless.

---

### Client → Server Events

#### `repost:join_order`
Join the order room for a specific order. The authenticated user must be the buyer or seller.

```js
socket.emit("repost:join_order", "order-uuid");
// success → repost:success  { joined: "order:<orderId>" }
// failure → repost:error    { message: "Order not found or access denied" }
```

#### `repost:leave_order`
Leave the order room.

```js
socket.emit("repost:leave_order", "order-uuid");
```

#### `repost:get_order`
Fetch the latest order state, including `timeRemaining`.

```js
socket.emit("repost:get_order", "order-uuid");
// response → repost:get_order  { ...order, timeRemaining: { expired, ms, minutes } }
// not found → repost:error     { message: "Order not found" }
```

---

### Server → Client Events

All events include a `timestamp` (ISO 8601) field appended automatically.

| Event | Recipients | Triggered by REST call |
|-------|-----------|------------------------|
| `repost:order_created` | buyer + seller | `POST /repost-orders` |
| `repost:seller_accepted` | buyer + seller | `POST /repost-orders/:id/accept` |
| `repost:seller_rejected` | buyer + seller | `POST /repost-orders/:id/reject` |
| `repost:proof_submitted` | buyer + seller | `POST /repost-orders/:id/submit-proof` |
| `repost:proof_reviewed` | buyer + seller | `POST /repost-orders/:id/review` → ACCEPT |
| `repost:redo_requested` | buyer + seller | `POST /repost-orders/:id/review` → REDO |
| `repost:order_completed` | buyer + seller | Buyer accepts proof or auto-release |
| `repost:order_refunded` | buyer + seller | Any refund path |
| `repost:countdown_alert` | seller only | Scheduler at 60 / 30 / 15 / 5 min remaining |

#### Payload shape (all order events)
```json
{
  "id": "order-uuid",
  "status": "ACCEPTED",
  "buyerId": "uuid",
  "sellerId": "uuid",
  "listingId": "uuid",
  "platform": "INSTAGRAM_STORY",
  "contentUrl": "https://instagram.com/p/abc123",
  "amount": 100,
  "timeframe": "ONE_HOUR",
  "countdownEndsAt": "2026-06-13T14:00:00.000Z",
  "timestamp": "2026-06-13T13:05:00.000Z"
}
```

#### `repost:countdown_alert` payload (seller only)
```json
{
  "orderId": "order-uuid",
  "minutesLeft": 30,
  "countdownEndsAt": "2026-06-13T14:00:00.000Z",
  "timestamp": "2026-06-13T13:30:00.000Z"
}
```

---

### Client Integration Example (React Native / Expo)

```js
import { io } from "socket.io-client";

const socket = io("wss://api.daconnect.com/repost", {
  auth: { token: `Bearer ${jwtToken}` },
  transports: ["websocket"],
});

// Connection
socket.on("repost:success", ({ userId }) => console.log("Connected as", userId));
socket.on("repost:error",   ({ message }) => console.error("WS error:", message));

// Join the order room when opening the order detail screen
socket.emit("repost:join_order", orderId);

// Listen for real-time state changes
socket.on("repost:seller_accepted",  (order) => setOrder(order));
socket.on("repost:proof_submitted",  (order) => setOrder(order));
socket.on("repost:order_completed",  (order) => setOrder(order));
socket.on("repost:countdown_alert",  ({ minutesLeft }) => showAlert(minutesLeft));

// Leave room when navigating away
return () => socket.emit("repost:leave_order", orderId);
```

---

## Developer Notes

### Mobile App Integration Checklist
- [ ] Register FCM token on every app launch: `PATCH /notifications/fcm-token`
- [ ] Deep link handler: all notifications include `data.orderId` or `data.listingId`
- [ ] Screens 1–4 collect data client-side; submit everything in one `POST /repost-orders` call at screen 4
- [ ] Create Stripe `PaymentIntent` client-side (screen 3) before submitting the order — pass `paymentIntentId` in the request body
- [ ] `platform` and `amount` are **not** sent by the client — both are server-side derived
- [ ] Connect to WebSocket namespace `/repost` on app launch; authenticate with `auth: { token: "Bearer <JWT>" }`
- [ ] On opening an order detail screen, emit `repost:join_order` to join the order room; emit `repost:leave_order` on exit
- [ ] Drive all order UI state changes from socket events — no polling needed
- [ ] Use `repost:countdown_alert` (seller) and `repost:get_order` to drive countdown UI (screen 8)
- [ ] Handle all active `RepostOrderStatus` values for UI state: `NEW_REQUEST` `ACCEPTED` `PROOF_SUBMITTED` `REDO_REQUESTED` `COMPLETED` `REJECTED` `REFUNDED`
- [ ] On proof submission use `multipart/form-data` for files, or JSON body with `proofUrl` for URL type
- [ ] Notification badge: fetch `GET /notifications/unread-count` on app open
- [ ] Following feed: `GET /repost-listings/following` — show listings from sellers the user follows

### Admin Dashboard Integration Checklist
- [ ] Use `GET /admin/dashboard-stats/overview` for the main KPI cards
- [ ] Use `GET /admin/dashboard-stats/revenue-by-month` for charts
- [ ] Poll `GET /users/admin/unverified-profiles` for verification queue
- [ ] Dispute management: `GET /disputes` with status filter
- [ ] Announcement system: `POST /settings/announcements`
- [ ] Role management: `PATCH /users/:id/role`

### Fixed Pricing
All repost orders are priced at a **fixed $1.00**:
- `amount = 100` cents
- `platformFee = 10` cents (10%)
- `sellerAmount = 90` cents

The `listing.price` field is used only for the **Spotlight badge** (`price === 1.00` → `isSpotlight: true`).

### Redo Limits
Maximum **3 redos** per order. After the 3rd redo, `POST /repost-orders/:id/review` with `action: "REDO"` returns `400 Bad Request`.

### Notification History
All notifications are stored in the database. The `Notification` model has indexes on `userId`, `read`, and `createdAt` for efficient queries.
