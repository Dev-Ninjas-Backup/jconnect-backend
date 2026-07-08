# Repost Socket Guide

Realtime companion to [`REPOST_API_GUIDE.md`](./REPOST_API_GUIDE.md). Every REST action
that changes a `RepostOrder`'s status (accept/reject/submit-proof/review/redo, plus the
auto-expiry and auto-release cron) also pushes a Socket.IO event to the buyer and seller
so both sides' screens update live without polling.

> Repost listings (`/repost-listings`) are pure REST — there is no socket activity for
> listing creation/updates. Only `RepostOrder` lifecycle changes are pushed over sockets.

## Namespace & connection

```
wss://<host>/repost
```

Dedicated namespace, isolated from the app's generic `/notification` namespace (used for
non-repost push-style events) and from the `/repost-order` REST module's HTTP routes.
`cors: { origin: "*" }`, default Socket.IO adapter (no custom path prefix).

**Auth** — send a JWT on connect, either as:

- `Authorization: Bearer <token>` handshake header, or
- `auth: { token: "Bearer <token>" }` in the Socket.IO client's `auth` option

The server verifies it with `jsonwebtoken.verify(token, JWT_SECRET)` (same secret as the
REST API's JWT guard) and resolves `payload.sub` → `User.id`. This is a different
verification path than the `@nestjs/jwt` `JwtService` used elsewhere in the app, but the
token itself is the same one issued at login.

On successful auth the server auto-joins the socket to a **personal room named with the
raw `userId`** — this is how order events reach "the buyer" or "the seller" without the
client doing anything else. On failure the server emits `repost:error` and disconnects.

```js
const socket = io("https://api.example.com/repost", {
  auth: { token: `Bearer ${jwt}` },
});

socket.on("repost:success", (d) => console.log("connected as", d.userId));
socket.on("repost:error", (d) => console.error("repost socket error:", d.message));
```

**Connection failure cases** (all emit `repost:error` then `disconnect(true)`):

| Cause                              | `message`                       |
| ------------------------------------ | ---------------------------------- |
| No `Authorization` header / `auth.token` | `Missing authorization header`  |
| Header present but no token part (`Bearer ` with nothing after) | `Missing token` |
| `jwt.verify` throws (expired/invalid/malformed) | the underlying JWT error message |
| Token's `sub` doesn't match a `User` row | `User not found`                 |

---

## Rooms

| Room                | Joined how                                             | Receives                                    |
| --------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| `<userId>`           | Automatically on successful connection                     | Every lifecycle event for every order where you're buyer or seller |
| `order:<orderId>`    | Explicitly via `repost:join_order` (see below)              | Every lifecycle event for that one order — useful for a screen that's currently viewing a specific order, independent of who else is subscribed |

Every server→client lifecycle event is broadcast to **both**: the buyer's personal room,
the seller's personal room, *and* the `order:<id>` room (if the emitted payload carries
an `id`). A client sitting on the order-detail screen doesn't need to do anything extra
to receive updates — the personal-room join on connect is already enough — `join_order`
is only useful if you want a client that *isn't* buyer/seller-bound (e.g. a shared
screen) to still track one order, or just to keep the semantics of "I'm looking at this
order" explicit.

---

## Client → Server events

### `repost:join_order`

```js
socket.emit("repost:join_order", orderId);
```

Verifies the caller is the buyer or seller on `orderId`, then joins `order:<orderId>`.

- Success → `repost:success` `{ joined: "order:<orderId>" }`
- Not found / not a participant → `repost:error` `{ message: "Order not found or access denied" }`

### `repost:leave_order`

```js
socket.emit("repost:leave_order", orderId);
```

Leaves `order:<orderId>`. No ack event emitted.

### `repost:get_order`

```js
socket.emit("repost:get_order", orderId);
socket.on("repost:get_order", (order) => { ... }); // response comes back on the same event name
```

One-shot fetch of the current order state over the socket (an alternative to
`GET /repost-orders/:id` for a client that's already connected). Response includes
`listing`, `buyer` (`id`, `username`, `profilePhoto`), `seller` (same shape), and a
`timeRemaining` object based on `countdownEndsAt`:

```json
{
  "id": "order-uuid",
  "status": "ACCEPTED",
  "...": "...full RepostOrder row...",
  "listing": { "...": "..." },
  "buyer": { "id": "...", "username": "...", "profilePhoto": "..." },
  "seller": { "id": "...", "username": "...", "profilePhoto": "..." },
  "timeRemaining": { "expired": false, "ms": 3421000, "minutes": 57 }
}
```

> Note: unlike `GET /repost-orders/:id`'s REST response, this socket payload's
> `timeRemaining` has no `formatted` (`HH:MM:SS`) field, and only covers the fulfillment
> countdown — it doesn't include `reviewTimeRemaining` / `redoTimeRemaining`. Use the REST
> endpoint if the UI needs those.

Not found / not a participant → `repost:error` `{ message: "Order not found" }`.

---

## Server → Client events

All nine map 1:1 to `RepostOrderStatus` transitions already described in the REST guide's
[Escrow capture/void table](./REPOST_API_GUIDE.md#escrow-capturevoid-stripe-wiring) and
[buyer review flow](./REPOST_API_GUIDE.md#buyer-review-flow-screens--endpoints). Except
for `repost:countdown_alert`, the payload is **the raw `RepostOrder` row** as returned/
mutated by that action (not necessarily including `listing`/`buyer`/`seller` relations —
those are only present if the emitting call happened to select them), plus a `timestamp`
(ISO string, stamped at emit time) appended by the shared `push()` helper.

| Event                     | Emitted to      | Trigger                                                                 | REST action that causes it |
| --------------------------- | ------------------ | -------------------------------------------------------------------------- | ------------------------------ |
| `repost:order_created`     | buyer + seller + order room | New order finalized                                                    | `POST /repost-orders`          |
| `repost:seller_accepted`   | buyer + seller + order room | Seller accepts the request (`status` → `ACCEPTED`)                     | `POST /repost-orders/:id/accept` |
| `repost:seller_rejected`   | buyer + seller + order room | Seller rejects the request (`status` → `REJECTED`, payment voided)     | `POST /repost-orders/:id/reject` |
| `repost:proof_submitted`   | buyer + seller + order room | Seller uploads proof (`status` → `PROOF_SUBMITTED`); payload includes `reviewWindowEndsAt` | `POST /repost-orders/:id/submit-proof` |
| `repost:redo_requested`    | buyer + seller + order room | Buyer asks for a redo (`status` → `REDO_REQUESTED`); payload includes `redoWindowEndsAt` | `POST /repost-orders/:id/review` `{action:"REDO"}` |
| `repost:order_completed`   | buyer + seller + order room | Escrow released — buyer `ACCEPT`, **or** the auto-release cron (`status` → `COMPLETED`, `isReleased: true`) | `POST /repost-orders/:id/review` `{action:"ACCEPT"}`, or automatic |
| `repost:order_refunded`    | buyer + seller + order room | Escrow voided — buyer `REJECT`, **or** fulfillment countdown expiry, **or** redo-window expiry (`status` → `REFUNDED`) | `POST /repost-orders/:id/review` `{action:"REJECT"}`, or automatic |
| `repost:countdown_alert`   | **seller only** (no order room) | Cron warns the seller their fulfillment deadline is approaching        | automatic (see below)          |
| `repost:proof_reviewed`    | — | **Declared in the event enum but never emitted anywhere in the current code.** Don't rely on it — `repost:redo_requested` / `repost:order_completed` / `repost:order_refunded` are what actually fire for the three review outcomes (ACCEPT/REJECT/REDO). | — |

### `repost:countdown_alert` payload (different shape — not a full order row)

```json
{
  "orderId": "order-uuid",
  "minutesLeft": 30,
  "countdownEndsAt": "2026-07-08T14:00:00.000Z",
  "timestamp": "2026-07-08T13:30:00.000Z"
}
```

Sent only to the seller's personal room (`this.server.to(order.sellerId)`), **not** to
the buyer and **not** to the `order:<id>` room. Fired by `RepostSchedulerService`'s
per-minute cron at 60/30/15/5 minutes remaining on the fulfillment countdown (each
threshold sent at most once per order, tracked via `alert60Sent`/`alert30Sent`/
`alert15Sent`/`alert5Sent` flags).

### Everything else: raw `RepostOrder` row + `timestamp`

Example — `repost:seller_accepted`:

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
  "status": "ACCEPTED",
  "contentUrl": "https://instagram.com/p/abc123",
  "countdownEndsAt": "2026-07-08T14:00:00.000Z",
  "paymentIntentId": "pi_3P...",
  "isReleased": false,
  "createdAt": "2026-07-08T12:00:00.000Z",
  "updatedAt": "2026-07-08T12:05:00.000Z",
  "timestamp": "2026-07-08T12:05:00.123Z"
}
```

`RepostOrder` field reference: see the REST guide's [`POST /repost-orders`
response](./REPOST_API_GUIDE.md#3-post-repost-orders) for the full row shape, and the
enums section for `RepostOrderStatus` / `RepostTimeframe` / `ProofType` values.

---

## Push notifications are a separate channel

Most of the same actions also send an FCM push notification (`FirebaseNotificationService
.sendToUser()`) and write a `Notification` row — e.g. on accept, reject, proof submission,
redo, completion, refund, and the same countdown-approaching cases. That path is
completely independent of the `/repost` socket: it doesn't go through
`RepostOrderGateway`, uses its own ad hoc `type` strings (e.g. `REPOST_SELLER_ACCEPTED`,
`ESCROW_FUNDS_RELEASED`, `REPOST_EXPIRING_SOON`) that aren't part of the socket event
names above, and fires whether or not the user has an active `/repost` socket connection.
Use the socket for live in-app updates while a screen is open; use push/`Notification`
rows for out-of-app alerts and notification-center history.

---

## Event name reference

```
repost:error              server→client   connection/validation failure
repost:success             server→client   connection/join-order acknowledgement
repost:order_created       server→client   buyer + seller + order room
repost:seller_accepted     server→client   buyer + seller + order room
repost:seller_rejected     server→client   buyer + seller + order room
repost:proof_submitted     server→client   buyer + seller + order room
repost:proof_reviewed      —               declared, currently unused
repost:redo_requested      server→client   buyer + seller + order room
repost:order_completed     server→client   buyer + seller + order room
repost:order_refunded      server→client   buyer + seller + order room
repost:countdown_alert     server→client   seller only
repost:join_order          client→server   join an order room
repost:leave_order         client→server   leave an order room
repost:get_order           client→server   fetch one order; response on same event name
```
