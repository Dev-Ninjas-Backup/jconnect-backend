# Service Order Socket Guide

Realtime companion for service orders (`/orders`). Every REST action that changes an
`Order`'s status (pay / start / proof / release / cancel, plus delivery-date and proof
cancel) also pushes a Socket.IO event to the buyer and seller.

> Listings and payments setup remain REST-only. Only `Order` lifecycle changes are
> pushed over this socket.

## Namespace & connection

```
wss://<host>/order
```

Dedicated namespace, isolated from `/repost`, `/dj/chat`, and `/notification`.
`cors: { origin: "*" }`.

**Auth** — send a JWT on connect, either as:

- `Authorization: Bearer <token>` handshake header, or
- `auth: { token: "Bearer <token>" }` in the Socket.IO client's `auth` option

On success the server auto-joins the socket to a **personal room named with the raw
`userId`** and emits `order:success`. On failure it emits `order:error` and disconnects.

```js
const socket = io("https://api.example.com/order", {
  auth: { token: `Bearer ${jwt}` },
  transports: ["websocket"],
});

socket.on("order:success", (d) => console.log("connected as", d.userId));
socket.on("order:error", (d) => console.error("order socket error:", d.message));
```

## Rooms

| Room | Joined how | Receives |
| ---- | ---------- | -------- |
| `<userId>` | Automatically on connect | Every lifecycle event where you're buyer or seller |
| `order:<orderId>` | Via `order:join_order` | Events for that one order |

## Client → Server

| Event | Body | Response |
| ----- | ---- | -------- |
| `order:join_order` | `orderId` | `order:success` `{ joined }` or `order:error` |
| `order:leave_order` | `orderId` | (none) |
| `order:get_order` | `orderId` | same event name with order (+ service/buyer/seller) |

## Server → Client

| Event | Trigger | REST / path |
| ----- | ------- | ----------- |
| `order:created` | Order created after payment | `POST /payments/make-payment` |
| `order:in_progress` | Seller starts work | `PATCH /orders/:id/status?status=IN_PROGRESS` |
| `order:proof_submitted` | Seller uploads proof | `POST /orders/ProofUpload` or status patch |
| `order:released` | Escrow released | `POST /payments/approve-payment` / status `RELEASED` |
| `order:cancelled` | Cancel / refund | status `CANCELLED` / `POST` refund |
| `order:delivery_date_updated` | Delivery date set | `PATCH /orders/:id/delivery-date` |
| `order:proof_cancelled` | Proof cleared | `PATCH /orders/:id/cancel-proof?isCancalProofSubmitted=true` |
| `order:deleted` | Order deleted | `DELETE /orders/delete/:orderId` |

Payload = order row + `timestamp` (ISO). Emitted to buyer room, seller room, and
`order:<id>` if joined.

### Status flow ↔ events

```
PENDING          → order:created
IN_PROGRESS      → order:in_progress
PROOF_SUBMITTED  → order:proof_submitted
RELEASED         → order:released
CANCELLED        → order:cancelled
```

## Minimal client example

```js
import { io } from "socket.io-client";

const socket = io("wss://api.example.com/order", {
  auth: { token: `Bearer ${jwt}` },
  transports: ["websocket"],
});

socket.on("order:created", (o) => { /* new order in list */ });
socket.on("order:in_progress", (o) => { /* seller started */ });
socket.on("order:proof_submitted", (o) => { /* review proof */ });
socket.on("order:released", (o) => { /* done */ });
socket.on("order:cancelled", (o) => { /* cancelled */ });

// optional: focus a detail screen
socket.emit("order:join_order", orderId);
```

## Event name reference

```
order:error                    server→client
order:success                  server→client
order:created                  server→client
order:in_progress              server→client
order:proof_submitted          server→client
order:released                 server→client
order:cancelled                server→client
order:delivery_date_updated    server→client
order:proof_cancelled          server→client
order:deleted                  server→client
order:join_order               client→server
order:leave_order              client→server
order:get_order                client↔server
```
