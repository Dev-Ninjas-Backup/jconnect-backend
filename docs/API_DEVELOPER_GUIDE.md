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

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/repost-listings` | ARTIST | Create a listing |
| GET | `/repost-listings` | USER | Browse marketplace (`?platform=TIKTOK&spotlight=true`) |
| GET | `/repost-listings/spotlight` | USER | $1 Repost Spotlight listings |
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
- Featured first in marketplace results
- Seller receives "Listed in $1 Repost Spotlight" push notification

### Platform Enum Values
`INSTAGRAM_STORY` | `INSTAGRAM_FEED` | `TIKTOK` | `YOUTUBE` | `FACEBOOK` | `TWITTER`

---

## 4. Repost Orders (Buyer & Seller Flow)

### Full Order Lifecycle
```
NEW_REQUEST → ACCEPTED → IN_PROGRESS → PROOF_SUBMITTED → REVIEW_WINDOW → COMPLETED
                                                        ↘ REDO_REQUESTED → PROOF_SUBMITTED
              REJECTED
              REFUNDED
              DISPUTED
```

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/repost-orders` | USER | Buyer: create order (countdown starts immediately) |
| POST | `/repost-orders/:id/accept` | USER | Seller: accept request |
| POST | `/repost-orders/:id/reject` | USER | Seller: reject request |
| POST | `/repost-orders/:id/submit-proof` | USER | Seller: submit proof (multipart or URL) |
| POST | `/repost-orders/:id/review` | USER | Buyer: accept / reject / redo |
| GET | `/repost-orders/my-orders` | USER | Buyer: my orders (`?status=ACCEPTED`) |
| GET | `/repost-orders/my-seller-orders` | USER | Seller: orders on my listings |
| GET | `/repost-orders/:id` | USER | Get single order (includes `timeRemaining`) |

### Step 1 — Buyer Creates Order
```json
POST /repost-orders
{
  "listingId": "uuid",
  "platform": "INSTAGRAM_STORY",
  "timeframe": "ONE_HOUR",
  "amount": 100,
  "contentUrl": "https://instagram.com/p/abc",
  "paymentIntentId": "pi_stripe_xxx"
}
```
- Countdown starts immediately at order creation
- Funds enter escrow (Stripe)
- Seller receives push notification

### Step 2 — Seller Accepts/Rejects
```
POST /repost-orders/{id}/accept  → status: ACCEPTED
POST /repost-orders/{id}/reject  → status: REJECTED, buyer refunded
```

### Step 3 — Seller Submits Proof
```
POST /repost-orders/{id}/submit-proof   (multipart/form-data)
Fields:
  proofType: "SCREENSHOT" | "SCREEN_RECORDING" | "URL"
  proofUrl:  "https://..."   (required only when proofType = URL)
  files[]:   binary files    (required for SCREENSHOT or SCREEN_RECORDING)
```
- 1-hour buyer review window starts immediately
- If not reviewed in 1 hour → **auto-release to seller**

### Step 4 — Buyer Reviews Proof
```json
POST /repost-orders/{id}/review
{ "action": "ACCEPT" }   → COMPLETED, escrow released to seller
{ "action": "REJECT" }   → REFUNDED, buyer gets money back
{ "action": "REDO"   }   → REDO_REQUESTED, seller has 30 minutes to resubmit
```

### Timeframe Values
| Enum | Duration |
|------|----------|
| `THIRTY_MIN` | 30 minutes |
| `ONE_HOUR` | 1 hour |
| `TWO_HOURS` | 2 hours |
| `SIX_HOURS` | 6 hours |
| `TWELVE_HOURS` | 12 hours |
| `TWENTY_FOUR_HOURS` | 24 hours |

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
Use `minutes` or `ms` to drive your countdown UI.

### Countdown Alerts (Automatic — Seller Only)
The scheduler fires every minute and sends pushes automatically:
- **60 min** remaining → push sent
- **30 min** remaining → push sent
- **15 min** remaining → push sent
- **5 min** remaining → push sent
- **0 min** (expired, no proof) → order auto-refunded

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
`NEW_REQUEST` | `ACCEPTED` | `IN_PROGRESS` | `PROOF_SUBMITTED` | `REVIEW_WINDOW` | `REDO_REQUESTED` | `COMPLETED` | `REJECTED` | `REFUNDED` | `DISPUTED`

### ProofType
`SCREENSHOT` | `SCREEN_RECORDING` | `URL`

### RepostTimeframe
`THIRTY_MIN` | `ONE_HOUR` | `TWO_HOURS` | `SIX_HOURS` | `TWELVE_HOURS` | `TWENTY_FOUR_HOURS`

### ServiceType (legacy)
`SOCIAL_POST` | `SERVICE`

---

## 14. Notification Types Reference

All notifications include `data.orderId` or `data.listingId` for deep linking.

### Repost — Buyer Receives
| Type | When |
|------|------|
| `REPOST_ORDER_SUBMITTED` | After creating order |
| `REPOST_SELLER_ACCEPTED` | Seller accepted |
| `REPOST_SELLER_REJECTED` | Seller rejected (refund initiated) |
| `REPOST_PROOF_SUBMITTED` | Seller submitted proof |
| `REPOST_REVIEW_WINDOW_STARTED` | 1-hour review window open |
| `REPOST_REDO_SUBMITTED` | Seller resubmitted revised proof |
| `REPOST_FUNDS_RELEASED` | Escrow released to seller |
| `REPOST_DISPUTE_UPDATED` | Dispute status changed |

### Repost — Seller Receives
| Type | When |
|------|------|
| `REPOST_NEW_REQUEST` | New order received |
| `REPOST_EXPIRING_SOON` | Countdown alert (60/30/15/5 min) |
| `REPOST_REQUEST_ACCEPTED` | Confirmed accept |
| `REPOST_PROOF_SENT` | Proof submitted confirmation |
| `REPOST_REDO_REQUESTED` | Buyer requested redo |
| `REPOST_SELLER_FUNDS_RELEASED` | Payment released |
| `REPOST_DISPUTE_OPENED` | Dispute opened |

### Escrow
| Type | Recipient | When |
|------|-----------|------|
| `ESCROW_FUNDS_HELD` | Buyer | On order creation |
| `ESCROW_REFUND_ISSUED` | Buyer | On rejection/expiry |
| `ESCROW_FUNDS_RELEASED` | Both | On completion |
| `ESCROW_REFUND_PROCESSED` | Buyer | Stripe refund confirmed |

### Listing Management (Seller)
| Type | When |
|------|------|
| `LISTING_APPROVED` | New listing created |
| `LISTING_FEATURED` | $1 listing auto-enrolled in spotlight |
| `LISTING_PAUSED` | Listing paused |
| `LISTING_REACTIVATED` | Listing reactivated |
| `LISTING_REMOVED` | Listing deleted |

### Performance (Seller)
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
[Buyer] POST /repost-orders
    → status: NEW_REQUEST
    → countdown started (countdownEndsAt set)

[Seller] POST /repost-orders/:id/accept
    → status: ACCEPTED

[Seller] POST /repost-orders/:id/submit-proof
    → status: PROOF_SUBMITTED
    → reviewWindowEndsAt = now + 1 hour

[Buyer] POST /repost-orders/:id/review { action: "ACCEPT" }
    → status: COMPLETED, isReleased: true

[Buyer] POST /repost-orders/:id/review { action: "REJECT" }
    → status: REFUNDED

[Buyer] POST /repost-orders/:id/review { action: "REDO" }
    → status: REDO_REQUESTED, redoWindowEndsAt = now + 30 min

[Seller] POST /repost-orders/:id/submit-proof  (again)
    → status: PROOF_SUBMITTED (new review window starts)

[Scheduler] every minute:
    → if countdownEndsAt < now && status in (NEW_REQUEST|ACCEPTED|IN_PROGRESS)
       → status: REFUNDED
    → if reviewWindowEndsAt < now && status = PROOF_SUBMITTED
       → status: COMPLETED (auto-release)
    → if redoWindowEndsAt < now && status = REDO_REQUESTED
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

## Developer Notes

### Mobile App Integration Checklist
- [ ] Register FCM token on every app launch: `PATCH /notifications/fcm-token`
- [ ] Deep link handler: all notifications include `data.orderId` or `data.listingId`
- [ ] Poll `GET /repost-orders/:id` to update countdown UI (use `timeRemaining.ms`)
- [ ] Handle all `RepostOrderStatus` values for UI state
- [ ] On proof submission use `multipart/form-data` for files, or JSON with `proofUrl` for URLs
- [ ] Notification badge: fetch `GET /notifications/unread-count` on app open

### Admin Dashboard Integration Checklist
- [ ] Use `GET /admin/dashboard-stats/overview` for the main KPI cards
- [ ] Use `GET /admin/dashboard-stats/revenue-by-month` for charts
- [ ] Poll `GET /users/admin/unverified-profiles` for verification queue
- [ ] Dispute management: `GET /disputes` with status filter
- [ ] Announcement system: `POST /settings/announcements`
- [ ] Role management: `PATCH /users/:id/role`

### Platform Fee
Platform takes **10%** of every repost order automatically:
- `platformFee = amount * 0.10`
- `sellerAmount = amount - platformFee`

### Redo Limits
Maximum **3 redos** per order. After the 3rd redo is used, `reviewProof` will throw `400 Bad Request`.

### Notification History
All notifications are stored in the database. The `Notification` model has indexes on `userId`, `read`, and `createdAt` for efficient queries.
