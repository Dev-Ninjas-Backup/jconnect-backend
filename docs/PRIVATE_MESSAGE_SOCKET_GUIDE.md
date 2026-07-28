# Private Message Socket Guide

Realtime private chat over Socket.IO. Connect to `/dj/chat`, auth with the same JWT used by REST, then load conversations / send messages. New messages are pushed to both participants’ personal rooms.

Related REST base: `/private-chat`

## Namespace & connection

```
wss://<host>/dj/chat
```

`cors: { origin: "*" }`, default Socket.IO adapter (no custom path prefix).

**Auth** — send a JWT on connect, either as:

- `Authorization: Bearer <token>` handshake header, or
- `auth: { token: "Bearer <token>" }` in the Socket.IO client's `auth` option

The server verifies with `jsonwebtoken.verify(token, JWT_SECRET)` and resolves `payload.sub` → `User.id`.

On success the socket auto-joins a **personal room named with the raw `userId`**, and the server emits `private:success` with that `userId`. On failure it emits `private:error` and disconnects.

```js
const socket = io("https://api.example.com/dj/chat", {
  auth: { token: `Bearer ${jwt}` },
  transports: ["websocket"],
});

socket.on("private:success", (userId) => console.log("connected as", userId));
socket.on("private:error", (d) => console.error("chat socket error:", d.message));
```

**Connection failure cases** (emit `private:error` then disconnect):

| Cause | `message` |
| ----- | --------- |
| No `Authorization` / `auth.token` | `Missing authorization header` |
| Header present but empty token | `Missing token` |
| Invalid/expired JWT | underlying JWT error message |
| Token `sub` not found in DB | `User not found in database` |

---

## Rooms

| Room | Joined how | Receives |
| ---- | ---------- | -------- |
| `<userId>` | Automatically on successful connection | `private:new_message`, conversation list updates, service-request side events |

There is no separate conversation room — delivery is always to the sender’s and recipient’s personal rooms.

---

## Client → Server events

### `private:load_conversations`

```js
socket.emit("private:load_conversations");
socket.on("private:conversation_list", (conversations) => { ... });
```

Loads all conversations for the authenticated user (same shape as the REST conversation list). Response event: `private:conversation_list`.

### `private:load_single_conversation`

```js
socket.emit("private:load_single_conversation", conversationId);
socket.on("private:new_conversation", (conversation) => { ... });
```

Loads one conversation **with messages**. Response event: `private:new_conversation` (single conversation object with `messages`).

> Note: when a **brand-new** conversation is created by `private:send_message`, `private:new_conversation` is also emitted — but with the **full conversation list** for that user, not a single conversation. Prefer `private:conversation_list` for list refreshes and treat the post-send emit as a list refresh signal.

### `private:send_message`

```js
socket.emit("private:send_message", {
  recipientId: "user-uuid",
  content: "Hello",
  files: [],                    // optional: stored file paths
  serviceId: "service-uuid",    // optional
  serviceRequestId: "sr-uuid",  // optional
  replyToMessageId: "msg-uuid", // optional
});
```

Creates the conversation if none exists between sender and recipient, saves the message, then:

1. Emits `private:new_message` to **both** sender and recipient rooms
2. If the conversation was newly created, emits `private:new_conversation` (conversation list) to both users
3. Also sends an FCM push to the recipient (`NEW_MESSAGE`) — independent of whether they have an open socket

Errors:

| Cause | `private:error` message |
| ----- | ----------------------- |
| Not authenticated | `User not authenticated` |
| Socket user ≠ token user | `User ID mismatch` |
| `recipientId ===` self | `Cannot send message to yourself` |

---

## Server → Client events

| Event | When | Payload |
| ----- | ---- | ------- |
| `private:success` | Connect / ack | `userId` string |
| `private:error` | Auth / validation / disconnect | `{ message }` |
| `private:conversation_list` | After `private:load_conversations` | Array of conversations |
| `private:new_conversation` | After `private:load_single_conversation` **or** first message in a new thread | Single conversation (+ messages) **or** full list (see note above) |
| `private:new_message` | Message created (socket or helper) | Message row + `sender`, `service`, `serviceRequest` |
| `serviceRequestUpdated` | Service request changed (accept/decline, or Paid → Cancelled on order cancel/refund) | Updated service request (+ `buyer`, `service.creator`) |
| `serviceRequestFilesUpdated` | Service request files changed | Updated service request |

### `serviceRequestUpdated` triggers

Emitted to the buyer room and the seller (`service.creator`) room when:

| Trigger | REST / path | Typical `status` |
| ------- | ----------- | ---------------- |
| Accept / decline chat request | `PATCH /private-chat/:id/is-declined` | unchanged (`isAccepted` / `isDeclined`) |
| Order cancelled | `PATCH /orders/:id/status?status=CANCELLED` | `CANCELLED` (was `PAID`) |
| Order refunded | `POST /payments/refund/:orderId` | `CANCELLED` (was `PAID`) |

Use this event to update the chat card button live (e.g. **Paid** → **Cancelled**) without refresh.
Order lifecycle events stay on `/order` — see [ORDER_SOCKET_GUIDE.md](./ORDER_SOCKET_GUIDE.md).

### Example `private:new_message` payload

```json
{
  "id": "message-uuid",
  "content": "Hello",
  "conversationId": "conversation-uuid",
  "senderId": "user-uuid",
  "serviceId": null,
  "serviceRequestId": null,
  "files": [],
  "createdAt": "2026-07-27T15:24:00.000Z",
  "sender": {
    "id": "user-uuid",
    "profilePhoto": "...",
    "full_name": "...",
    "username": "..."
  },
  "service": null,
  "serviceRequest": null
}
```

---

## Minimal client example

```js
import { io } from "socket.io-client";

const socket = io("wss://api.example.com/dj/chat", {
  auth: { token: `Bearer ${jwt}` },
  transports: ["websocket"],
});

socket.on("private:success", () => {
  socket.emit("private:load_conversations");
});

socket.on("private:conversation_list", (list) => {
  // render inbox
});

socket.on("private:new_message", (msg) => {
  // append to open thread / bump inbox
});

socket.on("serviceRequestUpdated", (sr) => {
  // chat card: e.g. sr.status === "CANCELLED" after cancel/refund
});

socket.emit("private:send_message", {
  recipientId: otherUserId,
  content: "Hi",
});
```

---

## Event name reference

```
private:error                     server→client
private:success                   server→client
private:load_conversations        client→server  → private:conversation_list
private:load_single_conversation  client→server  → private:new_conversation
private:send_message              client→server  → private:new_message (+ maybe private:new_conversation)
private:new_message               server→client
private:conversation_list         server→client
private:new_conversation          server→client
serviceRequestUpdated             server→client  (side channel on same namespace)
serviceRequestFilesUpdated        server→client  (side channel on same namespace)
```
