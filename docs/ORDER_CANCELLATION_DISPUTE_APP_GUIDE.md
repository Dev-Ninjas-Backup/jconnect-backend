# Order Cancellation & Dispute — App Developer Guide

Reference for building the buyer/seller order screens once an order is
`IN_PROGRESS` (i.e. after the seller has accepted it). Covers button visibility,
API contracts, response fields, socket events, and error handling.

Related backend docs: [`ORDER_CANCEL_REQUEST_PROOF_BLOCK.md`](./ORDER_CANCEL_REQUEST_PROOF_BLOCK.md).

## 1. Core rule

Once the seller accepts an order (`status` becomes `IN_PROGRESS`), the buyer can
**no longer directly cancel** the order. The normal "Cancel" button must be
replaced by two actions:

- **Request Cancellation**
- **Report an Issue**

Neither action auto-refunds the buyer or auto-cancels the order. A cancellation
request only changes `status` to `CANCELLED` once the **seller approves it**
(or an issue report is resolved by an admin in the buyer's favor).

## 2. Order status model

```
PENDING → IN_PROGRESS → PROOF_SUBMITTED → RELEASED
              │                │
              ├──────────► RESUBMIT (proof rejected by buyer, loops back)
              │
              └────────────────┴─────────► CANCELLED
```

`OrderStatus` enum: `PENDING | IN_PROGRESS | PROOF_SUBMITTED | RESUBMIT | CANCELLED | RELEASED`

A cancellation **request** or a dispute report does **not** move the order into
a new status — `status` stays whatever it was (`IN_PROGRESS` /
`PROOF_SUBMITTED` / `RESUBMIT`). Read the extra fields below to know whether a
request/dispute is pending.

## 3. Extra fields on the `Order` object (`GET /orders/:id`, socket payloads)

| Field | Type | Meaning |
|---|---|---|
| `status` | `OrderStatus` | Unaffected by a pending cancellation request or dispute. |
| `isCancelRequested` | `boolean` | `true` while the buyer has an unresolved cancellation request pending seller action. |
| `cancelRequestedAt` | `ISO date \| null` | When the request was made. `null` once resolved (seller accepts → order `CANCELLED`; seller declines → cleared). |

There is currently **no dispute status embedded on the `Order` object**. To
know whether an order has an open dispute, query the Dispute endpoints
described in §6 (see the note in §6.4 about the current limitation for
sellers).

## 4. Button visibility logic

| Order state | Buyer sees | Seller sees |
|---|---|---|
| `status = PENDING` | `Cancel Order` (direct cancel) | — |
| `status ∈ {IN_PROGRESS, PROOF_SUBMITTED, RESUBMIT}` and `isCancelRequested = false` and no open dispute | `Request Cancellation`, `Report an Issue` | normal seller actions (upload proof, etc.) |
| `status ∈ {IN_PROGRESS, PROOF_SUBMITTED, RESUBMIT}` and `isCancelRequested = true` | `Request Cancellation` button hidden/disabled ("Cancellation requested — waiting for seller"), `Report an Issue` still available | `Accept Cancellation`, `Decline Cancellation`; proof upload is blocked server-side |
| Order has an open (`UNDER_REVIEW`) dispute | Show "Under review by DaConnect" state; no cancel/proof actions matter, order is locked | Same — proof upload and fund release are blocked server-side |
| `status = CANCELLED` | Terminal | Terminal |
| `status = RELEASED` | Terminal | Terminal |

## 5. Cancellation request flow

### 5.1 Buyer requests cancellation

```
PATCH /orders/:id/status?status=CANCELLED
Auth: buyer's Bearer token
```

Only valid while `order.status` is `IN_PROGRESS`, `PROOF_SUBMITTED`, or
`RESUBMIT`, and the caller is the order's buyer. On success:

```json
{ "message": "Cancellation request sent to seller successfully" }
```

Server side effects: `isCancelRequested = true`, `cancelRequestedAt = now()`.
`status` is **not** changed. The seller gets an email.

> If `order.status = PENDING`, this same endpoint performs a real, immediate
> cancellation instead (pre-acceptance cancel — no request/approval step).
> That path is unchanged and out of scope for this guide.

### 5.2 Seller accepts the cancellation request

```
PATCH /orders/:id/status?status=CANCELLED
Auth: seller's Bearer token
```

Same endpoint, called by the seller instead. Cancels the Stripe payment
intent, sets `status = CANCELLED`, `cancelledAt = now()`, and notifies both
parties. This is the only path that produces a refund/cancellation for a
buyer-requested cancellation.

### 5.3 Seller declines the cancellation request

```
PATCH /orders/:id/cancel-request/decline
Auth: seller's Bearer token
```

- Requires `order.isCancelRequested = true`; otherwise `400 Bad Request`
  ("There is no pending cancellation request for this order").
- Requires the caller to be the order's seller; otherwise `403 Forbidden`.

On success, clears `isCancelRequested = false` / `cancelRequestedAt = null`
and returns the updated order:

```json
{
  "id": "...",
  "status": "IN_PROGRESS",
  "isCancelRequested": false,
  "cancelRequestedAt": null,
  "...": "...other order fields",
  "timeline": [ ... ],
  "message": "Cancellation request declined. The order remains in progress."
}
```

The order stays exactly where it was — the buyer is emailed, push-notified,
and gets the `order:cancel_request_declined` socket event (§7). From here the
buyer can re-request cancellation later, or escalate via "Report an Issue".

## 6. Report an Issue (Dispute) flow

Disputes live in a separate module (`/disputes`), not under `/orders`.

### 6.1 File a dispute

```
POST /disputes
Auth: any authenticated user (buyer or seller) Bearer token
Content-Type: multipart/form-data

Body:
  orderId: string        (required)
  description: string    (required)
  resolution: string     (optional — rarely set on create)
  files: File[]          (optional — evidence, uploaded to S3)
```

Response:

```json
{
  "dispute": {
    "id": "...",
    "orderId": "...",
    "userId": "...",
    "description": "...",
    "status": "UNDER_REVIEW",
    "proofs": ["https://..."],
    "createdAt": "...",
    "order": { "...": "..." },
    "user": { "...": "..." }
  }
}
```

Fails with `400 Bad Request` if the same user already has a dispute
`UNDER_REVIEW` for that order.

### 6.2 What filing a dispute locks

While a `Dispute` exists with `status = "UNDER_REVIEW"` for an order:

- `POST /orders/ProofUpload` → `400 Bad Request` ("This order has a dispute
  under review. You cannot upload proof until the dispute is resolved.")
- `PATCH /orders/:id/status?status=RELEASED` (buyer confirming delivery) →
  `400 Bad Request` ("...Funds are locked until the dispute is resolved.")
- `POST /payments/approve-payment` (`approvePayment`, buyer/admin fund
  release) → same `400 Bad Request`.

The lock lifts automatically as soon as an admin resolves the dispute (§6.3)
— no separate "unlock" call is needed.

### 6.3 Resolving a dispute (admin only)

```
PATCH /disputes/:id
Auth: admin Bearer token
Body: { "status": "RESOLVED" | "REJECTED", "resolution": "..." }
```

Once `status` is `RESOLVED` or `REJECTED`, the order is unlocked again (proof
upload and fund release work normally). Resolving a dispute does **not**
automatically cancel the order or refund the buyer — if a refund is the
resolution, an admin/seller still drives that through the normal cancel path
(§5.2) or a manual Stripe action.

### 6.4 Checking dispute state from the app

- **Buyer**: `GET /disputes/my` returns the buyer's own disputes (each
  includes the full `order`). Filter client-side for
  `orderId === thisOrder.id && status === "UNDER_REVIEW"` to know if this
  order is currently locked by the buyer's own dispute.
- **Seller**: there is currently **no seller-facing endpoint** to check
  whether an order they're fulfilling has an open dispute filed against it.
  The seller will simply see proof upload / order actions start failing with
  the `400` messages above. If the seller UI needs to show a proactive
  "Under review" banner rather than just surfacing the error, that requires a
  new backend endpoint (e.g. `GET /orders/:id/dispute-status`) — flag this to
  backend if the seller experience needs it.
- **Admin**: `GET /disputes`, `GET /disputes/filter` (paginated, filterable by
  `status`, date range, and `search` matching dispute id or order code).

## 7. Socket events (`/order` namespace)

Connect with the JWT the same way as other order sockets (`Authorization`
header or `auth.token` on handshake), then join `order:<id>` to receive
per-order events.

| Event | Emitted when |
|---|---|
| `order:cancelled` | Order fully cancelled (buyer pre-accept cancel, or seller accepts a cancellation request) |
| `order:cancel_request_declined` | Seller declines a pending cancellation request (§5.3) |
| `order:in_progress` / `order:proof_submitted` / `order:released` | Normal status transitions, unaffected by this flow |

There is no dedicated socket event for "buyer requested cancellation" or
"dispute filed/resolved" yet — the app should re-fetch `GET /orders/:id`
(and, for the buyer, `GET /disputes/my`) after calling §5.1 or §6.1, or on a
reasonable polling/refresh interval, until a dedicated event exists.

## 8. Error reference (this flow only)

| Endpoint | Condition | Response |
|---|---|---|
| `PATCH /orders/:id/status?status=CANCELLED` (buyer, in-progress order) | — | `200` — request recorded, not an error |
| `PATCH /orders/:id/cancel-request/decline` | Caller isn't the seller | `403 Forbidden` |
| `PATCH /orders/:id/cancel-request/decline` | No pending request (`isCancelRequested = false`) | `400 Bad Request` |
| `POST /orders/ProofUpload` | `isCancelRequested = true` | `400 Bad Request` |
| `POST /orders/ProofUpload` | Open dispute (`UNDER_REVIEW`) | `400 Bad Request` |
| `PATCH /orders/:id/status?status=RELEASED` | Open dispute (`UNDER_REVIEW`) | `400 Bad Request` |
| `POST /payments/approve-payment` | Open dispute (`UNDER_REVIEW`) | `400 Bad Request` |
| `POST /disputes` | Caller already has an `UNDER_REVIEW` dispute on this order | `400 Bad Request` |
