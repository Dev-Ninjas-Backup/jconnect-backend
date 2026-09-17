# Order Timeline Update (2026-09-17) — App Developer Guide

Changelog note for app developers who already integrated against yesterday's
(2026-09-16) version of the order auto-expiry timers. Two things changed
today; both are **behavior-only** — no endpoint, request/response shape, or
socket event was added, removed, or renamed. If you built your countdown UI
to read the deadline fields dynamically (as the reference guide recommended),
you likely need **no code changes at all** — just verify against the table
below.

Full reference (read this alongside or instead of this note if you're
integrating fresh): [`ORDER_ESCROW_AUTO_EXPIRY_APP_GUIDE.md`](./ORDER_ESCROW_AUTO_EXPIRY_APP_GUIDE.md).

## What changed today

### 1. Seller acceptance window is back to a flat duration — and shorter

Yesterday afternoon we briefly shipped a version where `acceptDeadline` was
computed from the buyer's `ServiceRequest.promotionDate` ("I want this done
by 8:26pm") when one was set, falling back to 24h otherwise. **That's been
reverted.** Client feedback settled on a simpler, fixed timeline instead:

| | Yesterday AM | Yesterday PM (reverted) | **Today (current)** |
|---|---|---|---|
| `acceptDeadline` window | flat 24h from order creation | `promotionDate` if set, else 24h | **flat 12h from order creation, always** |

`acceptDeadline` no longer varies per order — it is always exactly
`createdAt + 12h`, regardless of any `promotionDate` on a linked
`ServiceRequest`. `promotionDate` is unaffected as a field (still shown on
the order for the buyer's own reference), it's just no longer read when
computing the countdown.

**Action item:** if you had already started building UI or copy around a
variable/promotion-date-based acceptance countdown (from yesterday
afternoon's version), remove that special-casing — the countdown is simply
"12 hours from when the buyer paid," full stop. If your countdown component
already just renders `acceptDeadline → now` as a live timer without assuming
a fixed duration, nothing changes for you except the number displayed will
now consistently be ≤ 12h instead of ≤ 24h.

### 2. Seller proof-submission window — confirmed at 24h, unchanged in shape

This was also part of yesterday afternoon's (reverted) change and has been
re-implemented today exactly as before: `Order.proofSubmitDeadline` is set to
`inProgressAt + 24h` the moment the seller accepts (`status → IN_PROGRESS`),
and the order is auto-cancelled/refunded if the seller hasn't submitted proof
by then. Field name, notification copy, `data.action` values
(`AUTO_CANCEL_UNSUBMITTED`), and socket event (`order:cancelled`) are all
identical to before. If you already built against yesterday afternoon's
version for this specific timer, **no changes needed here.**

## Full current timeline

```
Buyer places order → 12-hour acceptance window → Seller accepts
   → 24-hour proof submission window → Seller submits proof
   → 24-hour buyer review window → funds released
```

| Timer | Field | Window | Changed today? |
|---|---|---|---|
| Seller acceptance | `acceptDeadline` | 12h flat (was 24h flat, briefly promotion-date-based) | **Yes — shorter, and no longer promotion-date-based** |
| Seller proof submission | `proofSubmitDeadline` | 24h flat | No (re-confirmed as-is) |
| Buyer proof review | `proofReviewDeadline` | 24h flat | No (untouched all along) |

## Where to look for everything else

Notification payloads, socket events, guard conditions (disputes/cancellation
requests), and full flow diagrams for all three timers are unchanged in
shape from the reference guide — see
[`ORDER_ESCROW_AUTO_EXPIRY_APP_GUIDE.md`](./ORDER_ESCROW_AUTO_EXPIRY_APP_GUIDE.md)
§3–§8 for the complete, current spec.

## Related code

- `src/main/payments/payments.service.ts` — `ACCEPT_WINDOW_MS` (now `12 * 60 * 60 * 1000`), `createOrderWithPaymentMethod()`
- `src/main/order/order.service.ts` — `PROOF_SUBMIT_WINDOW_MS`, `autoCancelExpiredOrder()`, `autoCancelUnacceptedOrder()`, `autoCancelUnsubmittedOrder()`
- `src/main/order-scheduler/order-scheduler.service.ts` — `handleAcceptanceExpiry()`, `handleProofSubmissionExpiry()`
- `prisma/schema/order.prisma` — `Order.acceptDeadline`, `Order.proofSubmitDeadline`
- `prisma/migrations/20260917160900_add_order_proof_submit_deadline/`
