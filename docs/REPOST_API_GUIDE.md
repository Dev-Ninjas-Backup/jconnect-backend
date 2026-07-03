# Repost API Guide

Covers the Repost marketplace: sellers list repost services, buyers browse/pay/order
them, sellers fulfil the request, buyers review proof, escrow releases funds.

> **Status:** Covers the full buyer-facing lifecycle: Repost Hub → pay → order →
> status list → review window → accept/reject/redo → completion. Seller-side
> screens (accept/reject a request, submit proof) aren't sent yet but their
> endpoints exist and are documented below.

## Modules

| Module           | Base path         | Purpose                                             |
| ---------------- | ------------------ | ---------------------------------------------------- |
| Repost Listings   | `/repost-listings` | Seller's catalog of repost services (what they sell) |
| Repost Orders     | `/repost-orders`   | A buyer's purchase of one listing (the transaction)  |

All endpoints require `Authorization: Bearer <JWT>` unless noted.

---

## Enums

**`RepostPlatform`** (a listing's `platform` = combined platform + repost type)

| Value                      | Platform  | Repost type            |
| --------------------------- | --------- | ----------------------- |
| `INSTAGRAM_STORY`            | Instagram | Story Repost            |
| `INSTAGRAM_FEED`             | Instagram | Feed Repost              |
| `INSTAGRAM_REEL`             | Instagram | Reel Repost              |
| `TIKTOK`                     | TikTok    | Repost                   |
| `TIKTOK_DUET`                | TikTok    | Duet / Stitch Repost     |
| `TWITTER`                    | X         | Repost                   |
| `TWITTER_QUOTE`              | X         | Quote Repost             |
| `YOUTUBE_COMMUNITY_POST`     | YouTube   | Community Post Repost    |
| `YOUTUBE_SHORTS`             | YouTube   | Video Repost (Shorts)    |
| `FACEBOOK_POST`              | Facebook  | Post Repost               |
| `FACEBOOK_STORY`             | Facebook  | Story Repost               |

`YOUTUBE` and `FACEBOOK` (bare, no suffix) also still exist for backward
compatibility with any listing created before the platform/type split — new
listings should use the specific values above.

`INSTAGRAM_IGTV` still exists in the enum but is **discontinued** — Instagram no
longer has IGTV. It's removed from the `GET /repost-listings/platforms`
catalog, and `POST /repost-listings` / `PATCH /repost-listings/:id` reject it
with `400 INSTAGRAM_IGTV is no longer available`.

**`RepostTimeframe`** — `THIRTY_MIN` `ONE_HOUR` `TWO_HOURS` `SIX_HOURS` `TWELVE_HOURS` `TWENTY_FOUR_HOURS`

**`RepostOrderStatus`** — `NEW_REQUEST` `ACCEPTED` `IN_PROGRESS` `PROOF_SUBMITTED` `REVIEW_WINDOW` `REDO_REQUESTED` `COMPLETED` `REJECTED` `REFUNDED` `DISPUTED`

**`ProofType`** — `SCREENSHOT` `SCREEN_RECORDING` `URL`

---

## Buyer flow (screens → endpoints)

| Screen                                     | Endpoint                                   |
| ------------------------------------------- | -------------------------------------------- |
| Repost Hub / Select Repost Option           | `GET /repost-listings/platforms`             |
| Content & Payment — "Continue" (no charge yet, just collects `contentUrl` and moves to the next screen) | — |
| Set Completion Time — "Pay" (fires both calls in sequence) | `POST /repost-listings/:id/pay` → `POST /repost-orders` |
| Reposts Status — "Paid Repost" tab (buyer)  | `GET /repost-orders/my-orders`               |
| Reposts Status — "My Repost" tab (seller)   | `GET /repost-orders/my-seller-orders`        |

> Button labels flipped from the original mockups: **Content & Payment** now
> says "Continue" (just collects the share link, no API call), and **Set
> Completion Time** now says "Pay" — that's where the buyer actually gets
> charged. Neither endpoint's contract changed: `pay` only ever needed the
> listing ID, and `POST /repost-orders` only ever needed all four fields
> together, so the frontend just calls `pay` then immediately `POST
> /repost-orders` when "Pay" is tapped, using the `contentUrl` carried over
> from the previous screen.

### 1. `GET /repost-listings/platforms`

Static catalog of supported platforms + repost types, used to populate the Repost
Hub / Select Repost Option / Create-Edit-Listing dropdowns. Any authenticated user.

**Response**

```json
[
  {
    "label": "Instagram",
    "value": "INSTAGRAM",
    "repostTypes": [
      { "label": "Story Repost", "value": "INSTAGRAM_STORY" },
      { "label": "Feed Repost", "value": "INSTAGRAM_FEED" },
      { "label": "Reel Repost", "value": "INSTAGRAM_REEL" }
    ]
  },
  {
    "label": "Tiktok",
    "value": "TIKTOK",
    "repostTypes": [
      { "label": "Repost", "value": "TIKTOK" },
      { "label": "Duet / Stitch Repost", "value": "TIKTOK_DUET" }
    ]
  },
  {
    "label": "X",
    "value": "TWITTER",
    "repostTypes": [
      { "label": "Repost", "value": "TWITTER" },
      { "label": "Quote Repost", "value": "TWITTER_QUOTE" }
    ]
  },
  {
    "label": "YouTube",
    "value": "YOUTUBE",
    "repostTypes": [
      { "label": "Community Post Repost", "value": "YOUTUBE_COMMUNITY_POST" },
      { "label": "Video Repost (Shorts)", "value": "YOUTUBE_SHORTS" }
    ]
  },
  {
    "label": "Facebook",
    "value": "FACEBOOK",
    "repostTypes": [
      { "label": "Post Repost", "value": "FACEBOOK_POST" },
      { "label": "Story Repost", "value": "FACEBOOK_STORY" }
    ]
  }
]
```

To find a specific seller's actual listing (id + real price) for a chosen
`repostTypes[].value`, browse `GET /repost-listings?platform=<value>`.

### 2. `POST /repost-listings/:id/pay`

Buyer taps **Pay** on the Set Completion Time screen (first of the two calls
that button fires). Pre-authorizes (does **not** capture) a charge on the
buyer's saved Stripe card for the listing's price, via `capture_method:
"manual"` — same escrow-hold pattern as the existing
`POST /payment/make-payment` flow, kept as its own endpoint since repost
listings aren't `Service` records.

Requires the buyer to already have `customerIdStripe` and a saved
`PaymentMethod` (from the existing `create-setup-intent` / `confirm-setup-intent`
flow in the `payments` module).

**Request** — no body, `:id` is the `RepostListing.id`.

**Response**

```json
{
  "paymentIntentId": "pi_3P...",
  "amount": 100,
  "currency": "usd",
  "listingId": "listing-uuid"
}
```

`amount` is in cents and reflects the listing's actual price (e.g. `$2.50` listing → `250`), not a flat $1.

**Errors**: `404` listing not found · `400` listing inactive/paused, buying your
own listing, no Stripe customer, or no saved payment method.

### 3. `POST /repost-orders`

Second of the two calls the **Pay** button fires (right after step 2
succeeds). Finalizes the order using the `paymentIntentId` obtained from step
2, plus the `contentUrl` collected earlier on the Content & Payment screen and
the `timeframe` selected on this screen.

**Request**

```json
{
  "listingId": "listing-uuid",
  "contentUrl": "https://instagram.com/p/abc123",
  "paymentIntentId": "pi_3P...",
  "timeframe": "TWO_HOURS"
}
```

**Response** — the created `RepostOrder` row:

```json
{
  "id": "order-uuid",
  "orderCode": "RPO-A1B2C3D4",
  "buyerId": "...",
  "sellerId": "...",
  "listingId": "listing-uuid",
  "platform": "INSTAGRAM_STORY",
  "timeframe": "TWO_HOURS",
  "amount": 100,
  "platformFee": 10,
  "sellerAmount": 90,
  "status": "NEW_REQUEST",
  "contentUrl": "https://instagram.com/p/abc123",
  "contentFiles": [],
  "countdownEndsAt": "2026-07-03T14:00:00.000Z",
  "paymentIntentId": "pi_3P...",
  "isReleased": false,
  "createdAt": "2026-07-03T12:00:00.000Z",
  "updatedAt": "2026-07-03T12:00:00.000Z"
}
```

Server-side, this endpoint:

- Verifies `paymentIntentId` hasn't already been used for another order.
- Retrieves the PaymentIntent from Stripe and rejects unless its status is
  `requires_capture` (i.e. it was actually authorized via step 2).
- Rejects if the PaymentIntent's `metadata.listingId` / `metadata.buyerId`
  don't match the request (prevents replaying someone else's PaymentIntent).
- `amount`/`platformFee` (10%) /`sellerAmount` are derived from the
  **PaymentIntent's actual authorized amount**, not the listing price at read
  time — so a later listing price edit can't retroactively change an
  in-flight order.

**Errors**: `404` listing not found · `400` listing unavailable, buying your
own listing, payment already used, payment not authorized, or payment/listing
mismatch.

### 4. `GET /repost-orders/my-orders?status=<RepostOrderStatus>`

Buyer's "Paid Repost" tab. `status` optional.

```json
[
  {
    "id": "order-uuid",
    "orderCode": "RPO-A1B2C3D4",
    "platform": "INSTAGRAM_STORY",
    "timeframe": "TWELVE_HOURS",
    "status": "ACCEPTED",
    "amount": 500,
    "contentUrl": "https://www.instagram.com/p/mybrandpro...",
    "listing": { "id": "listing-uuid", "platform": "INSTAGRAM_STORY", "price": 5.0, "...": "..." },
    "seller": { "id": "...", "username": "top_influencer", "profilePhoto": "..." }
  }
]
```

### 5. `GET /repost-orders/my-seller-orders?status=<RepostOrderStatus>`

Seller's "My Repost" tab — same shape, with `buyer` instead of `seller`.

---

## Buyer review flow (screens → endpoints)

Once the seller submits proof, the order enters `PROOF_SUBMITTED` and a 1-hour
review window opens.

| Screen                          | Endpoint                                                          |
| -------------------------------- | -------------------------------------------------------------------- |
| Review Window (countdown)        | `GET /repost-orders/:id` → `reviewTimeRemaining`                     |
| Review Window — "View Proof"     | `GET /repost-orders/:id` → `proofType` / `proofUrl` / `proofFiles`   |
| Review Proof — "Accept & Release Funds" | `POST /repost-orders/:id/review` `{ "action": "ACCEPT" }`     |
| Review Proof — "Reject"          | `POST /repost-orders/:id/review` `{ "action": "REJECT" }`            |
| Review Proof — "Ask for Redo" → Submit | `POST /repost-orders/:id/review` `{ "action": "REDO", "instructions": "..." }` |
| Order Completed (manual or auto) | Result of ACCEPT, or the auto-release cron if the buyer never acts   |

### `GET /repost-orders/:id`

Returns the full order plus three countdown helpers, each `null` if the
corresponding window isn't open:

```json
{
  "id": "order-uuid",
  "status": "PROOF_SUBMITTED",
  "platform": "INSTAGRAM_STORY",
  "proofType": "SCREENSHOT",
  "proofUrl": null,
  "proofFiles": ["https://.../proof1.png"],
  "proofSubmittedAt": "2026-07-03T14:11:00.000Z",
  "reviewWindowEndsAt": "2026-07-04T02:11:00.000Z",
  "redoWindowEndsAt": null,
  "redoInstructions": null,
  "timeRemaining": { "expired": false, "ms": 3600000, "minutes": 60, "formatted": "01:00:00" },
  "reviewTimeRemaining": { "expired": false, "ms": 35973000, "minutes": 599, "formatted": "09:59:33" },
  "redoTimeRemaining": null,
  "listing": { "...": "..." },
  "buyer": { "...": "..." },
  "seller": { "...": "..." }
}
```

- `timeRemaining` — always present, based on `countdownEndsAt` (the seller's
  fulfillment deadline).
- `reviewTimeRemaining` — populated once proof is submitted, based on
  `reviewWindowEndsAt`. Drives the Review Window screen's `09:59:33` countdown.
- `redoTimeRemaining` — populated while `status = REDO_REQUESTED`, based on
  `redoWindowEndsAt`.
- `formatted` is `HH:MM:SS`, matching the countdown ring's display.

### `POST /repost-orders/:id/review`

```json
{ "action": "ACCEPT" }
```

```json
{ "action": "REJECT" }
```

```json
{
  "action": "REDO",
  "instructions": "The story wasn't pinned to the top — please repost and pin it."
}
```

`instructions` (max 300 chars, matches the "Request Redo" modal's counter) is
optional but only meaningful for `REDO` — it's stored on
`RepostOrder.redoInstructions` (overwritten on each redo) and included in the
seller's push notification so they know what to fix.

- `ACCEPT` → captures the held Stripe PaymentIntent, order → `COMPLETED`.
- `REJECT` → voids (cancels) the held PaymentIntent, order → `REFUNDED`.
- `REDO` → order → `REDO_REQUESTED`, seller gets a 30-minute redo window (max 3
  redos across the order's lifetime — the 4th attempt returns `400 Maximum redo
  limit (3) reached`).

If the buyer never acts within the review window, `RepostSchedulerService`
auto-releases (captures) on their behalf — this is the "Order Completed / The
buyer did not take action" screen. `GET /repost-orders/my-orders` /
`my-seller-orders` responses carry the same `COMPLETED` status either way; the
notification body is the only thing that differs (auto vs manual release).

---

## Status → UI badge mapping

The app shows `Active` / `Completed` / `Cancelled` badges; these are UI groupings
of `RepostOrderStatus`, not separate backend values:

| Badge       | Statuses                                                                   |
| ----------- | ---------------------------------------------------------------------------- |
| `Active`    | `NEW_REQUEST`, `ACCEPTED`, `IN_PROGRESS`, `PROOF_SUBMITTED`, `REVIEW_WINDOW`, `REDO_REQUESTED` |
| `Completed` | `COMPLETED`                                                                  |
| `Cancelled` | `REJECTED`, `REFUNDED`, `DISPUTED`                                          |

---

## Seller fulfillment endpoints (already implemented)

These aren't part of the screens sent so far, but exist and are documented for
completeness — the "next flow" batch will likely cover their screens.

| Method | Endpoint                       | Who    | Purpose                                              |
| ------ | -------------------------------- | ------ | ------------------------------------------------------ |
| POST   | `/repost-orders/:id/accept`      | Seller | Accept a `NEW_REQUEST` → `ACCEPTED`                     |
| POST   | `/repost-orders/:id/reject`      | Seller | Reject a `NEW_REQUEST` → `REJECTED` (refund notified)   |
| POST   | `/repost-orders/:id/submit-proof`| Seller | Upload proof (`multipart/form-data`) → `PROOF_SUBMITTED`, opens a 1-hour buyer review window |
| POST   | `/repost-orders/:id/review`      | Buyer  | `{ action: "ACCEPT" \| "REJECT" \| "REDO" }` on submitted proof |
| GET    | `/repost-orders/:id`             | Either | Single order + `timeRemaining` on the countdown          |

`submit-proof` body (`multipart/form-data`):

```json
{ "proofType": "SCREENSHOT", "files": ["<binary>"] }
```

or for a link:

```json
{ "proofType": "URL", "proofUrl": "https://drive.google.com/file/xxx" }
```

See [Buyer review flow](#buyer-review-flow-screens--endpoints) above for
`review` action details.

A cron job (`RepostSchedulerService`, every minute) sends countdown alerts and
auto-expires/auto-releases orders that miss their deadlines. Both the
seller-fulfillment-deadline expiry and the redo-window expiry now also void
the held PaymentIntent (see below), not just flip DB status.

---

## Listing management endpoints (seller-side)

| Method | Endpoint                              | Who     | Purpose                                     |
| ------ | ---------------------------------------- | ------- | ---------------------------------------------- |
| POST   | `/repost-listings`                       | Artist  | Create a listing                                |
| GET    | `/repost-listings?platform=&spotlight=`  | Any     | Browse active listings (marketplace)            |
| GET    | `/repost-listings/spotlight`             | Any     | $1 Repost Spotlight listings                     |
| GET    | `/repost-listings/following`             | Any     | Listings from sellers you follow                 |
| GET    | `/repost-listings/my-listings?status=`   | Artist  | Your own listings; `status=active\|inactive`     |
| GET    | `/repost-listings/dashboard`             | Artist  | Your listings + order counts                     |
| GET    | `/repost-listings/platforms`             | Any     | Platform/repost-type catalog (see above)         |
| GET    | `/repost-listings/:id`                   | Any     | Single listing                                    |
| POST   | `/repost-listings/:id/pay`               | Any     | Pre-authorize payment (see above)                |
| PATCH  | `/repost-listings/:id`                   | Owner   | Update price/description/defaultTurnaround/etc.  |
| PATCH  | `/repost-listings/:id/toggle-pause`      | Owner   | Pause/reactivate (drives the Active/Inactive tab) |
| DELETE | `/repost-listings/:id`                   | Owner   | Delete                                            |

`RepostListing` fields: `platform`, `price`, `followerCount?`, `description?`,
`isActive`, `isPaused`, `isSpotlight`, `defaultTurnaround` (`RepostTimeframe`,
defaults to `TWENTY_FOUR_HOURS`), plus analytics counters
(`totalPurchases`, `totalAccepts`, `totalProofs`, `totalRedos`,
`totalAutoReleases`, `totalCompleted`).

---

## Escrow capture/void (Stripe wiring)

Every path that changes order status now moves real money, not just DB state:

| Trigger                                             | Stripe call                        | New status  |
| ----------------------------------------------------- | ------------------------------------ | ------------ |
| Buyer `ACCEPT`                                        | `paymentIntents.capture()`           | `COMPLETED`  |
| Auto-release (buyer misses review window)              | `paymentIntents.capture()`           | `COMPLETED`  |
| Buyer `REJECT`                                         | `paymentIntents.cancel()`            | `REFUNDED`   |
| Seller rejects a `NEW_REQUEST`                          | `paymentIntents.cancel()`            | `REJECTED`   |
| Seller misses the fulfillment countdown                | `paymentIntents.cancel()`            | `REFUNDED`   |
| Seller misses the redo window                          | `paymentIntents.cancel()`            | `REFUNDED`   |

- **Capture failures throw** (`400 Failed to capture payment; escrow not
  released`) rather than silently marking the order `COMPLETED` — you can't
  tell a seller funds were released if Stripe didn't actually move them. The
  auto-release cron catches this per-order so one failure doesn't block other
  orders' processing.
- **Void (cancel) failures only log a warning** and don't block the
  reject/refund DB update — a stuck manual-capture PaymentIntent auto-expires
  after 7 days on Stripe's side regardless, so this is a recoverable/ops
  concern rather than a correctness one.

## Known gaps

- Bare `YOUTUBE` / `FACEBOOK` enum values, and now `INSTAGRAM_IGTV`
  (discontinued — see Enums above), are legacy/unused — no listings currently
  use them, but they remain in the enum for backward compatibility rather than
  being removed (Postgres enum values can't be dropped without a table rewrite).
- `RepostOrderStatus.REVIEW_WINDOW` and `DISPUTED` are declared in the schema
  but nothing currently transitions an order into them (`PROOF_SUBMITTED`
  covers the review-window period instead). Leaving as-is since Prisma enum
  values are cheap to keep unused.
