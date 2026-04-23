# Testing Guide: Custom Service Request Socket & REST Integration

## 🎯 Testing Objectives

1. Verify REST API endpoints work correctly
2. Verify Socket.IO events work correctly
3. Verify REST API triggers socket events
4. Verify Socket events trigger socket broadcasts
5. Test authentication for both protocols
6. Test real-time synchronization across multiple clients

---

## 🛠️ Prerequisites

### Required Tools

- **Postman** or **Insomnia** (for REST API testing)
- **Postman** or **Socket.IO Client** library (for WebSocket testing)
- **Browser Console** (for quick WebSocket tests)
- **Valid JWT Token** (obtain from your auth endpoint)

### Environment Setup

```bash
# Start the backend server
npm run start:dev

# Server should be running on:
# REST API: http://localhost:3000
# WebSocket: ws://localhost:3000/service
```

---

## 🔐 Step 1: Get JWT Token

### Using REST API

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Expected Response:**

```json
{
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
        "id": "user_123",
        "email": "test@example.com"
    }
}
```

**Save the `access_token` for subsequent tests.**

---

## 🧪 Step 2: Test REST API Endpoints

### Test 1: Create Custom Service Request (POST)

**Request:**

```bash
curl -X POST http://localhost:3000/custom-requests \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "buyerId": "user_123",
    "targetCreatorId": "creator_456",
    "serviceName": "Test Promotional Shoutout",
    "description": "30-second promotional video for my new product",
    "budgetRangeMin": 50,
    "budgetRangeMax": 100
  }'
```

**Expected Response (201 Created):**

```json
{
    "id": "request_uuid_here",
    "buyerId": "user_123",
    "targetCreatorId": "creator_456",
    "serviceName": "Test Promotional Shoutout",
    "description": "30-second promotional video for my new product",
    "budgetRangeMin": 50,
    "budgetRangeMax": 100,
    "status": "PENDING",
    "createdAt": "2026-03-10T12:00:00.000Z",
    "updatedAt": "2026-03-10T12:00:00.000Z"
}
```

**What to Verify:**

- ✅ Status code is 201
- ✅ Response contains the created request with ID
- ✅ All fields match the input
- ✅ Timestamps are present

---

### Test 2: Get All Custom Service Requests (GET)

**Request:**

```bash
curl -X GET http://localhost:3000/custom-requests \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response (200 OK):**

```json
[
  {
    "id": "request_uuid_here",
    "buyerId": "user_123",
    "serviceName": "Test Promotional Shoutout",
    ...
  },
  ...
]
```

**What to Verify:**

- ✅ Status code is 200
- ✅ Response is an array
- ✅ Previously created request is in the list

---

### Test 3: Get Single Custom Service Request (GET)

**Request:**

```bash
curl -X GET http://localhost:3000/custom-requests/request_uuid_here \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response (200 OK):**

```json
{
  "id": "request_uuid_here",
  "buyerId": "user_123",
  "targetCreatorId": "creator_456",
  "serviceName": "Test Promotional Shoutout",
  ...
}
```

**What to Verify:**

- ✅ Status code is 200
- ✅ Response contains the correct request
- ✅ All fields are present

---

### Test 4: Update Custom Service Request (PATCH)

**Request:**

```bash
curl -X PATCH http://localhost:3000/custom-requests/request_uuid_here \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceName": "Updated Promotional Shoutout",
    "budgetRangeMax": 150
  }'
```

**Expected Response (200 OK):**

```json
{
  "id": "request_uuid_here",
  "serviceName": "Updated Promotional Shoutout",
  "budgetRangeMax": 150,
  "updatedAt": "2026-03-10T12:05:00.000Z",
  ...
}
```

**What to Verify:**

- ✅ Status code is 200
- ✅ Updated fields reflect changes
- ✅ `updatedAt` timestamp is newer

---

### Test 5: Delete Custom Service Request (DELETE)

**Request:**

```bash
curl -X DELETE http://localhost:3000/custom-requests/request_uuid_here \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response (200 OK):**

```json
{
  "id": "request_uuid_here",
  "serviceName": "Updated Promotional Shoutout",
  ...
}
```

**What to Verify:**

- ✅ Status code is 200
- ✅ Deleted request is returned
- ✅ Subsequent GET requests return 404

---

## 🔌 Step 3: Test WebSocket Events

### Setup WebSocket Client (Browser Console)

Open your browser console and run:

```javascript
// Load Socket.IO client (if not already loaded)
const script = document.createElement("script");
script.src = "https://cdn.socket.io/4.5.4/socket.io.min.js";
document.head.appendChild(script);

// Wait for script to load, then connect
setTimeout(() => {
    const socket = io("http://localhost:3000/service", {
        auth: {
            token: "Bearer YOUR_JWT_TOKEN_HERE",
        },
    });

    // Connection handlers
    socket.on("connect", () => {
        console.log("✅ Connected to service namespace");
    });

    socket.on("service:success", (userId) => {
        console.log("✅ Authenticated as user:", userId);
    });

    socket.on("service:error", (error) => {
        console.error("❌ Socket error:", error);
    });

    // Listen for all events
    socket.onAny((event, ...args) => {
        console.log(`📡 Event: ${event}`, args);
    });

    // Store socket for later use
    window.testSocket = socket;
}, 1000);
```

---

### Test 6: Create Request via Socket

```javascript
// Emit create event
testSocket.emit("service:create", {
    buyerId: "user_123",
    targetCreatorId: "creator_456",
    serviceName: "Socket Test Shoutout",
    description: "Created via WebSocket",
    budgetRangeMin: 75,
    budgetRangeMax: 125,
});

// Listen for response
testSocket.on("service:created", (response) => {
    console.log("✅ Service created:", response);
    window.createdRequestId = response.data.id; // Save for later tests
});
```

**What to Verify:**

- ✅ Console shows "Service created" message
- ✅ Response contains `event: "created"`
- ✅ Data includes the created request
- ✅ Timestamp is present

---

### Test 7: Get All Requests via Socket

```javascript
// Emit get all event
testSocket.emit("service:get_all");

// Listen for response
testSocket.on("service:get_service_requests", (response) => {
    console.log("✅ Received requests:", response);
    console.log(`Total count: ${response.count}`);
});
```

**What to Verify:**

- ✅ Response contains array of requests
- ✅ Count matches array length
- ✅ Previously created requests are present

---

### Test 8: Get Single Request via Socket

```javascript
// Emit get one event
testSocket.emit("service:get_one", {
    id: window.createdRequestId,
});

// Listen for response
testSocket.on("service:fetched", (response) => {
    console.log("✅ Fetched request:", response);
});
```

**What to Verify:**

- ✅ Response contains the correct request
- ✅ All fields are present

---

### Test 9: Update Request via Socket

```javascript
// Emit update event
testSocket.emit("service:update", {
    id: window.createdRequestId,
    data: {
        serviceName: "Socket Updated Shoutout",
        budgetRangeMax: 200,
    },
});

// Listen for response
testSocket.on("service:updated", (response) => {
    console.log("✅ Service updated:", response);
});
```

**What to Verify:**

- ✅ Response shows updated fields
- ✅ Event is "updated"
- ✅ Timestamp is updated

---

### Test 10: Delete Request via Socket

```javascript
// Emit delete event
testSocket.emit("service:delete", {
    id: window.createdRequestId,
});

// Listen for response
testSocket.on("service:deleted", (response) => {
    console.log("✅ Service deleted:", response);
});
```

**What to Verify:**

- ✅ Response contains deleted request
- ✅ Event is "deleted"
- ✅ Subsequent get operations return not found

---

### Test 11: Accept Request via Socket

```javascript
// First, create a request to accept
testSocket.emit("service:create", {
    buyerId: "user_123",
    serviceName: "Request to Accept",
    description: "Test acceptance",
});

testSocket.once("service:created", (response) => {
    const requestId = response.data.id;

    // Now accept it
    testSocket.emit("service:accept", { id: requestId });

    testSocket.on("service_request_accept", (acceptResponse) => {
        console.log("✅ Request accepted:", acceptResponse);
    });

    testSocket.on("service_request_status", (statusResponse) => {
        console.log("✅ Status changed:", statusResponse);
    });
});
```

**What to Verify:**

- ✅ `service_request_accept` event received
- ✅ `service_request_status` event shows "ACCEPTED"

---

### Test 12: Decline Request via Socket

```javascript
// Create a request to decline
testSocket.emit("service:create", {
    buyerId: "user_123",
    serviceName: "Request to Decline",
    description: "Test decline",
});

testSocket.once("service:created", (response) => {
    const requestId = response.data.id;

    // Now decline it
    testSocket.emit("service:decline", {
        id: requestId,
        reason: "Not available at this time",
    });

    testSocket.on("service_request_decline", (declineResponse) => {
        console.log("✅ Request declined:", declineResponse);
        console.log("Reason:", declineResponse.reason);
    });

    testSocket.on("service_request_status", (statusResponse) => {
        console.log("✅ Status changed:", statusResponse);
    });
});
```

**What to Verify:**

- ✅ `service_request_decline` event received
- ✅ Reason is included in response
- ✅ `service_request_status` event shows "DECLINED"

---

## 🔄 Step 4: Test Real-time Synchronization

### Test 13: Multi-Client Synchronization

**Setup:**

1. Open two browser windows/tabs
2. Connect both to the WebSocket (use the setup code from Step 3)
3. Name them Client A and Client B

**Client A - Listen for events:**

```javascript
testSocket.on("service:list_updated", (data) => {
    console.log("🔔 List updated from another client:", data.action, data.data);
});

testSocket.on("service:created", (data) => {
    console.log("🔔 New service created:", data.data);
});
```

**Client B - Create a request:**

```javascript
testSocket.emit("service:create", {
    buyerId: "user_456",
    serviceName: "Multi-Client Test",
    description: "Testing real-time sync",
});
```

**What to Verify:**

- ✅ Client A receives `service:list_updated` event
- ✅ Client A receives `service:created` event (if in the same room)
- ✅ Both clients show the same data

---

### Test 14: REST to Socket Synchronization

**Setup:**

1. Keep a WebSocket client connected (from previous test)
2. Use REST API to create/update/delete

**WebSocket Client - Listen:**

```javascript
testSocket.on("service:created", (data) => {
    console.log("🔔 REST API created a service:", data);
});

testSocket.on("service:updated", (data) => {
    console.log("🔔 REST API updated a service:", data);
});

testSocket.on("service:deleted", (data) => {
    console.log("🔔 REST API deleted a service:", data);
});

testSocket.on("service:list_updated", (data) => {
    console.log("🔔 List updated via REST:", data.action);
});
```

**REST API - Create a request:**

```bash
curl -X POST http://localhost:3000/custom-requests \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "buyerId": "user_789",
    "serviceName": "REST to Socket Test",
    "description": "Created via REST API"
  }'
```

**What to Verify:**

- ✅ WebSocket client receives `service:created` event
- ✅ WebSocket client receives `service:list_updated` event
- ✅ Events contain correct data from REST API

---

## 🔒 Step 5: Test Authentication

### Test 15: Connect Without Token

```javascript
const socketNoAuth = io("http://localhost:3000/service");

socketNoAuth.on("service:error", (error) => {
    console.log("✅ Correctly rejected:", error);
});

socketNoAuth.on("disconnect", () => {
    console.log("✅ Socket disconnected due to missing auth");
});
```

**What to Verify:**

- ✅ `service:error` event received with "Missing authorization header"
- ✅ Socket is disconnected

---

### Test 16: Connect With Invalid Token

```javascript
const socketBadAuth = io("http://localhost:3000/service", {
    auth: {
        token: "Bearer invalid_token_here",
    },
});

socketBadAuth.on("service:error", (error) => {
    console.log("✅ Correctly rejected:", error);
});

socketBadAuth.on("disconnect", () => {
    console.log("✅ Socket disconnected due to invalid token");
});
```

**What to Verify:**

- ✅ `service:error` event received
- ✅ Socket is disconnected
- ✅ Error message mentions JWT validation

---

### Test 17: REST API Without Token

```bash
curl -X GET http://localhost:3000/custom-requests
```

**Expected Response (401 Unauthorized):**

```json
{
    "statusCode": 401,
    "message": "Unauthorized"
}
```

**What to Verify:**

- ✅ Status code is 401
- ✅ Request is rejected

---

## 📊 Step 6: Performance Testing

### Test 18: Rapid Fire Events

```javascript
// Create multiple requests rapidly
for (let i = 0; i < 10; i++) {
    testSocket.emit("service:create", {
        buyerId: "user_123",
        serviceName: `Bulk Test ${i}`,
        description: `Performance test ${i}`,
    });
}

let receivedCount = 0;
testSocket.on("service:created", () => {
    receivedCount++;
    console.log(`Received ${receivedCount} responses`);
});

// Wait and verify
setTimeout(() => {
    console.log(`Total received: ${receivedCount} / 10`);
}, 5000);
```

**What to Verify:**

- ✅ All 10 requests are processed
- ✅ All responses are received
- ✅ No errors occur
- ✅ Server doesn't crash

---

## 🐛 Step 7: Error Handling

### Test 19: Invalid Request Data

```javascript
// Missing required fields
testSocket.emit("service:create", {
    buyerId: "user_123",
    // Missing serviceName and description
});

testSocket.on("service:error", (error) => {
    console.log("✅ Validation error caught:", error);
});
```

**What to Verify:**

- ✅ `service:error` event received
- ✅ Error message indicates missing fields

---

### Test 20: Non-existent ID

```javascript
// Try to get non-existent request
testSocket.emit("service:get_one", {
    id: "non_existent_uuid",
});

testSocket.on("service:error", (error) => {
    console.log("✅ Not found error:", error);
});
```

**What to Verify:**

- ✅ `service:error` event received
- ✅ Error message indicates request not found

---

## ✅ Testing Checklist

### REST API Tests

- [ ] POST /custom-requests creates successfully
- [ ] GET /custom-requests returns list
- [ ] GET /custom-requests/:id returns single item
- [ ] PATCH /custom-requests/:id updates successfully
- [ ] DELETE /custom-requests/:id deletes successfully
- [ ] All endpoints require authentication
- [ ] Invalid token returns 401

### WebSocket Tests

- [ ] service:create works
- [ ] service:get_all works
- [ ] service:get_one works
- [ ] service:update works
- [ ] service:delete works
- [ ] service:accept works
- [ ] service:decline works
- [ ] Connection requires authentication
- [ ] Invalid token disconnects

### Integration Tests

- [ ] REST API operations trigger socket events
- [ ] Socket operations trigger socket events
- [ ] Multiple clients receive broadcasts
- [ ] Targeted events go to correct rooms
- [ ] Global broadcasts reach all clients

### Edge Cases

- [ ] Invalid data is rejected
- [ ] Non-existent IDs return errors
- [ ] Rapid requests are handled
- [ ] Socket reconnection works
- [ ] Token expiration is handled

---

## 📝 Test Results Template

```markdown
## Test Execution Results

**Date:** YYYY-MM-DD
**Tester:** [Your Name]
**Environment:** Development/Staging/Production

### REST API Tests

- [x] POST /custom-requests: PASS
- [x] GET /custom-requests: PASS
- [ ] GET /custom-requests/:id: FAIL - [describe issue]
- ...

### WebSocket Tests

- [x] service:create: PASS
- [x] service:get_all: PASS
- ...

### Issues Found

1. **Issue:** Socket event not received
    - **Severity:** High
    - **Steps to Reproduce:** ...
    - **Expected:** ...
    - **Actual:** ...

### Performance Metrics

- Average response time (REST): XXms
- Average event delivery time (Socket): XXms
- Concurrent connections tested: XX
- Memory usage: XXmb
```

---

## 🚀 Automated Testing (Optional)

### Jest Test Example

```typescript
describe("CustomServiceRequest Integration", () => {
    let socket: Socket;
    let jwtToken: string;

    beforeAll(async () => {
        // Get JWT token
        const authResponse = await request(app.getHttpServer())
            .post("/auth/login")
            .send({ email: "test@example.com", password: "password" });

        jwtToken = authResponse.body.access_token;

        // Connect socket
        socket = io("http://localhost:3000/service", {
            auth: { token: `Bearer ${jwtToken}` },
        });

        await new Promise((resolve) => socket.on("connect", resolve));
    });

    afterAll(() => {
        socket.close();
    });

    it("should create request via REST and emit socket event", (done) => {
        socket.once("service:created", (data) => {
            expect(data.event).toBe("created");
            expect(data.data).toHaveProperty("id");
            done();
        });

        request(app.getHttpServer())
            .post("/custom-requests")
            .set("Authorization", `Bearer ${jwtToken}`)
            .send({
                buyerId: "user_123",
                serviceName: "Test Service",
                description: "Test description",
            })
            .expect(201);
    });

    it("should create request via socket", (done) => {
        socket.emit("service:create", {
            buyerId: "user_123",
            serviceName: "Socket Test",
            description: "Created via socket",
        });

        socket.once("service:created", (data) => {
            expect(data.event).toBe("created");
            expect(data.data.serviceName).toBe("Socket Test");
            done();
        });
    });
});
```

---

## 📚 Summary

This testing guide covers:

- ✅ Authentication testing
- ✅ REST API endpoint testing
- ✅ WebSocket event testing
- ✅ Real-time synchronization testing
- ✅ Multi-client testing
- ✅ Error handling testing
- ✅ Performance testing

Follow this guide systematically to ensure your implementation is robust and production-ready!
