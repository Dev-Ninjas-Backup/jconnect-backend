# Service Request Update - WebSocket Real-Time Notification Guide

## Overview

This guide explains how to update a service request and receive real-time notifications via WebSocket to both the buyer and seller (service creator).

---

## Architecture Flow

```
┌─────────────┐
│   Client    │
│  (Buyer/    │
│   Seller)   │
└──────┬──────┘
       │
       │ 1. HTTP PATCH Request
       │
       ▼
┌─────────────────────────────────────┐
│  PATCH /private-chat/:id/is-declined│
│  Controller: updateIsDeclined()      │
└──────┬──────────────────────────────┘
       │
       │ 2. Update Database
       │
       ▼
┌─────────────────────────────────────┐
│  Service: updateIsDeclined()         │
│  - Update ServiceRequest in DB       │
│  - Include buyer & creator info      │
└──────┬──────────────────────────────┘
       │
       │ 3. Emit via WebSocket
       │
       ▼
┌─────────────────────────────────────┐
│  Gateway: emitServiceRequestUpdate() │
│  - Emit to buyer's room              │
│  - Emit to seller's room             │
└──────┬──────────────────────────────┘
       │
       │ 4. Real-time notification
       │
       ▼
┌──────────────┬──────────────┐
│   Buyer      │   Seller     │
│  receives    │  receives    │
│  update      │  update      │
└──────────────┴──────────────┘
```

---

## Backend Implementation

### 1. REST API Endpoint

**Endpoint:** `PATCH /private-chat/:id/is-declined`

**Description:** Update service request status (decline/accept)

**Headers:**

```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| isDeclined | boolean | No | Set to `true` to decline the request |
| isAccepted | boolean | No | Set to `true` to accept the request |

**Example Request:**

```bash
PATCH http://localhost:3000/private-chat/service-request-id-123/is-declined?isAccepted=true
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**

```json
{
    "success": true,
    "updatedServiceRequest": {
        "id": "service-request-id-123",
        "serviceId": "service-id-456",
        "buyerId": "buyer-user-id",
        "isDeclined": false,
        "isAccepted": true,
        "price": 50.0,
        "captionOrInstructions": "Please promote my post",
        "buyer": {
            "id": "buyer-user-id",
            "full_name": "John Doe",
            "profilePhoto": "https://..."
        },
        "service": {
            "id": "service-id-456",
            "serviceName": "Instagram Promotion",
            "price": 50.0,
            "creator": {
                "id": "seller-user-id",
                "full_name": "Jane Smith",
                "profilePhoto": "https://..."
            }
        }
    }
}
```

---

## WebSocket Implementation

### Connection Setup

**Namespace:** `/dj/chat`

**Connection URL:**

```javascript
const socket = io("http://localhost:3000/dj/chat", {
    auth: {
        token: "Bearer YOUR_JWT_TOKEN",
    },
});
```

### Event Name

```
serviceRequestUpdated
```

### Event Flow

1. **User connects to WebSocket** → Automatically joins room with their `userId`
2. **Service request is updated via REST API** → Database updated
3. **Gateway emits to specific rooms:**
    - `buyer.id` room → Buyer receives notification
    - `service.creator.id` room → Seller receives notification
4. **Both users receive the same updated data in real-time**

---

## Frontend Integration Examples

### JavaScript/TypeScript (Socket.io Client)

#### 1. Setup Connection

```typescript
import { io, Socket } from "socket.io-client";

const socket: Socket = io("http://localhost:3000/dj/chat", {
    auth: {
        token: `Bearer ${localStorage.getItem("token")}`,
    },
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
});

// Connection success
socket.on("private:success", (userId) => {
    console.log("✅ Connected to private chat:", userId);
});

// Connection error
socket.on("private:error", (error) => {
    console.error("❌ Connection error:", error);
});
```

#### 2. Listen for Service Request Updates

```typescript
interface ServiceRequest {
    id: string;
    serviceId: string;
    buyerId: string;
    isDeclined: boolean;
    isAccepted: boolean;
    price: number;
    captionOrInstructions?: string;
    buyer: {
        id: string;
        full_name: string;
        profilePhoto: string;
    };
    service: {
        id: string;
        serviceName: string;
        creator: {
            id: string;
            full_name: string;
            profilePhoto: string;
        };
    };
}

socket.on("serviceRequestUpdated", (data: ServiceRequest) => {
    console.log("🔔 Service Request Updated:", data);

    // Update UI based on status
    if (data.isAccepted) {
        showNotification("success", "Service request accepted! ✅");
        updateServiceRequestUI(data);
    } else if (data.isDeclined) {
        showNotification("error", "Service request declined ❌");
        updateServiceRequestUI(data);
    }

    // Refresh the service request list or specific item
    refreshServiceRequestInUI(data.id, data);
});
```

#### 3. Update Service Request (REST API Call)

```typescript
async function updateServiceRequest(
    serviceRequestId: string,
    isAccepted?: boolean,
    isDeclined?: boolean,
) {
    try {
        const queryParams = new URLSearchParams();
        if (isAccepted !== undefined) {
            queryParams.append("isAccepted", isAccepted.toString());
        }
        if (isDeclined !== undefined) {
            queryParams.append("isDeclined", isDeclined.toString());
        }

        const response = await fetch(
            `http://localhost:3000/private-chat/${serviceRequestId}/is-declined?${queryParams}`,
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                    "Content-Type": "application/json",
                },
            },
        );

        const result = await response.json();
        console.log("✅ Update successful:", result);

        // WebSocket will automatically notify both buyer and seller
        return result;
    } catch (error) {
        console.error("❌ Update failed:", error);
        throw error;
    }
}
```

#### 4. Complete Example - React Component

```typescript
import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface ServiceRequestCardProps {
  serviceRequestId: string;
  initialData: ServiceRequest;
}

const ServiceRequestCard: React.FC<ServiceRequestCardProps> = ({
  serviceRequestId,
  initialData
}) => {
  const [serviceRequest, setServiceRequest] = useState(initialData);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io('http://localhost:3000/dj/chat', {
      auth: {
        token: `Bearer ${localStorage.getItem('token')}`
      }
    });

    socketInstance.on('serviceRequestUpdated', (data: ServiceRequest) => {
      // Only update if it's the current service request
      if (data.id === serviceRequestId) {
        setServiceRequest(data);

        // Show notification
        if (data.isAccepted) {
          toast.success('Request accepted! 🎉');
        } else if (data.isDeclined) {
          toast.error('Request declined ❌');
        }
      }
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [serviceRequestId]);

  const handleAccept = async () => {
    try {
      await fetch(
        `http://localhost:3000/private-chat/${serviceRequestId}/is-declined?isAccepted=true`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      // WebSocket will update the UI automatically
    } catch (error) {
      console.error('Failed to accept:', error);
    }
  };

  const handleDecline = async () => {
    try {
      await fetch(
        `http://localhost:3000/private-chat/${serviceRequestId}/is-declined?isDeclined=true`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      // WebSocket will update the UI automatically
    } catch (error) {
      console.error('Failed to decline:', error);
    }
  };

  return (
    <div className="service-request-card">
      <h3>{serviceRequest.service.serviceName}</h3>
      <p>Buyer: {serviceRequest.buyer.full_name}</p>
      <p>Price: ${serviceRequest.price}</p>

      {/* Status badges */}
      {serviceRequest.isAccepted && (
        <span className="badge badge-success">✅ Accepted</span>
      )}
      {serviceRequest.isDeclined && (
        <span className="badge badge-danger">❌ Declined</span>
      )}

      {/* Action buttons (only if not yet decided) */}
      {!serviceRequest.isAccepted && !serviceRequest.isDeclined && (
        <div className="actions">
          <button onClick={handleAccept} className="btn btn-success">
            Accept
          </button>
          <button onClick={handleDecline} className="btn btn-danger">
            Decline
          </button>
        </div>
      )}
    </div>
  );
};

export default ServiceRequestCard;
```

---

### Flutter/Dart (socket_io_client)

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

class ServiceRequestSocketService {
  late IO.Socket socket;

  void connect(String token) {
    socket = IO.io('http://localhost:3000/dj/chat',
      IO.OptionBuilder()
        .setTransports(['websocket'])
        .setAuth({'token': 'Bearer $token'})
        .build()
    );

    socket.onConnect((_) {
      print('✅ Connected to chat');
    });

    socket.on('serviceRequestUpdated', (data) {
      print('🔔 Service Request Updated: $data');
      handleServiceRequestUpdate(data);
    });

    socket.onError((error) {
      print('❌ Socket error: $error');
    });
  }

  void handleServiceRequestUpdate(dynamic data) {
    // Update your state management (Provider, Bloc, etc.)
    final serviceRequest = ServiceRequest.fromJson(data);

    if (serviceRequest.isAccepted) {
      // Show success notification
      showSnackbar('Request accepted! ✅');
    } else if (serviceRequest.isDeclined) {
      // Show error notification
      showSnackbar('Request declined ❌');
    }

    // Update UI
    updateServiceRequestInUI(serviceRequest);
  }

  Future<void> updateServiceRequest(
    String id, {
    bool? isAccepted,
    bool? isDeclined,
  }) async {
    final queryParams = <String, String>{};
    if (isAccepted != null) queryParams['isAccepted'] = isAccepted.toString();
    if (isDeclined != null) queryParams['isDeclined'] = isDeclined.toString();

    final uri = Uri.parse('http://localhost:3000/private-chat/$id/is-declined')
      .replace(queryParameters: queryParams);

    final response = await http.patch(
      uri,
      headers: {
        'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode == 200) {
      print('✅ Update successful');
      // WebSocket will notify both users
    }
  }

  void disconnect() {
    socket.disconnect();
  }
}
```

---

## Key Features

### ✅ Targeted Notifications

- Only **buyer** and **seller** (service creator) receive the update
- Other users don't receive unnecessary notifications
- Uses Socket.io rooms based on `userId`

### ✅ Real-Time Synchronization

- Both buyer and seller see updates instantly
- No need to refresh or poll the server
- Automatic UI updates when status changes

### ✅ Reliable Delivery

- Uses WebSocket persistent connection
- Automatic reconnection on connection loss
- Both REST API and WebSocket work together

---

## Testing Guide

### 1. Using REST Client (Postman/Thunder Client)

```http
### Accept a service request
PATCH http://localhost:3000/private-chat/{{serviceRequestId}}/is-declined?isAccepted=true
Authorization: Bearer {{buyerToken}}

### Decline a service request
PATCH http://localhost:3000/private-chat/{{serviceRequestId}}/is-declined?isDeclined=true
Authorization: Bearer {{sellerToken}}
```

### 2. Testing WebSocket Events

**Open Browser Console on 2 Tabs:**

**Tab 1 (Buyer):**

```javascript
const buyerSocket = io("http://localhost:3000/dj/chat", {
    auth: { token: "Bearer BUYER_TOKEN" },
});

buyerSocket.on("serviceRequestUpdated", (data) => {
    console.log("Buyer received:", data);
});
```

**Tab 2 (Seller):**

```javascript
const sellerSocket = io("http://localhost:3000/dj/chat", {
    auth: { token: "Bearer SELLER_TOKEN" },
});

sellerSocket.on("serviceRequestUpdated", (data) => {
    console.log("Seller received:", data);
});
```

**Make API call from Tab 1 or Tab 2:**

```javascript
fetch("http://localhost:3000/private-chat/SERVICE_REQUEST_ID/is-declined?isAccepted=true", {
    method: "PATCH",
    headers: { Authorization: "Bearer TOKEN" },
});
```

**Result:** Both tabs should receive the `serviceRequestUpdated` event!

---

## Troubleshooting

### Issue: Not receiving WebSocket events

**Solution:**

1. Ensure you're connected to the correct namespace: `/dj/chat`
2. Check your JWT token is valid
3. Verify you're listening to the correct event: `serviceRequestUpdated`
4. Check browser console for connection errors

### Issue: Receiving events multiple times

**Solution:**

- Make sure you're not setting up multiple listeners
- Clean up socket connections in component unmount
- Use unique socket instances per component

### Issue: Only one user receives the update

**Solution:**

- Verify both buyer and seller are connected to WebSocket
- Check that `service.creator.id` exists in the service data
- Ensure users have joined their respective rooms (happens automatically on connection)

---

## Security Considerations

1. **Authentication Required:** Both REST API and WebSocket require valid JWT token
2. **User Verification:** Only buyer and seller receive updates (no global broadcast)
3. **Authorization:** Users can only update service requests they're involved in
4. **Data Validation:** All data is validated before database update

---

## Related Endpoints

- `GET /private-chat/:conversationId` - Get conversation with service requests
- `POST /private-chat/send-message/:recipientId` - Send message with service request
- `GET /private-chat` - Get all conversations

---

## Support

For issues or questions, contact the backend team or refer to:

- [Private Message Socket Integration](./SOCKET_INTEGRATION_IMPLEMENTATION_SUMMARY.md)
- [Socket REST Quick Reference](./SOCKET_REST_QUICK_REFERENCE.md)
