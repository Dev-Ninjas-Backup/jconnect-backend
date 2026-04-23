# JCONNECT BACKND
``` 
sudo systemctl stop postgresql
sudo systemctl disable postgresql
```
## fix docker

```bash
sudo kill -9 1364
```

## firebase notification

- **[notification firebase](./docs/firebase-backend-notification-architecture.md)** - firebase notifications
- **[flutter notification firebase](./docs/FLUTTER_APP_FIREBASE_COMPLETE_GUIDE.md)** - firebase flutter notifications

- **[react native notification firebase](./docs/FIREBASE_FRONTEND_IMPLEMENTATION_GUIDE.md)** - firebase react native notifications


- **[service request](./docs/SERVICE_REQUEST_UPDATE_SOCKET_GUIDE.md)** - service request

## docker run

```bash
docker compose --profile dev up -d

```

# nest cli rest api command

```bash
nest g resource main/shared/live-chat
```

This is the backend service for JConnect application built with NestJS framework.

## PAYMENT EVENT

The payment module handles all payment-related functionalities, including creating payment sessions, handling webhooks, and managing user payments.

# checkout.session.completed

# payment_intent.payment_failed

# invoice.payment_failed

# checkout.session.async_payment_failed

## Features

- User Authentication and Authorization
- Payment Processing with Stripe
- RESTful API Endpoints
- Database Integration with Prisma ORM
- Modular Architecture for Scalability
