# JCONNECT BACKEND

এই README-এ Stripe Connect এবং Payment ফ্লো সংক্ষিপ্তভাবে দেওয়া আছে।
## Firebase notification document
- **[Support Chat System](./docs/support-message.md)** - Real-time support chat with WebSocket and REST API


## STEP 1: Stripe Client Setup

- `StripeModule` তৈরি করে `STRIPE_CLIENT` প্রদান করে
- `process.env.STRIPE_SECRET_KEY_S` থেকে Stripe ক্লায়েন্ট ইনস্ট্যান্স তৈরি হয়

## STEP 2: Seller Stripe Connect Account

- যখন seller প্রথম service তৈরি করে:
    - `ServiceService.create()` চেক করে seller-এর `sellerIDStripe` আছে কি না
    - না থাকলে `stripe.accounts.create({ type: "express", ... })` করে Connect account তৈরি হয়
    - Account ID `user.sellerIDStripe` হিসেবে DB-তে সেভ হয়
    - `stripe.accountLinks.create()` দিয়ে onboarding link তৈরি হয় → seller-কে পাঠানো হয়

## STEP 3: Buyer Checkout Session তৈরি

- `POST /payments/create-session` (Auth required)
- Request body: `{ serviceId, frontendUrl }`
- কাজ:
    - `stripe.checkout.sessions.create()` করে session তৈরি হয়
    - `customer: user?.customerIdStripe || undefined` (যদি buyer-এর Stripe customer আছে তবে সেটি ব্যবহার করা হবে)
    - `capture_method = "manual"` → টাকা ধরে রাখা হয় (Admin confirm পর্যন্ত)
    - Service price, description লাইন-আইটেমে যোগ হয়
    - Success/Cancel URL frontend-এ রিডাইরেক্ট করে
- ফলাফল: `{ url, sessionId, paymentIntentId, orderId }` রেসপন্স দেয়

    নোট: `payments.service`-এ seller-এর Stripe অ্যাকাউন্ট এখন `service.creatorId` থেকে fetch করে নেওয়া হয় — পূর্বের ভুল (buyer থেকে seller ID নেওয়া) সংশোধন করা হয়েছে।

## STEP 4: Order DB এ তৈরি হয়

- Status: `PENDING`
- সেভ হয়: `sessionId`, `paymentIntentId`, `sellerIdStripe`, `amount`, `platformFee: 0`

## STEP 5: Webhook Setup (main.ts)

- Raw body middleware: `/payments/webhook` এ `express.raw()` সেট করা
- Stripe raw body চায় signature verification এর জন্য

## STEP 6: Stripe → Webhook ইভেন্ট পাঠায়

- Stripe checkout পেমেন্ট ঘটলে সাধারণত দুটি ইভেন্ট পাঠায়:
    - `checkout.session.completed`
    - `payment_intent.succeeded`

## STEP 7: Webhook Handler (checkout.session.completed)

- paymentIntentId বের করে order খুঁজে পায় (sessionId দিয়ে)
- যদি order-এ paymentIntentId না থাকে, আপডেট করে যোগ করে দেয়

## STEP 8: Webhook Handler (payment_intent.succeeded)

- PaymentIntent successful হলে paymentIntentId দিয়ে order খুঁজে পায়
- Order status আপডেট: `PENDING` → `PAID`

## STEP 9: Admin Approve Payment

- `POST /payments/approve-payment` (Auth required)
- Request body: `{ orderID }`
- কাজ:
    - Order থেকে `paymentIntentId` ও `sellerIdStripe` নেয়
    - PaymentIntent ক্যাপচার করা না থাকলে `stripe.paymentIntents.capture()` করে ক্যাপচার করে
    - Platform fee calculate: `(amount * platformFeePercent) / 100`
    - Seller পাওয়া টাকা = মোট − প্ল্যাটফর্ম ফি
    - `stripe.transfers.create()` দিয়ে seller-এর Connected Account-এ টাকা ট্রান্সফার হয়
    - Order status আপডেট: `RELEASED`, `isReleased = true`, `releasedAt = now`

## STEP 10: Platform Fee গণনা

- Setting table থেকে `platformFee` (প্রতিশত) নেয় (e.g., 10%)
- Seller পায়: মোট টাকা − (মোট × প্ল্যাটফর্ম ফি%)

---

## Order Lifecycle (সংক্ষিপ্ত)

1. `PENDING` — Checkout session তৈরি ও order record
2. `PAID` — `payment_intent.succeeded` webhook থেকে
3. `RELEASED` — Admin capture ও transfer এর পরে

---

## Environment Variables
