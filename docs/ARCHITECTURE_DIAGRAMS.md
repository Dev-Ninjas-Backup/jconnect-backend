# Architecture Diagram: Custom Service Request Socket & REST Integration

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT APPLICATIONS                               │
├─────────────────┬─────────────────┬────────────────────┬────────────────────┤
│   Web Browser   │   Mobile App    │   Desktop App      │    Other Services  │
│   (React/Vue)   │   (Flutter)     │   (Electron)       │    (Microservices) │
└────────┬────────┴────────┬────────┴─────────┬──────────┴──────────┬─────────┘
         │                 │                  │                     │
         │ REST API        │ Socket.IO        │ REST + Socket       │ REST API
         │ (HTTP)          │ (WebSocket)      │ (Hybrid)            │ (HTTP)
         │                 │                  │                     │
         v                 v                  v                     v
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NESTJS BACKEND SERVER                               │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                    API Gateway Layer                                │    │
│  │                                                                      │    │
│  │  ┌──────────────────────────┐    ┌───────────────────────────┐    │    │
│  │  │  REST API Controller     │    │   Socket.IO Gateway       │    │    │
│  │  │  (HTTP Endpoints)        │    │   (WebSocket Events)      │    │    │
│  │  │                          │    │                           │    │    │
│  │  │  POST   /custom-requests │    │   service:create         │    │    │
│  │  │  GET    /custom-requests │    │   service:get_all        │    │    │
│  │  │  GET    /:id             │    │   service:get_one        │    │    │
│  │  │  PATCH  /:id             │    │   service:update         │    │    │
│  │  │  DELETE /:id             │    │   service:delete         │    │    │
│  │  │                          │    │   service:accept         │    │    │
│  │  │  + JWT Authentication    │    │   service:decline        │    │    │
│  │  │                          │    │                           │    │    │
│  │  └────────────┬─────────────┘    └───────────┬───────────────┘    │    │
│  │               │                               │                     │    │
│  │               │   Calls Service Methods       │                     │    │
│  │               │   Emits Socket Events         │                     │    │
│  │               └───────────────┬───────────────┘                     │    │
│  └───────────────────────────────┼─────────────────────────────────────┘    │
│                                  │                                           │
│  ┌───────────────────────────────┼─────────────────────────────────────┐    │
│  │          Service Layer        v                                      │    │
│  │  ┌────────────────────────────────────────────────────────────┐     │    │
│  │  │    CustomServiceRequestService                             │     │    │
│  │  │                                                             │     │    │
│  │  │    • create(dto)                                           │     │    │
│  │  │    • findAll()                                             │     │    │
│  │  │    • findOne(id)                                           │     │    │
│  │  │    • update(id, dto)                                       │     │    │
│  │  │    • remove(id)                                            │     │    │
│  │  │                                                             │     │    │
│  │  └──────────────────────────────┬──────────────────────────────┘     │    │
│  └─────────────────────────────────┼────────────────────────────────────┘    │
│                                    │                                          │
│  ┌─────────────────────────────────┼────────────────────────────────────┐    │
│  │     Database Layer              v                                     │    │
│  │  ┌─────────────────────────────────────────────────────────────┐     │    │
│  │  │         PrismaService (ORM)                                  │     │    │
│  │  │                                                               │     │    │
│  │  │    • customServiceRequest.create()                          │     │    │
│  │  │    • customServiceRequest.findMany()                        │     │    │
│  │  │    • customServiceRequest.findUnique()                      │     │    │
│  │  │    • customServiceRequest.update()                          │     │    │
│  │  │    • customServiceRequest.delete()                          │     │    │
│  │  │                                                               │     │    │
│  │  └──────────────────────────────┬────────────────────────────────┘     │    │
│  └─────────────────────────────────┼────────────────────────────────────┘    │
│                                    │                                          │
└────────────────────────────────────┼──────────────────────────────────────────┘
                                     │
                                     v
                           ┌─────────────────┐
                           │   PostgreSQL    │
                           │    Database     │
                           │                 │
                           │  CustomService  │
                           │    Request      │
                           │     Table       │
                           └─────────────────┘
```

---

## Data Flow Diagrams

### Flow 1: Create via REST API

```
┌──────────┐         HTTP POST          ┌────────────────┐
│          │ ─────────────────────────> │                │
│  Client  │    /custom-requests        │   Controller   │
│          │    + JWT Token             │                │
└──────────┘                            └────────┬───────┘
     ^                                           │
     │                                           │ 1. Call service.create()
     │                                           v
     │                                  ┌────────────────┐
     │                                  │    Service     │
     │                                  │                │
     │                                  └────────┬───────┘
     │                                           │
     │                                           │ 2. Save to DB
     │                                           v
     │                                  ┌────────────────┐
     │                                  │   Database     │
     │                                  │                │
     │                                  └────────┬───────┘
     │                                           │
     │  5. HTTP Response                         │ 3. Return saved data
     │  + JSON Data                              v
     │                                  ┌────────────────┐
     │ <──────────────────────────────  │   Controller   │
     │                                  │                │
     │                                  └────────┬───────┘
     │                                           │
     │                                           │ 4. Emit socket event
     │                                           v
     │                                  ┌────────────────┐
     │                                  │ Socket Gateway │
     │                                  │                │
     │                                  └────────┬───────┘
     │                                           │
     │                                           │ 6. Broadcast events
     │                                           v
     │                            ┌──────────────────────────────┐
     └────────────────────────────┤  All Connected Socket Clients │
              7. Real-time        │  • service:created           │
                 notification     │  • service:list_updated      │
                                  └──────────────────────────────┘
```

### Flow 2: Create via Socket

```
┌──────────┐    Socket.IO Event        ┌────────────────┐
│          │ ─────────────────────────> │                │
│  Client  │    service:create          │ Socket Gateway │
│          │    + JWT Token             │                │
└──────────┘                            └────────┬───────┘
     ^                                           │
     │                                           │ 1. Validate auth
     │                                           │ 2. Call service.create()
     │                                           v
     │                                  ┌────────────────┐
     │                                  │    Service     │
     │                                  │                │
     │                                  └────────┬───────┘
     │                                           │
     │                                           │ 3. Save to DB
     │                                           v
     │                                  ┌────────────────┐
     │                                  │   Database     │
     │                                  │                │
     │                                  └────────┬───────┘
     │                                           │
     │                                           │ 4. Return saved data
     │                                           v
     │                                  ┌────────────────┐
     │  6. Socket Response              │ Socket Gateway │
     │  + Success Event                 │                │
     │ <──────────────────────────────  └────────┬───────┘
     │                                           │
     │                                           │ 5. Emit events
     │                                           v
     │                            ┌──────────────────────────────┐
     └────────────────────────────┤  All Connected Socket Clients │
              7. Real-time        │  • service:created           │
                 broadcast        │  • service:list_updated      │
                                  └──────────────────────────────┘
```

### Flow 3: Real-time Broadcasting

```
                            ┌──────────────────────────┐
                            │   Socket.IO Gateway      │
                            │                          │
                            │   emitServiceCreated()   │
                            │   emitServiceUpdated()   │
                            │   emitServiceDeleted()   │
                            └────────┬─────────────────┘
                                     │
                                     │ Broadcasts to:
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
        v                            v                            v
┌───────────────┐          ┌─────────────────┐         ┌──────────────────┐
│  Buyer Room   │          │  Creator Room   │         │  Global Broadcast│
│  (buyerId)    │          │ (creatorId)     │         │  (all clients)   │
│               │          │                 │         │                  │
│ Receives:     │          │ Receives:       │         │ Receives:        │
│ • created     │          │ • created       │         │ • list_updated   │
│ • updated     │          │ • updated       │         │                  │
│ • deleted     │          │ • deleted       │         │                  │
│ • status      │          │ • status        │         │                  │
└───────────────┘          └─────────────────┘         └──────────────────┘
```

---

## Sequence Diagram: Update Operation

```
Client (REST)    Controller       Service       Database    Socket Gateway    Connected Clients
     │                │              │              │              │                   │
     │  PATCH /:id    │              │              │              │                   │
     │───────────────>│              │              │              │                   │
     │                │  update()    │              │              │                   │
     │                │─────────────>│              │              │                   │
     │                │              │  UPDATE SQL  │              │                   │
     │                │              │─────────────>│              │                   │
     │                │              │   Updated    │              │                   │
     │                │              │<─────────────│              │                   │
     │                │   Updated    │              │              │                   │
     │                │<─────────────│              │              │                   │
     │                │              │              │              │                   │
     │                │ emitServiceUpdated()        │              │                   │
     │                │─────────────────────────────────────────>│                   │
     │                │              │              │              │ service:updated   │
     │                │              │              │              │──────────────────>│
     │                │              │              │              │ list_updated      │
     │                │              │              │              │──────────────────>│
     │   200 OK       │              │              │              │                   │
     │<───────────────│              │              │              │                   │
     │                │              │              │              │                   │
```

---

## Component Interaction Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CUSTOM SERVICE REQUEST MODULE                │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                      Module Imports                         │    │
│  │  • PrismaService                                            │    │
│  │  • JWT Guards                                               │    │
│  │  • WebSocket Module                                         │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────────────┐        ┌──────────────────────────┐     │
│  │    Controller        │◄───────│    serviceGateway        │     │
│  │                      │        │                          │     │
│  │  • POST /requests    │        │  • handleCreateService() │     │
│  │  • GET /requests     │        │  • handleGetAllServices()│     │
│  │  • GET /:id          │        │  • handleGetOneService() │     │
│  │  • PATCH /:id        │        │  • handleUpdateService() │     │
│  │  • DELETE /:id       │        │  • handleDeleteService() │     │
│  │                      │        │  • handleAcceptService() │     │
│  │  Emits socket events │        │  • handleDeclineService()│     │
│  │  after operations ───┼───────>│                          │     │
│  └──────────┬───────────┘        └──────────┬───────────────┘     │
│             │                               │                      │
│             │ Uses                          │ Uses                 │
│             v                               v                      │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │         CustomServiceRequestService                       │     │
│  │                                                            │     │
│  │  • create()                                               │     │
│  │  • findAll()                                              │     │
│  │  • findOne()                                              │     │
│  │  • update()                                               │     │
│  │  • remove()                                               │     │
│  │                                                            │     │
│  └───────────────────────────┬────────────────────────────────┘     │
│                              │                                      │
│                              │ Uses                                 │
│                              v                                      │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │              PrismaService                                │     │
│  │                                                            │     │
│  │  • Database connection                                    │     │
│  │  • ORM operations                                         │     │
│  │  • Transaction management                                 │     │
│  │                                                            │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Authentication Flow

```
┌──────────┐                                     ┌────────────────┐
│  Client  │                                     │   JWT Service  │
└────┬─────┘                                     └────────┬───────┘
     │                                                    │
     │ 1. Login with credentials                          │
     │────────────────────────────────────────────────────>
     │                                                    │
     │ 2. Return JWT Token                                │
     │<────────────────────────────────────────────────────
     │                                                    │
     │                                                    │
     │ 3a. REST API Request with Token                    │
     │────────────────────────────>┌────────────────┐    │
     │                             │   Controller   │    │
     │                             └────────┬───────┘    │
     │                                      │            │
     │                                      │ 4a. Validate JWT
     │                                      │────────────>│
     │                                      │            │
     │                                      │ 5a. Valid  │
     │                                      │<────────────│
     │                                      │            │
     │                                      v            │
     │                             ┌────────────────┐    │
     │ 6a. Response                │    Process     │    │
     │<────────────────────────────│    Request     │    │
     │                             └────────────────┘    │
     │                                                    │
     │ 3b. WebSocket Connect with Token                  │
     │────────────────────────────>┌────────────────┐    │
     │                             │ Socket Gateway │    │
     │                             └────────┬───────┘    │
     │                                      │            │
     │                                      │ 4b. Validate JWT
     │                                      │────────────>│
     │                                      │            │
     │                                      │ 5b. Valid  │
     │                                      │<────────────│
     │                                      │            │
     │                                      v            │
     │                             ┌────────────────┐    │
     │ 6b. Connected               │   Join User    │    │
     │<────────────────────────────│     Room       │    │
     │                             └────────────────┘    │
```

---

## Event Broadcasting Strategy

```
                    ┌────────────────────────────┐
                    │   REST or Socket Operation │
                    │   (Create/Update/Delete)   │
                    └──────────┬─────────────────┘
                               │
                               v
                    ┌─────────────────────────┐
                    │  Service Gateway        │
                    │  Emit Method Called     │
                    └──────────┬──────────────┘
                               │
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              v                v                v
    ┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐
    │  Targeted Emit  │ │ Room Emit    │ │ Global Broadcast│
    │  to(userId)     │ │ to(room)     │ │ emit()          │
    └─────────────────┘ └──────────────┘ └─────────────────┘
              │                │                │
              v                v                v
    ┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐
    │  Specific User  │ │  Buyer &     │ │  All Connected  │
    │  (Requester)    │ │  Creator     │ │  Clients        │
    │                 │ │  Rooms       │ │                 │
    └─────────────────┘ └──────────────┘ └─────────────────┘
```

---

## Module Dependency Graph

```
┌──────────────────────────────────────────────────────────────┐
│                     AppModule                                 │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            │ imports
                            v
┌──────────────────────────────────────────────────────────────┐
│           CustomServiceRequestModule                          │
│                                                               │
│  providers: [                                                 │
│    CustomServiceRequestService,                              │
│    serviceGateway                                            │
│  ]                                                            │
│                                                               │
│  controllers: [                                               │
│    CustomServiceRequestController                            │
│  ]                                                            │
└───────────────┬──────────────────────────┬───────────────────┘
                │                          │
                │ imports                  │ imports
                v                          v
┌───────────────────────┐      ┌──────────────────────┐
│    PrismaModule       │      │  WebSocketModule     │
│                       │      │                      │
│  providers:           │      │  • Socket.IO Server  │
│    PrismaService      │      │  • Event Handlers    │
└───────────────────────┘      └──────────────────────┘
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Load Balancer                            │
│                     (with Sticky Sessions)                       │
└──────────────────┬──────────────────────────┬───────────────────┘
                   │                          │
                   v                          v
    ┌──────────────────────┐      ┌──────────────────────┐
    │  NestJS Instance 1   │      │  NestJS Instance 2   │
    │                      │      │                      │
    │  • REST API          │      │  • REST API          │
    │  • Socket.IO Server  │      │  • Socket.IO Server  │
    │                      │      │                      │
    └──────────┬───────────┘      └──────────┬───────────┘
               │                             │
               │    Optional: Redis Adapter  │
               │    for cross-instance       │
               │    socket broadcasting      │
               └──────────────┬──────────────┘
                              │
                              v
                ┌─────────────────────────┐
                │  PostgreSQL Database    │
                │                         │
                │  • CustomServiceRequest │
                │  • User                 │
                │  • Other tables         │
                └─────────────────────────┘
```

---

This architecture ensures:

- ✅ Scalability through separation of concerns
- ✅ Real-time updates via WebSocket
- ✅ Backward compatibility with REST API
- ✅ Targeted and broadcast messaging
- ✅ Secure JWT authentication for both protocols
- ✅ Flexible client implementations
