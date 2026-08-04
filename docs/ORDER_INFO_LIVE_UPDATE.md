# Order Info Page — Live Update Documentation

Realtime behavior of the **Order Info** page (the page that shows the order timeline,
status, promotion info / chat card, and proof files). This document describes how the
buyer and seller see live updates on that page without polling.

> **Audience:** Backend, frontend, and mobile developers integrating the Order Info UI.

---

## Table of Contents

1. [What is "Order Info"](#what-is-order-info)
2. [Live-update sources at a glance](#live-update-sources-at-a-glance)
3. [The `/order` namespace](#the-order-namespace)
4. [Connecting](#connecting)
5. [Rooms](#rooms)
6. [Server → Client events](#server--client-events)
7. [Promotion info hiding rules](#promotion-info-hiding-rules)
8. [Business rules wired into the live updates](#business-rules-wired-into-the-live-updates)
9. [REST endpoints that trigger live updates](#rest-endpoints-that-trigger-live-updates)
10. [Service-request live updates (chat card)](#service-request-live-updates-chat-card)
11. [Client implementation recipes](#client-implementation-recipes)
12. [Edge cases & FAQ](#edge-cases--faq)
13. [File map](#file-map)

---

## What is "Order Info"

The **Order Info** page is the detail view a buyer or seller opens from the order list.
It shows, at minimum:

- Order code, amount, status (`PENDING` / `IN_PROGRESS` / `PROOF_SUBMITTED` / `RELEASED` / `CANCELLED`).
- The **timeline** of the order (created → accepted → proof submitted → released).
- The **service request / promotional attachment** block:
  - `captionOrInstructions`, `specialNotes`, `promotionDate`
  - uploaded files
  - `isDeclined` / `isAccepted` flags
- The **proof files** uploaded by the seller.
- The **delivery date**.
- The linked private chat card (promotional message bubble).

When **anything** in that data changes on the server (status change, file upload,
decline / accept, etc.), the buyer and seller pages must update in real time so the
timeline and promotional info stay in sync without a manual refresh.

---

## Live-update sources at a glance

Two namespaces participate:

| Namespace | Used for | Why |
| --- | --- | --- |
| `/order` | Order status, proof, delivery date, **service-request updates attached to the order**, deleted/cancelled state | Order Info page is the primary consumer |
| `/notification` | Push notifications + persisted in-app notification feed | Secondary — fans out to the bell icon / notification center |

All emit operations are funneled through `OrderGateway` (`src/main/order/order.gateway.ts`).
Service classes do not talk to `socket.io` directly; they call helper methods on the
gateway (e.g. `orderGateway.emitStatusChange(updated)`, `orderGateway.emitServiceRequestUpdated(...)`).

---

## The `/order` namespace

```
Endpoint: /order  (Socket.IO namespace)
Auth:     JWT in `Authorization: Bearer <token>` header
          OR `auth: { token: "Bearer <token>" }`
CORS:     origin: "*"
```

Implementation: `OrderGateway` (`src/main/order/order.gateway.ts`).

```ts
@WebSocketGateway({
    cors: { origin: "*" },
    namespace: "/order",
})
```

---

## Connecting

```ts
import { io } from "socket.io-client";

const socket = io("https://api.example.com/order", {
    auth: { token: `Bearer ${jwt}` },
    transports: ["websocket"],
});

socket.on("order:success", (d) => console.log("connected as", d.userId));
socket.on("order:error",   (e) => console.error("order socket error:", e.message));
```

On connect the gateway:

1. Reads `Authorization` (header) or `auth.token`.
2. Verifies the JWT against `JWT_SECRET`.
3. Resolves the user from the database.
4. Stores `userId` on the socket, joins the user to a personal room `<userId>`,
   emits `order:success`.
5. If any step fails, emits `order:error` and disconnects.

> The personal room is shared with all `/order` events that target that user.

---

## Rooms

| Room | Joined how | Receives |
| --- | --- | --- |
| `<userId>` | Automatic on connect | Every Order Info event where the user is the buyer or seller |
| `order:<orderId>` | `emit: order:join_order` | Events scoped to **one** order — useful for the order detail page |

Use `order:join_order` when the user is on the Order Info page, so they receive
events for that order even if the buyer/seller hasn't auto-routed (for example,
admin-side views or future viewers). Use the personal room for everything else
(the list page, the bell-icon notifications, etc.).

```ts
socket.emit("order:join_order", orderId);
socket.on("order:success", (d) => console.log("joined", d.joined));

socket.emit("order:leave_order", orderId);
```

Access is enforced server-side: only the `buyerId` or `sellerId` of the order can
join the `order:<orderId>` room. Others get `order:error`.

---

## Server → Client events

Every event payload includes the resource plus an `orderId` (when applicable) and a
`timestamp` (ISO string). The client can use `timestamp` to drop late events.

| Event | When | Payload shape | Order Info effect |
| --- | --- | --- | --- |
| `order:created` | New order placed | full `Order` row | Appears in the list / card preview |
| `order:in_progress` | Seller accepts / starts work | `Order` row with `status = IN_PROGRESS` | Status pill + timeline step lights up |
| `order:proof_submitted` | Seller uploaded proof | `Order` row with `proofUrl[]` | Proof block appears with download links |
| `order:released` | Buyer confirmed delivery | `Order` row with `status = RELEASED` | Status pill + timeline completion |
| `order:cancelled` | Order cancelled (buyer / seller / admin) | `Order` row with `status = CANCELLED` | Status pill + timeline stops |
| `order:delivery_date_updated` | Seller updated delivery date | `Order` row | Delivery-date row in Order Info refreshes |
| `order:proof_cancelled` | Proof submission cancelled | `Order` row with `proofUrl = []` | Proof block clears in real time |
| `order:deleted` | Order deleted by buyer / admin | `{ id }` | Page hides the order |
| `order:service_request_updated` | Chat card changed (decline / accept / buyer resubmits files) | full `ServiceRequest` + `orderId` + `timestamp` | **Promotion info visibility** changes live |

All status-driven emits go through one helper:

```ts
emitStatusChange(order: any) {
    switch (order?.status) {
        case "IN_PROGRESS":    this.emitInProgress(order); break;
        case "PROOF_SUBMITTED": this.emitProofSubmitted(order); break;
        case "RELEASED":       this.emitReleased(order); break;
        case "CANCELLED":      this.emitCancelled(order); break;
        case "PENDING":        this.emitOrderCreated(order); break;
    }
}
```

The gateway emits every event to **both** the personal room of each party and
`order:<orderId>`:

```ts
private push(userIds: string[], event: OrderEvents, data: any) {
    const payload = { ...data, timestamp: new Date().toISOString() };
    for (const uid of userIds) {
        if (uid) this.server.to(uid).emit(event, payload);
    }
    if (data?.id) {
        this.server.to(`order:${data.id}`).emit(event, payload);
    }
}
```

---

## Promotion info hiding rules

The promotion-info block on Order Info is sourced from the linked **service request**,
not the order. It is **hidden** automatically by `OrdersService.getOrder(id)` whenever:

- The service request is currently `isDeclined === true` (seller declined, awaiting
  buyer re-submission).

```ts
// src/main/order/order.service.ts (getOrder)
const showPromotionInfo = !serviceRequest?.isDeclined;

return {
    ...orderData,
    captionOrInstructions: showPromotionInfo ? (sr?.captionOrInstructions ?? null) : null,
    specialNotes:          showPromotionInfo ? (sr?.specialNotes ?? null)          : null,
    promotionDate:         showPromotionInfo ? (sr?.promotionDate ?? null)         : null,
    files:                 showPromotionInfo ? (sr?.uploadedFileUrl ?? [])         : [],
    isServiceRequestDeclined: sr?.isDeclined ?? false,
    isServiceRequestAccepted: sr?.isAccepted ?? false,
};
```

The Order Info page must:

1. Render `captionOrInstructions` / `specialNotes` / `promotionDate` / `files` only
   when `isServiceRequestDeclined === false`.
2. When the buyer re-submits files (which resets `isDeclined` to `false`), the
   `order:service_request_updated` event arrives with the updated service request —
   the client should re-fetch `GET /orders/:id` (or merge in the updated fields)
   so the promotion info reappears.

### Why a separate event?

The promotion info lives on the **service request**, not the order. Order-status
events (`order:in_progress`, etc.) do not change when the seller toggles
`isDeclined`/`isAccepted` or when the buyer re-uploads files. That's why
`order:service_request_updated` exists — to notify the Order Info page that the
chat card / promotion block has changed in real time.

---

## Business rules wired into the live updates

The same REST endpoints that emit events also enforce two important guards. They
must be reflected in the UI immediately after the corresponding event lands.

### 1. Seller cannot cancel after receiving the order

`OrdersService.updateStatus` blocks the seller from transitioning an order to
`CANCELLED` once they have already received it (`status` is `IN_PROGRESS`,
`PROOF_SUBMITTED`, or `RELEASED`):

```ts
if (isSeller) {
    throw new BadRequestException(
        "You cannot cancel an order after you have received it. " +
        "Please complete the work and let the buyer confirm delivery.",
    );
}
```

The buyer can still send a cancellation request when the order is `IN_PROGRESS`
or `PROOF_SUBMITTED` — in that case the seller receives an email and is the
final decision-maker.

### 2. Seller cannot decline the promotional attachment after receiving the order

`PrivateChatService.updateIsDeclined(id, { isDeclined: true }, actingUserId)`
(and the matching `ServiceRequestService` path) checks the linked order. If the
order is `IN_PROGRESS`, `PROOF_SUBMITTED`, or `RELEASED`, the request is rejected
with HTTP 400:

```ts
throw new BadRequestException(
    "You have already received this order, so you can no longer decline " +
    "the promotional attachment. Please complete the work and let the buyer " +
    "confirm delivery.",
);
```

Lookup prefers `order.serviceRequestId`, then falls back to the same
`buyerId + serviceId` with `createdAt >= serviceRequest.createdAt` so decline
is still blocked when payment did not persist `serviceRequestId`.

Buyer paid + order still `PENDING` → decline remains allowed.
The buyer can still re-submit documents at any time, which resets `isDeclined`
back to `false` and emits `order:service_request_updated`.

---

## REST endpoints that trigger live updates

| REST call | Service method | Gateway emit |
| --- | --- | --- |
| `POST /orders` (create) | `OrdersService.createOrder` | `emitOrderCreated` |
| `PATCH /orders/:id/status` (`IN_PROGRESS`) | `updateStatus` | `emitStatusChange → IN_PROGRESS` |
| `PATCH /orders/:id/status` (`PROOF_SUBMITTED`) | `updateStatus` | `emitStatusChange → PROOF_SUBMITTED` |
| `PATCH /orders/:id/status` (`RELEASED`) | `updateStatus` | `emitStatusChange → RELEASED` |
| `PATCH /orders/:id/status` (`CANCELLED`) | `updateStatus` | `emitStatusChange → CANCELLED` |
| `PATCH /orders/:id/cancel-proof` (true + body `{ reason }`) | `updateCancalProofSubmitted` | `emitProofCancelled` |
| `PATCH /orders/:id/cancel-proof` (false) | `updateCancalProofSubmitted` | `emitStatusChange` |
| `PATCH /orders/:id/delivery-date` | `updateDeliveryDate` | `emitDeliveryDateUpdated` |
| `POST /orders/:id/proof` | `submitProof` | `emitProofSubmitted` |
| `DELETE /orders/:id` | `deleteOrder` | `emitOrderDeleted` |
| `PATCH /service-requests/:id/is-declined` (`isDeclined=true`) | `PrivateChatService.updateIsDeclined` | `emitServiceRequestUpdated` + `/dj/chat` `serviceRequestUpdated` |
| `PATCH /service-requests/:id/is-declined` (`isAccepted=true`) | `PrivateChatService.updateIsDeclined` | `emitServiceRequestUpdated` + `/dj/chat` `serviceRequestUpdated` |
| `PATCH /service-requests/:id/uploaded-files` | `PrivateChatService.updateUploadedFiles` | `emitServiceRequestUpdated` + `/dj/chat` `serviceRequestFilesUpdated` |

If a REST call fails, **no** socket event is emitted. Clients should rely on the
HTTP response for error UX.

---

## Service-request live updates (chat card)

`emitServiceRequestUpdated` is the bridge that keeps Order Info in sync with the
chat card:

```ts
emitServiceRequestUpdated(orderId: string, userIds: string[], serviceRequest: any) {
    const payload = { ...serviceRequest, orderId, timestamp: new Date().toISOString() };
    for (const uid of userIds) {
        if (uid) this.server.to(uid).emit(OrderEvents.SERVICE_REQUEST_UPDATED, payload);
    }
    if (orderId) {
        this.server.to(`order:${orderId}`).emit(OrderEvents.SERVICE_REQUEST_UPDATED, payload);
    }
}
```

The service looks up the linked order (matching `serviceRequestId` first, falling
back to `buyerId + serviceId`) and emits to **both** the buyer's personal room,
the seller's personal room, and the `order:<orderId>` room.

`/dj/chat` namespace also emits `serviceRequestUpdated` /
`serviceRequestFilesUpdated` for the chat thread. Clients consuming both should
use `timestamp` to keep the latest state.

---

## Client implementation recipes

### Join the order room when the page opens

```ts
useEffect(() => {
    const socket = io("/order", { auth: { token: `Bearer ${jwt}` } });

    socket.on("connect", () => socket.emit("order:join_order", orderId));

    socket.on("order:success", (d) => console.log("joined", d.joined));
    socket.on("order:error",   (e) => console.error(e.message));

    socket.on("order:in_progress", (o) => setStatus(o.status));
    socket.on("order:proof_submitted", (o) => setProof(o.proofUrl));
    socket.on("order:released", (o) => setStatus(o.status));
    socket.on("order:cancelled", (o) => setStatus(o.status));
    socket.on("order:delivery_date_updated", (o) => setDeliveryDate(o.deliveryDate));
    socket.on("order:proof_cancelled", (o) => setProof([]));
    socket.on("order:deleted", () => navigate("/orders"));

    socket.on("order:service_request_updated", (sr) => {
        // Promotion info becomes visible/hidden based on sr.isDeclined.
        // Either re-fetch GET /orders/:id or merge fields locally:
        setShowPromotionInfo(!sr.isDeclined);
        if (!sr.isDeclined) {
            setCaptionOrInstructions(sr.captionOrInstructions);
            setSpecialNotes(sr.specialNotes);
            setPromotionDate(sr.promotionDate);
            setFiles(sr.uploadedFileUrl || []);
        }
    });

    return () => {
        socket.emit("order:leave_order", orderId);
        socket.disconnect();
    };
}, [orderId]);
```

### Re-fetch only when the payload is incomplete

If the Order Info endpoint (`GET /orders/:id`) returns the full merged view with
all the promotion rules applied, simply call it inside any socket handler:

```ts
socket.on("order:service_request_updated", async () => {
    const fresh = await api.get(`/orders/${orderId}`);
    setOrder(fresh);
});
```

### Drop stale events

```ts
socket.on("order:status_change", (o) => {
    if (new Date(o.timestamp).getTime() < lastSeenAt.current) return;
    lastSeenAt.current = new Date(o.timestamp).getTime();
    setOrder(o);
});
```

### Mobile / Flutter sketch

```dart
socket.on('order:in_progress',        (o) => setState(() => status = 'IN_PROGRESS'));
socket.on('order:proof_submitted',    (o) => setState(() => proofUrls = o['proofUrl']));
socket.on('order:released',           (o) => setState(() => status = 'RELEASED'));
socket.on('order:cancelled',          (o) => setState(() => status = 'CANCELLED'));
socket.on('order:delivery_date_updated', (o) => setState(() => deliveryDate = o['deliveryDate']));
socket.on('order:proof_cancelled',    (o) => setState(() => proofUrls = []));
socket.on('order:service_request_updated', (sr) {
    setState(() {
        showPromotionInfo = !(sr['isDeclined'] ?? false);
        if (showPromotionInfo) {
            captionOrInstructions = sr['captionOrInstructions'];
            specialNotes          = sr['specialNotes'];
            promotionDate         = sr['promotionDate'];
            files                 = List<String>.from(sr['uploadedFileUrl'] ?? []);
        }
    });
});
```

---

## Edge cases & FAQ

**Q. The buyer is on the Order Info page but didn't tap "join room". Will they still
get the live update?**
Yes. All event helpers emit to the personal `<userId>` room *and* the
`order:<orderId>` room. If the page just opens the `/order` socket and listens, it
will receive every event for that user.

**Q. The seller is online but the buyer is offline — does the buyer still get the
update when they come back?**
The buyer will get the latest data from `GET /orders/:id` when they reload. The
gateway only delivers while both ends are connected.

**Q. The promotion info disappeared after the seller declined. When does it
re-appear?**
When the buyer **re-submits** the documents (`PATCH /service-requests/:id/uploaded-files`).
That endpoint resets `isDeclined` to `false` and emits
`order:service_request_updated`. The Order Info page should re-fetch / merge and
show the block again.

**Q. The seller accidentally clicked "Cancel order" after starting the work. What
happens?**
The server returns `400 Bad Request` with the message *"You cannot cancel an order
after you have received it..."* No event is emitted, the order status stays
unchanged.

**Q. The seller tries to decline the promotional attachment after the buyer paid
but the order is still `PENDING`.**
Allowed — `PENDING` is the only status where the seller can still decline.

**Q. What happens if a service request has no linked order?**
`emitServiceRequestUpdated` is still called for the buyer and seller personal rooms;
the `order:<orderId>` emit is skipped (no `orderId`). Order Info pages won't be
notified because they aren't open.

**Q. Are notification bell updates part of this?**
No — those come from the `/notification` namespace and the FCM push pipeline.
See **[Notification System](./NOTIFICATION_SYSTEM.md)** for that side.

---

## File map

```
src/main/order/
├── order.gateway.ts                  ← OrderEvents, connection, emit* helpers, /order namespace
├── order.service.ts                  ← getOrder (hides promotion info), updateStatus, submitProof,
│                                       updateCancalProofSubmitted, updateDeliveryDate,
│                                       deleteOrder, createOrder
├── order.controller.ts               ← REST endpoints (PATCH /:id/status, /proof, etc.)
└── order.module.ts                   ← Wires OrdersService, OrderGateway, Stripe, Notifications

src/main/shared/private-message/
├── service/private-message.service.ts ← updateIsDeclined (seller-decline guard),
│                                        updateUploadedFiles (resets isDeclined)
├── controller/private-message.controller.ts ← REST endpoints feeding Order Info live updates
└── privateChatGateway/privateChatGateway.ts ← /dj/chat emits for the chat thread

src/main/shared/notification/
└── firebase-notification.service.ts  ← Builds title===body templates; the FCM push side
```

Related docs:

- **[Notification System](./NOTIFICATION_SYSTEM.md)** — FCM push + `/notification` socket
- **[Order Socket Guide](./ORDER_SOCKET_GUIDE.md)** — Original per-event reference
- **[Service Request Update Socket Guide](./SERVICE_REQUEST_UPDATE_SOCKET_GUIDE.md)** —
  Wire format of `order:service_request_updated` and `/dj/chat` `serviceRequestUpdated`
- **[Architecture Diagrams](./ARCHITECTURE_DIAGRAMS.md)** — Visual system design

---

**Last updated:** July 30, 2026