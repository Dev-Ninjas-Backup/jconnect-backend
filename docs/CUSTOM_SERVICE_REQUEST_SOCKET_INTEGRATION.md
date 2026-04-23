# Custom Service Request Socket Integration

## Overview

This document explains the Socket.IO integration for the Custom Service Request module. The implementation supports both **REST API** and **WebSocket** approaches, with real-time updates broadcasted to all connected clients.

## Architecture

### Dual Communication Approach

1. **REST API**: Traditional HTTP endpoints for CRUD operations
2. **WebSocket**: Real-time bidirectional communication via Socket.IO

Both approaches trigger the same real-time socket events, ensuring all connected clients receive updates regardless of how the data was modified.

---

## Socket Events

### Connection Events

- **Namespace**: `/service`
- **Authentication**: JWT token required in `authorization` header or `auth.token`
- **User Room**: Each authenticated user automatically joins a room with their `userId`

### Available Events

#### 1. **service:create** (Socket Event)

Create a new custom service request via WebSocket.

**Emit Payload:**

```json
{
    "buyerId": "user_123",
    "targetCreatorId": "creator_456",
    "serviceName": "Promotional Shoutout",
    "description": "30-sec promotional video",
    "budgetRangeMin": 50,
    "budgetRangeMax": 100
}
```

**Response Events:**

- `service:created` - Sent to buyer and target creator
- `service:list_updated` - Broadcasted to all clients
- `service:error` - On failure

---

#### 2. **service:get_all** (Socket Event)

Fetch all custom service requests via WebSocket.

**Emit Payload:**

```json
{}
```

**Response Events:**

- `service:get_service_requests` - List of all requests with count

---

#### 3. **service:get_one** (Socket Event)

Fetch a single custom service request via WebSocket.

**Emit Payload:**

```json
{
    "id": "request_uuid"
}
```

**Response Events:**

- `service:fetched` - The requested service data
- `service:error` - If not found

---

#### 4. **service:update** (Socket Event)

Update a custom service request via WebSocket.

**Emit Payload:**

```json
{
    "id": "request_uuid",
    "data": {
        "serviceName": "Updated Service Name",
        "description": "Updated description"
    }
}
```

**Response Events:**

- `service:updated` - Sent to buyer and target creator
- `service:list_updated` - Broadcasted to all clients
- `service:error` - On failure

---

#### 5. **service:delete** (Socket Event)

Delete a custom service request via WebSocket.

**Emit Payload:**

```json
{
    "id": "request_uuid"
}
```

**Response Events:**

- `service:deleted` - Sent to buyer and target creator
- `service:list_updated` - Broadcasted to all clients (with deleted ID only)
- `service:error` - On failure

---

#### 6. **service:accept** (Socket Event)

Accept a custom service request via WebSocket.

**Emit Payload:**

```json
{
    "id": "request_uuid"
}
```

**Response Events:**

- `service_request_accept` - Sent to buyer and target creator
- `service_request_status` - Status changed to 'ACCEPTED'
- `service:error` - On failure

---

#### 7. **service:decline** (Socket Event)

Decline a custom service request via WebSocket.

**Emit Payload:**

```json
{
    "id": "request_uuid",
    "reason": "Not available at this time"
}
```

**Response Events:**

- `service_request_decline` - Sent to buyer and target creator
- `service_request_status` - Status changed to 'DECLINED'
- `service:error` - On failure

---

## REST API Endpoints (with Socket Integration)

All REST API operations automatically trigger socket events to notify connected clients.

### 1. **POST /custom-requests**

Create a new custom service request.

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Body:**

```json
{
    "buyerId": "user_123",
    "targetCreatorId": "creator_456",
    "serviceName": "Promotional Shoutout",
    "description": "30-sec promotional video",
    "budgetRangeMin": 50,
    "budgetRangeMax": 100
}
```

**Response:** `201 Created`

```json
{
  "id": "request_uuid",
  "buyerId": "user_123",
  "targetCreatorId": "creator_456",
  "serviceName": "Promotional Shoutout",
  ...
}
```

**Socket Events Emitted:**

- `service:created` → Sent to `buyerId` and `targetCreatorId` rooms
- `service:list_updated` → Broadcasted to all connected clients

---

### 2. **GET /custom-requests**

Fetch all custom service requests.

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Response:** `200 OK`

```json
[
  {
    "id": "request_uuid",
    "buyerId": "user_123",
    "serviceName": "Service 1",
    ...
  },
  ...
]
```

**Socket Events Emitted:**

- `service:get_service_requests` → Broadcasted to all clients

---

### 3. **GET /custom-requests/:id**

Fetch a single custom service request by ID.

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Response:** `200 OK`

```json
{
  "id": "request_uuid",
  "buyerId": "user_123",
  ...
}
```

**Socket Events Emitted:**

- None (read operations don't trigger broadcasts for individual gets via REST)

---

### 4. **PATCH /custom-requests/:id**

Update a custom service request.

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Body:**

```json
{
    "serviceName": "Updated Service Name",
    "description": "Updated description"
}
```

**Response:** `200 OK`

```json
{
  "id": "request_uuid",
  "serviceName": "Updated Service Name",
  ...
}
```

**Socket Events Emitted:**

- `service:updated` → Sent to `buyerId` and `targetCreatorId` rooms
- `service:list_updated` → Broadcasted to all connected clients

---

### 5. **DELETE /custom-requests/:id**

Delete a custom service request.

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Response:** `200 OK`

```json
{
  "id": "request_uuid",
  ...
}
```

**Socket Events Emitted:**

- `service:deleted` → Sent to `buyerId` and `targetCreatorId` rooms
- `service:list_updated` → Broadcasted to all connected clients

---

## Event Payload Structures

### service:created / service:updated / service:deleted

```json
{
  "event": "created" | "updated" | "deleted",
  "data": {
    "id": "request_uuid",
    "buyerId": "user_123",
    "targetCreatorId": "creator_456",
    "serviceName": "Service Name",
    "description": "Description",
    ...
  },
  "timestamp": "2026-03-10T12:00:00.000Z"
}
```

### service:list_updated

```json
{
  "action": "created" | "updated" | "deleted",
  "data": { ... }, // Full object for created/updated, { id } for deleted
  "timestamp": "2026-03-10T12:00:00.000Z"
}
```

### service:get_service_requests

```json
{
  "event": "list_fetched",
  "data": [ ... ], // Array of service requests
  "count": 10,
  "timestamp": "2026-03-10T12:00:00.000Z"
}
```

### service:fetched

```json
{
  "event": "fetched",
  "data": { ... }, // Single service request
  "timestamp": "2026-03-10T12:00:00.000Z"
}
```

### service_request_status

```json
{
  "event": "status_changed",
  "data": { ... },
  "status": "ACCEPTED" | "DECLINED",
  "timestamp": "2026-03-10T12:00:00.000Z"
}
```

### service_request_accept

```json
{
  "event": "accepted",
  "data": { ... },
  "timestamp": "2026-03-10T12:00:00.000Z"
}
```

### service_request_decline

```json
{
  "event": "declined",
  "data": { ... },
  "reason": "Optional reason string",
  "timestamp": "2026-03-10T12:00:00.000Z"
}
```

### service:error

```json
{
    "event": "error",
    "error": "Error message",
    "timestamp": "2026-03-10T12:00:00.000Z"
}
```

---

## Client Implementation Examples

### JavaScript/TypeScript (Socket.IO Client)

#### Connection

```typescript
import { io } from "socket.io-client";

const socket = io("http://localhost:3000/service", {
    auth: {
        token: "Bearer your_jwt_token_here",
    },
});

socket.on("connect", () => {
    console.log("Connected to service namespace");
});

socket.on("service:success", (userId) => {
    console.log("Authenticated as user:", userId);
});

socket.on("service:error", (error) => {
    console.error("Socket error:", error);
});
```

#### Creating a Service Request (via Socket)

```typescript
socket.emit("service:create", {
    buyerId: "user_123",
    targetCreatorId: "creator_456",
    serviceName: "Promotional Shoutout",
    description: "30-sec promotional video",
    budgetRangeMin: 50,
    budgetRangeMax: 100,
});

// Listen for response
socket.on("service:created", (response) => {
    console.log("Service request created:", response.data);
});
```

#### Listening for Real-time Updates

```typescript
// Listen for any service created (from REST or Socket)
socket.on("service:created", (data) => {
    console.log("New service request created:", data);
    // Update UI
});

// Listen for updates
socket.on("service:updated", (data) => {
    console.log("Service request updated:", data);
    // Update UI
});

// Listen for deletions
socket.on("service:deleted", (data) => {
    console.log("Service request deleted:", data);
    // Remove from UI
});

// Listen for list updates (broadcast to all)
socket.on("service:list_updated", (data) => {
    console.log("Service list updated:", data.action, data.data);
    // Refresh list or update specific item
});
```

#### Fetching All Requests (via Socket)

```typescript
socket.emit("service:get_all");

socket.on("service:get_service_requests", (response) => {
    console.log(`Received ${response.count} service requests:`, response.data);
});
```

#### Fetching Single Request (via Socket)

```typescript
socket.emit("service:get_one", { id: "request_uuid" });

socket.on("service:fetched", (response) => {
    console.log("Fetched service request:", response.data);
});
```

#### Updating a Request (via Socket)

```typescript
socket.emit("service:update", {
    id: "request_uuid",
    data: {
        serviceName: "Updated Service Name",
        description: "Updated description",
    },
});

socket.on("service:updated", (response) => {
    console.log("Service request updated:", response.data);
});
```

#### Deleting a Request (via Socket)

```typescript
socket.emit("service:delete", { id: "request_uuid" });

socket.on("service:deleted", (response) => {
    console.log("Service request deleted:", response.data);
});
```

#### Accepting/Declining Requests (via Socket)

```typescript
// Accept
socket.emit("service:accept", { id: "request_uuid" });
socket.on("service_request_accept", (response) => {
    console.log("Request accepted:", response.data);
});

// Decline
socket.emit("service:decline", {
    id: "request_uuid",
    reason: "Not available at this time",
});
socket.on("service_request_decline", (response) => {
    console.log("Request declined:", response.data, response.reason);
});
```

---

### React Example (with Hooks)

```typescript
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

function useServiceSocket(token: string) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [requests, setRequests] = useState<any[]>([]);

    useEffect(() => {
        const newSocket = io("http://localhost:3000/service", {
            auth: { token: `Bearer ${token}` },
        });

        newSocket.on("connect", () => console.log("Connected"));

        // Listen for real-time updates
        newSocket.on("service:created", (data) => {
            setRequests((prev) => [...prev, data.data]);
        });

        newSocket.on("service:updated", (data) => {
            setRequests((prev) => prev.map((req) => (req.id === data.data.id ? data.data : req)));
        });

        newSocket.on("service:deleted", (data) => {
            setRequests((prev) => prev.filter((req) => req.id !== data.data.id));
        });

        newSocket.on("service:list_updated", (data) => {
            // Handle list updates from any source
            if (data.action === "created") {
                setRequests((prev) => [...prev, data.data]);
            } else if (data.action === "updated") {
                setRequests((prev) =>
                    prev.map((req) => (req.id === data.data.id ? data.data : req)),
                );
            } else if (data.action === "deleted") {
                setRequests((prev) => prev.filter((req) => req.id !== data.data.id));
            }
        });

        setSocket(newSocket);

        return () => {
            newSocket.close();
        };
    }, [token]);

    const createRequest = (data: any) => {
        socket?.emit("service:create", data);
    };

    const getAllRequests = () => {
        socket?.emit("service:get_all");
        socket?.on("service:get_service_requests", (response) => {
            setRequests(response.data);
        });
    };

    return { socket, requests, createRequest, getAllRequests };
}
```

---

### Flutter/Dart Example

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

class ServiceSocketService {
  late IO.Socket socket;

  void connect(String token) {
    socket = IO.io('http://localhost:3000/service', <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': true,
      'auth': {'token': 'Bearer $token'}
    });

    socket.on('connect', (_) {
      print('Connected to service namespace');
    });

    socket.on('service:success', (userId) {
      print('Authenticated as user: $userId');
    });

    socket.on('service:error', (error) {
      print('Socket error: $error');
    });

    // Listen for real-time updates
    socket.on('service:created', (data) {
      print('Service created: $data');
      // Update UI
    });

    socket.on('service:updated', (data) {
      print('Service updated: $data');
      // Update UI
    });

    socket.on('service:deleted', (data) {
      print('Service deleted: $data');
      // Update UI
    });

    socket.on('service:list_updated', (data) {
      print('List updated: ${data['action']}');
      // Refresh list
    });
  }

  void createRequest(Map<String, dynamic> data) {
    socket.emit('service:create', data);
  }

  void getAllRequests() {
    socket.emit('service:get_all');
  }

  void disconnect() {
    socket.disconnect();
  }
}
```

---

## Benefits of This Architecture

### 1. **Flexibility**

- Clients can choose REST API or WebSocket based on their needs
- REST for simple CRUD operations
- WebSocket for real-time updates and bidirectional communication

### 2. **Real-time Updates**

- All clients receive updates regardless of how data was modified
- REST API calls trigger socket events automatically
- WebSocket operations trigger the same events

### 3. **Efficient Broadcasting**

- Targeted notifications to specific users (buyer, creator)
- Global broadcasts for list updates
- Room-based messaging for scalability

### 4. **Backward Compatibility**

- Existing REST API clients continue to work
- Socket functionality is additive, not breaking

### 5. **Authentication**

- Both REST and WebSocket use the same JWT authentication
- Secure user-specific rooms
- Automatic disconnection on auth failure

---

## Testing

### Test WebSocket with Postman or Insomnia

1. Create a new WebSocket request
2. URL: `ws://localhost:3000/service`
3. Connect with auth header: `Authorization: Bearer <token>`
4. Send events as JSON

### Test REST API with Postman

1. Use standard HTTP methods (POST, GET, PATCH, DELETE)
2. Add Authorization header: `Bearer <token>`
3. Connected socket clients will receive real-time updates

### Monitor Socket Events

```typescript
// In your socket gateway, enable debug logging
socket.onAny((event, ...args) => {
    console.log(`Event: ${event}`, args);
});
```

---

## Troubleshooting

### Connection Issues

- Verify JWT token is valid and not expired
- Check CORS settings for your client origin
- Ensure `/service` namespace is correct

### Events Not Received

- Verify client is listening to correct event names
- Check if user is authenticated (joined room)
- Enable debug logging on both client and server

### REST API Not Triggering Socket Events

- Ensure `serviceGateway` is properly injected in controller
- Check that `emitService*` methods are being called
- Verify WebSocket server is initialized

---

## Notes

- **ServiceRequest vs CustomServiceRequest**: The socket gateway uses `CustomServiceRequestService`, but can be adapted to work with `ServiceRequest` model by adjusting field references (`buyerId` exists in both models).
- **Future Enhancements**: Consider adding pagination support for `service:get_all` event.
- **Error Handling**: All socket events include error responses with timestamps for debugging.

---

## Summary

This implementation provides a robust, real-time communication system for custom service requests with:

- ✅ 7 WebSocket events for complete CRUD operations
- ✅ 5 REST API endpoints with automatic socket integration
- ✅ Real-time broadcasts to all connected clients
- ✅ Targeted notifications to specific users
- ✅ JWT authentication for both REST and WebSocket
- ✅ No changes to existing socket functionality
- ✅ Backward compatible with existing clients

Both REST and WebSocket clients receive the same real-time updates, ensuring data consistency across your application.
