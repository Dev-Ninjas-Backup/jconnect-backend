# Quick Reference: Custom Service Request Socket & REST API

## 🚀 Quick Start

### WebSocket Connection

```typescript
import { io } from "socket.io-client";

const socket = io("http://localhost:3000/service", {
    auth: { token: "Bearer YOUR_JWT_TOKEN" },
});
```

### REST API Base URL

```
http://localhost:3000/custom-requests
```

---

## 📡 Socket Events (7 Total)

| Event             | Direction       | Payload                         | Response Event                 |
| ----------------- | --------------- | ------------------------------- | ------------------------------ |
| `service:create`  | Client → Server | `{ buyerId, serviceName, ... }` | `service:created`              |
| `service:get_all` | Client → Server | `{}`                            | `service:get_service_requests` |
| `service:get_one` | Client → Server | `{ id }`                        | `service:fetched`              |
| `service:update`  | Client → Server | `{ id, data }`                  | `service:updated`              |
| `service:delete`  | Client → Server | `{ id }`                        | `service:deleted`              |
| `service:accept`  | Client → Server | `{ id }`                        | `service_request_accept`       |
| `service:decline` | Client → Server | `{ id, reason? }`               | `service_request_decline`      |

### Broadcast Events (Auto-emitted)

| Event                  | When                | Audience        |
| ---------------------- | ------------------- | --------------- |
| `service:created`      | New request created | Buyer & Creator |
| `service:updated`      | Request updated     | Buyer & Creator |
| `service:deleted`      | Request deleted     | Buyer & Creator |
| `service:list_updated` | Any CRUD operation  | All clients     |
| `service:error`        | Error occurs        | Specific client |

---

## 🔌 REST API Endpoints (5 Total)

| Method | Endpoint               | Auth | Socket Event Triggered                     |
| ------ | ---------------------- | ---- | ------------------------------------------ |
| POST   | `/custom-requests`     | ✅   | `service:created` + `service:list_updated` |
| GET    | `/custom-requests`     | ✅   | `service:get_service_requests`             |
| GET    | `/custom-requests/:id` | ✅   | None                                       |
| PATCH  | `/custom-requests/:id` | ✅   | `service:updated` + `service:list_updated` |
| DELETE | `/custom-requests/:id` | ✅   | `service:deleted` + `service:list_updated` |

---

## 💻 Code Snippets

### Create via Socket

```typescript
socket.emit("service:create", {
    buyerId: "user_123",
    serviceName: "Promo Shoutout",
    description: "30-sec video",
    budgetRangeMin: 50,
});

socket.on("service:created", (data) => {
    console.log("Created:", data.data);
});
```

### Create via REST

```bash
curl -X POST http://localhost:3000/custom-requests \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "buyerId": "user_123",
    "serviceName": "Promo Shoutout",
    "description": "30-sec video",
    "budgetRangeMin": 50
  }'
```

### Listen for Real-time Updates

```typescript
// Listen to all types of updates
socket.on("service:created", (data) => {
    /* New request */
});
socket.on("service:updated", (data) => {
    /* Updated request */
});
socket.on("service:deleted", (data) => {
    /* Deleted request */
});
socket.on("service:list_updated", (data) => {
    // Triggered by any CRUD operation (REST or Socket)
    console.log(data.action); // "created" | "updated" | "deleted"
});
```

### Update via Socket

```typescript
socket.emit("service:update", {
    id: "request_uuid",
    data: { serviceName: "New Name" },
});

socket.on("service:updated", (data) => {
    console.log("Updated:", data.data);
});
```

### Update via REST

```bash
curl -X PATCH http://localhost:3000/custom-requests/request_uuid \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "serviceName": "New Name" }'
```

### Fetch All via Socket

```typescript
socket.emit("service:get_all");

socket.on("service:get_service_requests", (response) => {
    console.log(`Got ${response.count} requests:`, response.data);
});
```

### Fetch All via REST

```bash
curl -X GET http://localhost:3000/custom-requests \
  -H "Authorization: Bearer TOKEN"
```

### Accept/Decline via Socket

```typescript
// Accept
socket.emit("service:accept", { id: "request_uuid" });
socket.on("service_request_accept", (data) => {
    console.log("Accepted:", data.data);
});

// Decline
socket.emit("service:decline", {
    id: "request_uuid",
    reason: "Not available",
});
socket.on("service_request_decline", (data) => {
    console.log("Declined:", data.data, data.reason);
});
```

---

## 🎯 Event Payload Examples

### service:created / service:updated / service:deleted

```json
{
    "event": "created",
    "data": {
        "id": "uuid",
        "buyerId": "user_123",
        "targetCreatorId": "creator_456",
        "serviceName": "Service Name",
        "description": "Description",
        "budgetRangeMin": 50,
        "budgetRangeMax": 100,
        "createdAt": "2026-03-10T12:00:00.000Z"
    },
    "timestamp": "2026-03-10T12:00:00.000Z"
}
```

### service:list_updated (Broadcast)

```json
{
    "action": "created",
    "data": {
        /* full object */
    },
    "timestamp": "2026-03-10T12:00:00.000Z"
}
```

### service:error

```json
{
    "event": "error",
    "error": "Error message here",
    "timestamp": "2026-03-10T12:00:00.000Z"
}
```

---

## 🔐 Authentication

### REST API

```
Authorization: Bearer YOUR_JWT_TOKEN
```

### WebSocket

```typescript
const socket = io("http://localhost:3000/service", {
    auth: { token: "Bearer YOUR_JWT_TOKEN" },
});
// OR
const socket = io("http://localhost:3000/service", {
    transportOptions: {
        polling: {
            extraHeaders: {
                Authorization: "Bearer YOUR_JWT_TOKEN",
            },
        },
    },
});
```

---

## 🎨 React Hook Example

```typescript
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

function useServiceRequests(token: string) {
    const [socket, setSocket] = useState(null);
    const [requests, setRequests] = useState([]);

    useEffect(() => {
        const s = io("http://localhost:3000/service", {
            auth: { token: `Bearer ${token}` },
        });

        s.on("service:list_updated", ({ action, data }) => {
            if (action === "created") {
                setRequests((prev) => [...prev, data]);
            } else if (action === "updated") {
                setRequests((prev) => prev.map((r) => (r.id === data.id ? data : r)));
            } else if (action === "deleted") {
                setRequests((prev) => prev.filter((r) => r.id !== data.id));
            }
        });

        setSocket(s);
        return () => s.close();
    }, [token]);

    const createRequest = (data) => socket?.emit("service:create", data);
    const fetchAll = () => socket?.emit("service:get_all");

    return { requests, createRequest, fetchAll };
}
```

---

## 🐛 Debugging

### Enable Debug Mode (Client)

```typescript
const socket = io("http://localhost:3000/service", {
    auth: { token: "Bearer TOKEN" },
    transports: ["websocket"],
    debug: true,
});

socket.onAny((event, ...args) => {
    console.log(`[${event}]`, args);
});
```

### Check Connection Status

```typescript
socket.on("connect", () => console.log("✅ Connected"));
socket.on("disconnect", () => console.log("❌ Disconnected"));
socket.on("connect_error", (err) => console.error("Error:", err));
```

---

## 📝 Common Patterns

### Pattern 1: Use REST for initial load, Socket for updates

```typescript
// Initial load via REST
const initialData = await fetch("http://localhost:3000/custom-requests", {
    headers: { Authorization: "Bearer TOKEN" },
});

// Listen for updates via Socket
socket.on("service:list_updated", updateUI);
```

### Pattern 2: Use Socket for everything

```typescript
socket.emit("service:get_all"); // Fetch
socket.on("service:get_service_requests", setData);
socket.on("service:list_updated", updateUI);
```

### Pattern 3: Use REST for mutations, Socket for notifications

```typescript
// Mutate via REST
await fetch("http://localhost:3000/custom-requests", {
    method: "POST",
    headers: { Authorization: "Bearer TOKEN" },
    body: JSON.stringify(data),
});

// Other clients receive notification via Socket
socket.on("service:created", (data) => {
    showNotification(`New request: ${data.data.serviceName}`);
});
```

---

## ⚡ Performance Tips

1. **Disconnect when not needed**

    ```typescript
    socket.disconnect();
    ```

2. **Remove listeners to prevent memory leaks**

    ```typescript
    useEffect(() => {
        socket.on("service:created", handler);
        return () => socket.off("service:created", handler);
    }, []);
    ```

3. **Use REST for bulk operations**
    - Fetching large lists → REST API
    - Real-time updates → Socket

4. **Debounce rapid updates**
    ```typescript
    const debouncedUpdate = debounce(() => {
        socket.emit("service:update", data);
    }, 300);
    ```

---

## 📚 Full Documentation

See: `docs/CUSTOM_SERVICE_REQUEST_SOCKET_INTEGRATION.md`

---

## ✅ Status

- **REST API**: 5 endpoints with socket integration
- **Socket Events**: 7 event handlers
- **Real-time Broadcasts**: Automatic for all operations
- **Authentication**: JWT required for both
- **Testing**: Ready
