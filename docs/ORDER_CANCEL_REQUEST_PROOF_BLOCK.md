# Order Cancellation Request — Proof Upload Block

## Overview

When a buyer requests to cancel an order that the seller has already accepted (order
status `IN_PROGRESS`, `PROOF_SUBMITTED`, or `RESUBMIT`), the seller must not be able to
upload delivery proof until that cancellation request is resolved. This document
describes the flow and the implementation.

## Problem (before this change)

- Buyer cancellation on an in-progress order only sent an email to the seller
  ("The buyer has requested to cancel order ..."). Nothing was persisted on the `Order`
  record.
- Because no state was stored, the seller could still call the proof-upload endpoint
  and successfully submit proof after the buyer had already asked to cancel.
- Client requirement: once a buyer requests cancellation, trying to upload proof should
  show an error message instead of succeeding.

## Schema changes

`prisma/schema/order.prisma` — two new fields on `Order`:

```prisma
isCancelRequested Boolean   @default(false)
cancelRequestedAt DateTime?
```

Migration: `prisma/migrations/20260902120000_add_order_cancel_requested/migration.sql`

```sql
-- AlterTable
ALTER TABLE "Order" ADD COLUMN "isCancelRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "cancelRequestedAt" TIMESTAMP(3);
```

> This migration was hand-written (no local DB/`node_modules` were available to run
> `prisma migrate dev`). Run `npx prisma migrate deploy` (or `generate`) before/after
> deploying so the Prisma client picks up the new columns.

## Flow

```
Seller accepts order        Buyer requests cancel        Seller tries to upload proof
(status = IN_PROGRESS)  ──▶  PATCH /orders/:id/status  ──▶  POST /orders/ProofUpload
                              { status: "CANCELLED" }
                                     │                             │
                                     ▼                             ▼
                        order.isCancelRequested = true    submitProof() checks
                        order.cancelRequestedAt = now()    order.isCancelRequested
                        email sent to seller                       │
                        (order status unchanged)          ┌────────┴────────┐
                                                            │                 │
                                                       true │            false│
                                                            ▼                 ▼
                                                 400 Bad Request      proof upload
                                                 "The buyer has        proceeds
                                                 requested to cancel   normally
                                                 this order. You
                                                 cannot upload proof
                                                 until the
                                                 cancellation request
                                                 is resolved."
```

## Where it's implemented

### 1. Buyer cancel request sets the flag

`src/main/order/order.service.ts` → `updateStatus()`, inside the branch that handles
`status === CANCELLED` while `order.status` is `IN_PROGRESS` / `PROOF_SUBMITTED` /
`RESUBMIT`, in the `isBuyer` case (~line 460):

```ts
if (isBuyer) {
    // Mark the order as having a pending cancellation request so the
    // seller is blocked from uploading proof until it's resolved
    await this.prisma.order.update({
        where: { id: order.id },
        data: {
            isCancelRequested: true,
            cancelRequestedAt: new Date(),
        },
    });

    // ...existing email to seller...
    return { message: "Cancellation request sent to seller successfully" };
}
```

Note: the order's `status` itself is **not** changed here — it stays
`IN_PROGRESS`/`PROOF_SUBMITTED`/`RESUBMIT`. Only the new flag records that a
cancellation request is pending.

### 2. Proof upload checks the flag

`src/main/order/order.service.ts` → `submitProof()` (~line 962), right after the
existing seller-ownership and `proofUrls` validation:

```ts
if (order.isCancelRequested) {
    throw new BadRequestException(
        "The buyer has requested to cancel this order. You cannot upload proof until the cancellation request is resolved.",
    );
}
```

This is surfaced to the client by `POST /orders/ProofUpload`
(`src/main/order/order.controller.ts` → `UploadProofFile()`), which calls
`submitProof()` and lets the `BadRequestException` propagate as a `400` response.

## API behavior summary

| Endpoint | Trigger | Result |
|---|---|---|
| `PATCH /orders/:id/status` with `{ status: "CANCELLED" }`, called by buyer, order is `IN_PROGRESS`/`PROOF_SUBMITTED`/`RESUBMIT` | Buyer requests cancellation | `isCancelRequested = true`, `cancelRequestedAt` set, email sent to seller, order status unchanged |
| `POST /orders/ProofUpload?orderId=...` | Seller uploads proof while `isCancelRequested = true` | `400 Bad Request` — proof rejected, order untouched |
| `POST /orders/ProofUpload?orderId=...` | Seller uploads proof while `isCancelRequested = false` | Proceeds as before (`status → PROOF_SUBMITTED`, etc.) |

## Known limitation / open follow-up

There is currently **no way to clear `isCancelRequested`** once it's set. If the seller
does not want to cancel and wishes to keep working on the order, they will remain
permanently blocked from uploading proof, because no "seller declines the cancellation
request" endpoint exists yet.

If needed, a follow-up feature would add:

- An endpoint (e.g. `PATCH /orders/:id/cancel-request` or similar) for the seller to
  either accept the cancellation (→ existing seller-cancel flow, sets `CANCELLED`) or
  reject it (→ clears `isCancelRequested`/`cancelRequestedAt`, allowing proof upload
  again), modeled on the existing proof-rejection flow
  (`updateCancalProofSubmitted` in `order.service.ts`).

## Related code

- `src/main/order/order.controller.ts` — `UploadProofFile()`, `updateStatus()`
- `src/main/order/order.service.ts` — `updateStatus()`, `submitProof()`
- `prisma/schema/order.prisma` — `Order` model
