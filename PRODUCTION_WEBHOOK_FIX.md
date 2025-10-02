# Production Webhook Fix

## Issues Identified:

1. **Webhook Signature Validation Failing** - All webhook requests returning 401 "Invalid webhook signature"
2. **User Still on Free Plan** - Despite successful payment, user remains on free plan
3. **Share Links Blocked** - Cannot generate share links due to free plan restriction

## Root Cause:

The webhook signature validation was using `JSON.stringify(req.body)` but the webhook route uses `express.raw()`, which provides a Buffer, not a JSON object.

## Fix Applied:

Updated `subscriptionController.js` to properly handle the raw body:

```javascript
// OLD (incorrect):
const rawBody = JSON.stringify(req.body);

// NEW (correct):
const rawBody = req.body.toString('utf8');
```

## Next Steps:

1. **Deploy the fix** to production
2. **Verify webhook URL** in Lemon Squeezy dashboard
3. **Test webhook signature validation** with new logging
4. **Manually update subscription** if needed

## Webhook URL to Verify:

Make sure the webhook URL in Lemon Squeezy dashboard is:
```
https://node-backend-1-21an.onrender.com/api/subscription/webhook
```

## Manual Subscription Update (if needed):

If webhooks still fail, you can manually update the user's subscription:

```sql
UPDATE companies 
SET subscription_plan = 'pro',
    subscription_status = 'active',
    subscription_id = 'ACTUAL_SUBSCRIPTION_ID_FROM_LEMON_SQUEEZY',
    lemonsqueezy_customer_id = 'ACTUAL_CUSTOMER_ID',
    subscription_start_date = NOW(),
    next_billing_date = NOW() + INTERVAL '1 month'
WHERE user_id = '0be2ed29-2c38-48a9-825e-d9b237e1a9ab';
```

## Testing:

After deployment, test by:
1. Making a new payment
2. Checking webhook logs for successful signature validation
3. Verifying subscription status updates
4. Testing share link generation
