# Subscription Webhook Setup (Paddle)

Plan activation is **server-side only** via the `subscriptionWebhook` Cloud Function. The frontend never updates plan; only the webhook does after payment succeeds.

## 1. Set the webhook secret

In Paddle Dashboard → Developer Tools → Notifications (or Notification settings), get your **Endpoint secret key** for the webhook destination.

Then in your project:

```bash
cd functions
firebase functions:secrets:set PADDLE_WEBHOOK_SECRET
# Paste the endpoint secret key when prompted.
```

## 2. Deploy the function

```bash
npm run build
firebase deploy --only functions:subscriptionWebhook
```

Note the function URL (e.g. `https://us-central1-YOUR_PROJECT.cloudfunctions.net/subscriptionWebhook`).

## 3. Configure Paddle to send webhooks

In Paddle Dashboard → Notifications → Add endpoint:

- **URL:** The `subscriptionWebhook` URL from step 2.
- **Events:** Subscribe to at least:
  - `subscription.created`
  - `transaction.completed`

Save. Paddle will send a `Paddle-Signature` header; the function verifies it using `PADDLE_WEBHOOK_SECRET`.

## 4. What the webhook does

On `subscription.created` or `transaction.completed`:

1. Verifies the request using `Paddle-Signature` and `PADDLE_WEBHOOK_SECRET`.
2. Reads `custom_data` from the payload (set at checkout: `userId`, `email`, `selectedPlan`).
3. Updates Firestore: `users/{userId}` with:
   - `currentPlan`: from `selectedPlan` (Trends+ or Analytics+)
   - `subscriptionStatus`: `"active"`
   - `subscriptionStartDate`: server timestamp
   - `subscriptionId`: Paddle subscription/transaction ID when present
4. Returns `200 OK`.

No plan updates happen from the frontend; only this webhook updates plans after successful payment.
