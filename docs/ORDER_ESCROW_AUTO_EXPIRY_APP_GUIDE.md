# Order Escrow Auto-Expiry — App Developer Guide

Reference for the three automatic deadlines on the standard `Order` escrow
flow (service orders under `/orders`, **not** the repost marketplace, which
already had similar behavior). Covers the `Order` fields, the
notifications/socket events they trigger, and how the app should surface
countdowns and terminal states.

Related backend docs: [`ORDER_CANCEL_REQUEST_PROOF_BLOCK.md`](./ORDER_CANCEL_REQUEST_PROOF_BLOCK.md),
[`ORDER_CANCELLATION_DISPUTE_APP_GUIDE.md`](./ORDER_CANCELLATION_DISPUTE_APP_GUIDE.md).

## 1. What changed

Three problems reported by the client are now fixed. The order lifecycle now
has a fixed timeline end to end:

```
Buyer places order → 12-hour acceptance window → Seller accepts
   → 24-hour proof submission window → Seller submits proof
   → 24-hour buyer review window → funds released
```

1. A buyer who never opens the app after a seller submits proof could leave an
   order stuck in `PROOF_SUBMITTED` forever, with the seller's payout never
   released. **Fix:** the buyer has a fixed 24-hour window to review; after
   that, escrow is captured and released to the seller automatically.
2. A seller who never responds to a paid order could leave it stuck in
   `PENDING` forever, with the buyer's money held indefinitely. **Fix:** the
   seller has a fixed 12-hour window to accept (move the order to
   `IN_PROGRESS`); after that, the order is auto-cancelled and the buyer's
   payment is voided/refunded automatically.
3. A seller who accepted an order could still sit on it indefinitely without
   ever submitting proof, leaving the buyer's money held with no work in
   progress. **Fix:** the seller now has a fixed 24-hour window after
   accepting to submit proof; after that, the order is auto-cancelled and
   refunded the same way as an unaccepted order.

All three windows are enforced by minute-by-minute cron jobs — no client
action is required to trigger them. The app's job is to **display the
countdown** and **react to the resulting notifications/socket events**.

## 2. New fields on the `Order` object

Returned by `GET /orders/:id`, `GET /orders/my-orders`,
`GET /orders/my_service_orders`, and all `/order` socket payloads — same as
every other `Order` column.

| Field | Type | Set when | Cleared when |
|---|---|---|---|
| `acceptDeadline` | `ISO date \| null` | Order created (buyer pays) — `createdAt + 12h` | Seller accepts (`status → IN_PROGRESS`), or order is cancelled |
| `proofSubmitDeadline` | `ISO date \| null` | Seller accepts — `inProgressAt + 24h` | Seller submits proof, or order is cancelled |
| `proofReviewDeadline` | `ISO date \| null` | Seller submits proof — `proofSubmittedAt + 24h` | Buyer reviews (proof accepted/rejected → `RELEASED`/`RESUBMIT`), or order is cancelled |

Each is `null` outside the phase it applies to — e.g. `acceptDeadline` is
always `null` once `status` leaves `PENDING`. Treat `null` as "no active
countdown for this timer," not as an error. **Exactly one** of the three is
ever non-null at a time for an order still in flight (`PENDING` →
`IN_PROGRESS` → `PROOF_SUBMITTED`).

> This mirrors the repost marketplace's `RepostOrder.countdownEndsAt` /
> `reviewWindowEndsAt` — if you've already built countdown UI for repost
> orders, the same component works here.

## 3. Timer 1 — Seller acceptance (`acceptDeadline`, 12h)

```
Buyer pays → status = PENDING, acceptDeadline = createdAt + 12h
   │
   ├── Seller calls PATCH /orders/:id/status?status=IN_PROGRESS within 12h
   │      → acceptDeadline cleared (null), proofSubmitDeadline = now + 24h (§4)
   │
   └── 12h pass with status still PENDING
          → cron auto-cancels: PaymentIntent voided, status = CANCELLED,
            cancelledAt = now, buyer refunded, both parties notified
```

**UI guidance:**

- While `status === "PENDING"` and `acceptDeadline` is set, show a countdown
  ("Waiting for seller to accept — expires in Xh Ym") on the buyer's order
  screen, and the same countdown on the seller's "New Order" screen as
  urgency to accept. Compute it from `acceptDeadline` directly rather than
  assuming a fixed 12h client-side.
- Once the countdown hits zero, don't rely on the client clock alone to flip
  UI state — re-fetch the order or wait for the socket event (§6), since the
  cron runs once a minute and there can be up to ~60s of lag between the
  deadline passing and the order actually flipping to `CANCELLED`.

## 4. Timer 2 — Seller proof submission (`proofSubmitDeadline`, 24h)

```
Seller accepts → status = IN_PROGRESS, proofSubmitDeadline = now + 24h
   │
   ├── Seller submits proof within 24h (POST /orders/ProofUpload)
   │      → status = PROOF_SUBMITTED, proofSubmitDeadline cleared,
   │        proofReviewDeadline = now + 24h starts (§5)
   │
   └── 24h pass with status still IN_PROGRESS
          → cron auto-cancels: PaymentIntent voided, status = CANCELLED,
            cancelledAt = now, buyer refunded, both parties notified
```

**Guarded exception:** the cron **skips** auto-cancel (order stays
`IN_PROGRESS`, nothing happens) if the order has an open (`UNDER_REVIEW`)
`Dispute` filed against it — same guard used everywhere else disputes lock
an order (see `ORDER_CANCELLATION_DISPUTE_APP_GUIDE.md` §6). It is **not**
guarded by `isCancelRequested` — if the buyer has an open cancellation
request, auto-cancelling and refunding them is exactly what they asked for,
so it's allowed to proceed.

**UI guidance:**

- While `status === "IN_PROGRESS"` and `proofSubmitDeadline` is set, show the
  seller a countdown: "Submit proof within Xh Ym or this order is
  auto-cancelled and refunded to the buyer." The buyer's order screen can
  show the same countdown as "Seller has until Xh Ym to deliver."
- If an open dispute exists, don't show this as "ticking down to
  cancellation" — the order is actually locked pending admin review.

## 5. Timer 3 — Buyer proof review (`proofReviewDeadline`, 24h)

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
   │        (a fresh 24h deadline is set the next time proof is submitted —
   │        note: re-submission after a rejection is not subject to a new
   │        proofSubmitDeadline, only the original accept→submit window was)
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
  notification is paired with (§6.1).
- If `isCancelRequested` or an open dispute exists, don't show the release
  countdown as "ticking down to release" — the funds are actually locked.
  Prefer messaging like "Under review — release paused" (reuses the existing
  dispute/cancel-request banners from `ORDER_CANCELLATION_DISPUTE_APP_GUIDE.md`
  §4).

## 6. Notification changes

### 6.1 Existing "proof submitted" notification — body text updated

No new notification type; the existing `UPLOAD_PROOF` push (and matching
email) sent to the buyer when the seller submits proof states the 24h
deadline, and the push `data` payload carries the deadline so the app can
render a countdown without an extra fetch:

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
    "proofReviewDeadline": "2026-09-18T10:00:00.000Z",
    "timestamp": "..."
  }
}
```

### 6.2 Auto-cancel — seller missed the acceptance window or the proof-submission window

Same `type` and payload shape for **both** timers; only the copy and
`data.action` differ, so branch UI copy on `data.action` if you need to
distinguish them (both just end in `status: "CANCELLED"`).

| Timer | Recipient | Title | Body | `data.action` |
|---|---|---|---|---|
| Acceptance (§3) | Buyer | `Order Cancelled — Refund Issued` | `@{seller} didn't accept order {orderCode} within 12 hours. Your payment has been refunded.` | `AUTO_CANCEL_UNACCEPTED` |
| Acceptance (§3) | Seller | `Order Expired` | `You missed the 12-hour window to accept order {orderCode}. It has been cancelled and refunded to the buyer.` | `AUTO_CANCEL_UNACCEPTED` |
| Proof submission (§4) | Buyer | `Order Cancelled — Refund Issued` | `@{seller} didn't submit proof for order {orderCode} within 24 hours of accepting. Your payment has been refunded.` | `AUTO_CANCEL_UNSUBMITTED` |
| Proof submission (§4) | Seller | `Order Expired` | `You missed the 24-hour window to submit proof for order {orderCode}. It has been cancelled and refunded to the buyer.` | `AUTO_CANCEL_UNSUBMITTED` |

`type` is `"ORDER_AUTO_CANCELLED"` for all four. `data` payload:

```json
{
  "orderId": "...",
  "orderCode": "ORD-123",
  "status": "CANCELLED",
  "action": "AUTO_CANCEL_UNACCEPTED",   // or "AUTO_CANCEL_UNSUBMITTED"
  "timestamp": "..."
}
```

The buyer also gets a plain-text confirmation email in both cases. Use
`data.action` if you need to distinguish either from a manual
buyer/seller-initiated cancellation in the notification feed UI (all three
still just result in `status: "CANCELLED"`).

### 6.3 Auto-release — buyer missed the 24h review window

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

## 7. Socket events — nothing new

No new socket events were added. All three auto-actions reuse the
**existing** `/order` namespace events, since they end in the same terminal
statuses a manual action would:

| Event | Fired by |
|---|---|
| `order:cancelled` | Auto-cancel (unaccepted order §3, or accepted-but-no-proof order §4), same event as a manual cancel |
| `order:released` | Auto-release (unreviewed proof §5), same event as a manual release |

If your UI already listens for these two events to refresh the order screen
(per `ORDER_SOCKET_GUIDE.md`), no socket-handling changes are needed — only
the push notification/history copy differs, plus the new deadline fields
for rendering countdowns.

## 8. Quick reference — field & timer summary

| | `acceptDeadline` | `proofSubmitDeadline` | `proofReviewDeadline` |
|---|---|---|---|
| Active while `status` is | `PENDING` | `IN_PROGRESS` | `PROOF_SUBMITTED` |
| Set on | Order creation (payment authorized) | Seller accepts | Proof submitted |
| Cleared on | Seller accepts, or order cancelled | Proof submitted, or order cancelled | Buyer reviews (release/reject), or order cancelled |
| Window length | 12h (flat) | 24h (flat) | 24h (flat) |
| On expiry | Auto-cancel + refund buyer | Auto-cancel + refund buyer | Auto-release funds to seller |
| Can be skipped by | — (no guard) | Open dispute | Open dispute or pending cancellation request |
| Resulting status | `CANCELLED` | `CANCELLED` | `RELEASED` |
| Socket event | `order:cancelled` | `order:cancelled` | `order:released` |
| Notification `type` | `ORDER_AUTO_CANCELLED` | `ORDER_AUTO_CANCELLED` | `ORDER_UPDATE` (buyer) / `PAYMENT_RECEIVED` (seller) |
| `data.action` | `AUTO_CANCEL_UNACCEPTED` | `AUTO_CANCEL_UNSUBMITTED` | `AUTO_RELEASE` |

## Related code

- `prisma/schema/order.prisma` — `Order.acceptDeadline`, `Order.proofSubmitDeadline`, `Order.proofReviewDeadline`
- `prisma/migrations/20260916150000_add_order_deadlines/`,
  `prisma/migrations/20260917160900_add_order_proof_submit_deadline/`
- `src/main/order-scheduler/order-scheduler.service.ts` — the three cron jobs
  (`handleAcceptanceExpiry`, `handleProofSubmissionExpiry`, `handleProofReviewExpiry`)
- `src/main/order/order.service.ts` — `submitProof()` (sets `proofReviewDeadline`,
  clears `proofSubmitDeadline`), `autoCancelExpiredOrder()` (shared helper),
  `autoCancelUnacceptedOrder()`, `autoCancelUnsubmittedOrder()`,
  `statusTimestampData()` (sets/clears deadlines on every status transition)
- `src/main/payments/payments.service.ts` — `createOrderWithPaymentMethod()`
  (sets `acceptDeadline` = `createdAt + 12h`), `autoReleaseEscrow()`
