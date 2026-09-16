# Order Escrow Auto-Expiry (24h Windows) — App Developer Guide

Reference for the two new automatic deadlines added to the standard `Order`
escrow flow (service orders under `/orders`, **not** the repost marketplace,
which already had this behavior). Covers the new `Order` fields, the
notifications/socket events they trigger, and how the app should surface
countdowns and terminal states.

Related backend docs: [`ORDER_CANCEL_REQUEST_PROOF_BLOCK.md`](./ORDER_CANCEL_REQUEST_PROOF_BLOCK.md),
[`ORDER_CANCELLATION_DISPUTE_APP_GUIDE.md`](./ORDER_CANCELLATION_DISPUTE_APP_GUIDE.md).

## 1. What changed

Two problems reported by the client are now fixed:

1. A buyer who never opens the app after a seller submits proof could leave an
   order stuck in `PROOF_SUBMITTED` forever, with the seller's payout never
   released. **Fix:** the buyer now has a fixed 24-hour window to review;
   after that, escrow is captured and released to the seller automatically.
2. A seller who never responds to a paid order could leave it stuck in
   `PENDING` forever, with the buyer's money held indefinitely. **Fix:** the
   seller now has a fixed 24-hour window to accept (move the order to
   `IN_PROGRESS`); after that, the order is auto-cancelled and the buyer's
   payment is voided/refunded automatically.

Both windows are enforced by a new minute-by-minute cron job — no client
action is required to trigger them. The app's job is to **display the
countdown** and **react to the resulting notifications/socket events**.

## 2. New fields on the `Order` object

Returned by `GET /orders/:id`, `GET /orders/my-orders`,
`GET /orders/my_service_orders`, and all `/order` socket payloads — same as
every other `Order` column.

| Field | Type | Set when | Cleared when |
|---|---|---|---|
| `acceptDeadline` | `ISO date \| null` | Order created (buyer pays) — `createdAt + 24h` | Seller accepts (`status → IN_PROGRESS`), or order is cancelled |
| `proofReviewDeadline` | `ISO date \| null` | Seller submits proof — `proofSubmittedAt + 24h` | Buyer reviews (proof accepted/rejected → `RELEASED`/`RESUBMIT`), or order is cancelled |

Both are `null` outside the window they apply to — e.g. `acceptDeadline` is
always `null` once `status` leaves `PENDING`. Treat `null` as "no active
countdown for this timer," not as an error.

> This mirrors the repost marketplace's `RepostOrder.countdownEndsAt` /
> `reviewWindowEndsAt` — if you've already built countdown UI for repost
> orders, the same component works here with a 24h window instead of a
> timeframe-based one / a 1h review window.

## 3. Timer 1 — Seller acceptance (`acceptDeadline`)

```
Buyer pays → status = PENDING, acceptDeadline = now + 24h
   │
   ├── Seller calls PATCH /orders/:id/status?status=IN_PROGRESS within 24h
   │      → acceptDeadline cleared (null), order proceeds normally
   │
   └── 24h pass with status still PENDING
          → cron auto-cancels: PaymentIntent voided, status = CANCELLED,
            cancelledAt = now, buyer refunded, both parties notified
```

**UI guidance:**

- While `status === "PENDING"` and `acceptDeadline` is set, show a countdown
  ("Waiting for seller to accept — expires in Xh Ym") on the buyer's order
  screen. The seller's "New Order" screen should show the same countdown as
  urgency to accept.
- Once the countdown hits zero, don't rely on the client clock alone to flip
  UI state — re-fetch the order or wait for the socket event (§5), since the
  cron runs once a minute and there can be up to ~60s of lag between the
  deadline passing and the order actually flipping to `CANCELLED`.

## 4. Timer 2 — Buyer proof review (`proofReviewDeadline`)

```
Seller submits proof → status = PROOF_SUBMITTED,
                        proofReviewDeadline = now + 24h
   │
   ├── Buyer approves / confirms delivery within 24h
   │      → normal release path (PATCH .../status?status=RELEASED or
   │        POST /payments/approve-payment), proofReviewDeadline cleared
   │
   ├── Buyer rejects proof within 24h (PATCH .../cancel-proof)
   │      → status = RESUBMIT, proofReviewDeadline cleared
   │        (a fresh 24h deadline is set the next time proof is submitted)
   │
   └── 24h pass with status still PROOF_SUBMITTED
          → cron auto-releases: PaymentIntent captured, status = RELEASED,
            releasedAt = now, isReleased = true, seller paid out,
            both parties notified
```

**Guarded exceptions** — the cron **skips** auto-release (leaves the order
alone, funds stay locked) if either is true at the time it runs:

- `order.isCancelRequested === true` (buyer has an unresolved cancellation
  request pending seller action — see `ORDER_CANCEL_REQUEST_PROOF_BLOCK.md`)
- The order has an open (`UNDER_REVIEW`) `Dispute` filed against it (see
  `ORDER_CANCELLATION_DISPUTE_APP_GUIDE.md` §6)

In both cases the order simply stays `PROOF_SUBMITTED` past its deadline
until the request/dispute is resolved — the app should **not** show "funds
released" until it actually observes `status === "RELEASED"`.

**UI guidance:**

- While `status === "PROOF_SUBMITTED"` and `proofReviewDeadline` is set, show
  the buyer a countdown: "Review within Xh Ym or funds are automatically
  released to the seller." This is the same banner the proof-submitted push
  notification is now paired with (§5).
- If `isCancelRequested` or an open dispute exists, don't show the release
  countdown as "ticking down to release" — the funds are actually locked.
  Prefer messaging like "Under review — release paused" (reuses the existing
  dispute/cancel-request banners from `ORDER_CANCELLATION_DISPUTE_APP_GUIDE.md`
  §4).

## 5. Notification changes

### 5.1 Existing "proof submitted" notification — body text updated

No new notification type; the existing `UPLOAD_PROOF` push (and matching
email) sent to the buyer when the seller submits proof now explicitly states
the 24h deadline, and the push `data` payload carries the deadline so the app
can render a countdown without an extra fetch:

```json
{
  "title": "Proof uploaded",
  "body": "SellerName has submitted proof for order ORD-123. You have 24 hours to review or dispute it before funds are automatically released.",
  "type": "UPLOAD_PROOF",
  "data": {
    "orderId": "...",
    "orderCode": "ORD-123",
    "serviceRequestId": "...",
    "buyerId": "...",
    "sellerId": "...",
    "status": "PROOF_SUBMITTED",
    "proofReviewDeadline": "2026-09-17T10:00:00.000Z",
    "timestamp": "..."
  }
}
```

### 5.2 New — auto-cancel (seller missed the 24h acceptance window)

Sent once, to both parties, only by the cron (never by a manual cancel):

| Recipient | Title | Body |
|---|---|---|
| Buyer | `Order Cancelled — Refund Issued` | `@{seller} didn't accept order {orderCode} within 24 hours. Your payment has been refunded.` |
| Seller | `Order Expired` | `You missed the 24-hour window to accept order {orderCode}. It has been cancelled and refunded to the buyer.` |

`type` is `"ORDER_AUTO_CANCELLED"` for both. `data` payload:

```json
{
  "orderId": "...",
  "orderCode": "ORD-123",
  "status": "CANCELLED",
  "action": "AUTO_CANCEL_UNACCEPTED",
  "timestamp": "..."
}
```

The buyer also gets a plain-text confirmation email. Use `data.action` if you
need to distinguish this from a manual buyer/seller-initiated cancellation in
the notification feed UI (both still just result in `status: "CANCELLED"`).

### 5.3 New — auto-release (buyer missed the 24h review window)

Sent once, to both parties, only by the cron:

| Recipient | Title | Body |
|---|---|---|
| Buyer | `Funds Released` | `You didn't review in time, so $X.XX for order {orderCode} was automatically released to @{seller}.` |
| Seller | `Payment Released` | `Order {orderCode} wasn't reviewed within 24 hours, so payment has been automatically released to your balance.` |

`type` is `"ORDER_UPDATE"` for the buyer, `"PAYMENT_RECEIVED"` for the seller
(same types already used for the manual release path — no new type to
branch on). `data` payload:

```json
{
  "orderId": "...",
  "orderCode": "ORD-123",
  "status": "RELEASED",        // buyer notification
  "amount": "5000",            // seller notification (cents)
  "action": "AUTO_RELEASE",
  "timestamp": "..."
}
```

Use `data.action === "AUTO_RELEASE"` if the UI wants to say "Auto-released"
instead of "You approved this" in an order history/timeline view.

## 6. Socket events — nothing new

No new socket events were added. Both auto-actions reuse the **existing**
`/order` namespace events, since they end in the same terminal statuses a
manual action would:

| Event | Fired by |
|---|---|
| `order:cancelled` | Auto-cancel (unaccepted order), same event as a manual cancel |
| `order:released` | Auto-release (unreviewed proof), same event as a manual release |

If your UI already listens for these two events to refresh the order screen
(per `ORDER_SOCKET_GUIDE.md`), no socket-handling changes are needed — only
the push notification/history copy differs, plus the two new deadline
fields for rendering countdowns.

## 7. Quick reference — field & timer summary

| | `acceptDeadline` | `proofReviewDeadline` |
|---|---|---|
| Active while `status` is | `PENDING` | `PROOF_SUBMITTED` |
| Set on | Order creation (payment authorized) | Proof submitted |
| Cleared on | Seller accepts, or order cancelled | Buyer reviews (release/reject), or order cancelled |
| Window length | 24h | 24h |
| On expiry | Auto-cancel + refund buyer | Auto-release funds to seller |
| Can be skipped by | — (no guard) | Open dispute or pending cancellation request |
| Resulting status | `CANCELLED` | `RELEASED` |
| Socket event | `order:cancelled` | `order:released` |
| New notification `type` | `ORDER_AUTO_CANCELLED` | `ORDER_UPDATE` (buyer) / `PAYMENT_RECEIVED` (seller) |

## Related code

- `prisma/schema/order.prisma` — `Order.acceptDeadline`, `Order.proofReviewDeadline`
- `prisma/migrations/20260916150000_add_order_deadlines/`
- `src/main/order-scheduler/order-scheduler.service.ts` — the two cron jobs
- `src/main/order/order.service.ts` — `submitProof()` (sets `proofReviewDeadline`),
  `autoCancelUnacceptedOrder()`, `statusTimestampData()` (clears deadlines on transition)
- `src/main/payments/payments.service.ts` — `createOrderWithPaymentMethod()`
  (sets `acceptDeadline`), `autoReleaseEscrow()`
