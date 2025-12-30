# Stripe Integration

Shippy uses Stripe for:

1. **Stripe Connect (Express)** - Contributors receive payouts via their connected Stripe accounts
2. **Stripe Checkout** - Founders pay for payouts (pool + platform fee + processing fees)
3. **Stripe Transfers** - Shippy distributes funds to contributors after founder payment
4. **ACH Direct Debit** - US bank account payments for lower fees and reduced fraud risk

## Quick Start

### 1. Create a Stripe Account

Sign up at [stripe.com](https://stripe.com) if you haven't already.

### 2. Enable Stripe Connect

**Important:** You must enable Stripe Connect before users can connect their accounts.

1. Go to [Connect Settings](https://dashboard.stripe.com/settings/connect)
2. Click **Get started** to enable Connect
3. Choose **Express** account type (recommended for platforms like Shippy)
4. Complete the onboarding form with your platform details
5. Configure your Connect branding (logo, colors, etc.)

> **Note:** If you skip this step, you'll see the error:
> _"You can only create new accounts if you've signed up for Connect"_

### 3. Get API Keys

Go to [Developers → API Keys](https://dashboard.stripe.com/apikeys):

- Copy **Secret key** (starts with `sk_test_` or `sk_live_`)
- Copy **Publishable key** (starts with `pk_test_` or `pk_live_`)

### 4. Set Environment Variables

Add to your `.env` file:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Stripe Webhook Secret (see below)
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 5. Set Up Webhooks

Shippy needs webhooks to:

- Sync contributor Stripe Connect account status
- Confirm founder payments for payouts

#### Production Setup

1. Go to [Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Set endpoint URL: `https://your-domain.com/api/webhooks/stripe`
4. Select events:
   - `account.updated`
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded` (for ACH)
   - `checkout.session.async_payment_failed` (for ACH)
5. Click **Add endpoint**
6. Copy the **Signing secret** to `STRIPE_WEBHOOK_SECRET`

#### Local Development with Stripe CLI

Install the [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Linux (Debian/Ubuntu)
curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
sudo apt update && sudo apt install stripe

# Windows (scoop)
scoop install stripe
```

Log in to your Stripe account:

```bash
stripe login
```

Forward webhooks to your local server:

```bash
stripe listen --forward-to localhost:3050/api/webhooks/stripe
```

This will output a webhook signing secret (starts with `whsec_`). Add it to your `.env`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

Keep this terminal running while developing!

## Architecture

### Payment Flow

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Founder   │──1──▶│   Shippy    │──3──▶│ Contributor │
│             │      │   (Stripe)  │      │  (Connect)  │
└─────────────┘      └─────────────┘      └─────────────┘
       │                    │
       │                    │
       ▼                    ▼
   2. Checkout         4. Transfer
      Session
```

1. Founder initiates payout → Shippy creates Stripe Checkout session
2. Founder pays via Checkout (pool + platform fee + Stripe fees)
3. After payment confirmed, Shippy transfers pool amount to contributors
4. Each contributor receives their share via Stripe Connect Transfer

### Fee Structure

When a founder runs a payout:

| Component           | Who Pays     | Description                                              |
| ------------------- | ------------ | -------------------------------------------------------- |
| Platform Fee (2%)   | Founder      | Shippy's 2% of the full pool (regardless of utilization) |
| Contributors' Share | Founder      | 98% of pool × utilization                                |
| Stripe Fees (~3%)   | Contributors | Absorbed from contributors' share                        |

**Key concept**: Shippy takes 2% of the **full pool amount**, like a guaranteed contributor. This is NOT scaled by utilization. Contributors' share (98%) IS scaled by utilization, and Stripe fees come out of their portion.

**Example at 100% utilization** ($1,000 pool):

- Shippy (2% of pool): $20
- Contributors (98% × 100%): $980
- Founder pays: $1,000
- Stripe fee (2.9% + $0.30): ~$29.30
- **Contributors receive**: ~$950.70 ($980 - Stripe)
- **Shippy receives**: $20

**Example at 2.5% utilization** ($1,000 pool, only 25 of 1000 points earned):

- Shippy (2% of pool): $20 (full amount, not scaled!)
- Contributors (98% × 2.5%): $24.50
- Founder pays: $44.50
- Stripe fee: ~$1.59
- **Contributors receive**: ~$22.91 ($24.50 - Stripe)
- **Shippy receives**: $20

## Payment Methods & Fraud Prevention Strategy

> **TL;DR:** Use credit cards with **mandatory 3D Secure** for most payments (liability shifts to issuer). Require **ACH for large payouts** (>$2k) due to lower fraud and shorter business account dispute windows. **Always delay transfers 7-14 days** regardless of payment method.

### Payment Method Comparison

| Method             | Dispute Window      | Contestable? | Liability Shift?  | Fraud Risk | Stripe Fees   |
| ------------------ | ------------------- | ------------ | ----------------- | ---------- | ------------- |
| **Credit Card**    | 120 days            | ✅ Yes       | ✅ With 3D Secure | Higher     | 2.9% + $0.30  |
| **ACH (Personal)** | 60 days             | ❌ No, final | ❌ No             | Lower      | 0.8% (max $5) |
| **ACH (Business)** | **2 business days** | ❌ No, final | ❌ No             | Lower      | 0.8% (max $5) |

### Why 3D Secure Changes Everything

**3D Secure (3DS)** is the key to safe credit card payments. When 3DS authentication succeeds:

1. **Liability shifts to the card issuer** - The bank eats fraud chargebacks, not Shippy
2. **Disputes are still contestable** - Unlike ACH, you can fight and win
3. **Better fraud detection** - Bank verifies cardholder identity

This makes credit cards with mandatory 3DS potentially **safer than ACH** because:

- ACH disputes are final and uncontestable
- 3DS shifts fraud liability away from the platform
- You retain the ability to dispute non-fraud chargebacks

### ACH Direct Debit (US Bank Accounts)

ACH has lower fraud rates but different trade-offs:

**Pros:**

- Lower fees (0.8%, capped at $5 vs 2.9% + $0.30 for cards)
- Business accounts have only 2-day dispute window
- Lower fraud rates overall (no stolen card numbers)
- Stripe Radar covers ACH (reduces fraud by ~20%)

**Cons:**

- Disputes are **final and uncontestable** - once disputed, money is gone forever
- Personal accounts have 60-day window (longer than credit cards for fraud liability!)
- No chargeback protection product available from Stripe
- Slower settlement (3-5 business days vs instant)
- US-only

**ACH Return Codes to Monitor:**

- `R01` - Insufficient funds
- `R02` - Account closed
- `R10` - Customer advises unauthorized (fraud)
- `R29` - Corporate customer advises not authorized

### Recommended Strategy: Tiered Payment Methods

Based on payout size, require different payment methods:

| Payout Size   | Required Method              | Rationale                                |
| ------------- | ---------------------------- | ---------------------------------------- |
| < $500        | Credit Card (3DS required)   | Liability shifts to issuer, low friction |
| $500 - $2,000 | ACH preferred, card allowed  | Business accounts = 2-day window         |
| > $2,000      | ACH required + manual review | Lower fraud rates justify friction       |

**Implementation:**

```typescript
// In checkout session creation
const paymentMethodTypes = getPaymentMethodsForAmount(totalAmount)

function getPaymentMethodsForAmount(amountCents: number): string[] {
  const amount = amountCents / 100

  if (amount < 500) {
    return ['card'] // 3DS will be required via payment_method_options
  } else if (amount < 2000) {
    return ['us_bank_account', 'card'] // ACH preferred, card allowed
  } else {
    return ['us_bank_account'] // ACH only for large payouts
  }
}
```

### Delayed Transfers (Critical)

**Regardless of payment method**, delay all transfers to contributors:

| Founder Account Age  | Transfer Delay |
| -------------------- | -------------- |
| < 30 days            | 14 days        |
| 30-90 days           | 7 days         |
| > 90 days + verified | 3 days         |

This catches most fraud before funds leave the platform:

- Most stolen card fraud is detected within 7 days
- ACH returns typically occur within 5 business days
- Gives time for Stripe Radar to flag suspicious patterns

**Implementation:**

```typescript
// Add to PayoutRecipient model
scheduledTransferAt: DateTime // When transfer will execute
actualTransferAt: DateTime?   // When transfer actually executed

// In payout creation
const transferDelay = getTransferDelayDays(founder);
recipient.scheduledTransferAt = addDays(new Date(), transferDelay);
```

### Mandatory 3D Secure for All Card Payments

Always require 3D Secure authentication for card payments:

```typescript
const session = await stripe.checkout.sessions.create({
  // ... other options
  payment_method_types: ['card'],
  payment_method_options: {
    card: {
      request_three_d_secure: 'any', // Always request 3DS
    },
  },
  payment_intent_data: {
    setup_future_usage: undefined, // Don't save card (reduces fraud surface)
  },
})
```

**Why "any" instead of "automatic":**

- `automatic` - Only requests 3DS when Stripe thinks it's needed
- `any` - Always requests 3DS, maximizing liability shift

The slight UX friction is worth the fraud protection.

### Stripe Chargeback Protection (Optional)

For additional protection, enable [Stripe Chargeback Protection](https://stripe.com/chargeback-protection):

- **Cost:** 0.4% per transaction
- **Coverage:** Fraud-related chargebacks only (not "product not as described")
- **Limit:** Up to $25,000/year
- **When to use:** If chargeback rate exceeds 0.5% or for high-risk periods

### Stripe Connect

Contributors connect their Stripe accounts to receive payouts:

1. Contributor goes to Settings → Payments
2. Clicks "Connect with Stripe"
3. Completes Stripe's Express onboarding (KYC, tax info, bank account)
4. Account status synced via `account.updated` webhook

Account statuses:

- `PENDING` - Account created, onboarding not started
- `ONBOARDING` - User is completing onboarding
- `ACTIVE` - Fully onboarded, can receive payouts
- `RESTRICTED` - Account has issues (additional verification needed)
- `DISABLED` - Account disabled

## Testing

### Test Mode

Always use test API keys (`sk_test_`, `pk_test_`) in development. Stripe provides [test card numbers](https://stripe.com/docs/testing):

| Card Number         | Description                                              |
| ------------------- | -------------------------------------------------------- |
| 4242 4242 4242 4242 | Succeeds (funds go to pending balance)                   |
| 4000 0000 0000 0077 | **Succeeds (funds go to available balance immediately)** |
| 4000 0000 0000 0002 | Declined                                                 |
| 4000 0000 0000 3220 | 3D Secure required                                       |

#### ⚠️ Important: Test Mode Transfers

In test mode, regular payments go to Stripe's **pending balance**, not the **available balance**. This simulates the 2-day settlement period that occurs in production.

**Problem:** When you try to transfer funds to a connected account, Stripe checks your **available balance**. If you just made a payment with a regular test card, the funds are still "pending" and transfers will fail with:

> "You have insufficient available funds in your Stripe account"

**Solution:** Use the special test card `4000 0000 0000 0077`:

- This card bypasses the pending period
- Funds go directly to your available balance
- Transfers work immediately after payment

Alternatively, you can add test funds via the Stripe Dashboard:

1. Go to [Developers → Balance](https://dashboard.stripe.com/test/balance/overview)
2. Click **Add to balance** (only visible in test mode)
3. Enter an amount and confirm

Or wait for test mode to auto-settle (usually much faster than production).

### Test Webhooks

Trigger test events with the Stripe CLI:

```bash
# Trigger account.updated
stripe trigger account.updated

# Trigger checkout.session.completed
stripe trigger checkout.session.completed
```

### Test Connect Onboarding

In test mode, Stripe provides a simplified onboarding flow. You can skip verification steps by using test data.

### Test ACH Payments

#### Test Bank Connections (Financial Connections UI)

When testing ACH in Stripe Checkout, you'll see a bank selection UI. Use these test banks:

| Bank                    | What it tests                                      |
| ----------------------- | -------------------------------------------------- |
| **Test (Non-OAuth)** ✅ | Success - instant verification (recommended)       |
| **Test (OAuth)**        | Success - with OAuth popup flow                    |
| **Invalid Pay...**      | Payment fails (for testing `async_payment_failed`) |
| **Down (Error)**        | Bank connection error                              |

> **Tip:** Use **"Test (Non-OAuth)"** for quick successful tests.

#### Manual Test Bank Account Numbers

If using manual bank account entry (microdeposit verification):

| Routing Number | Account Number | Result                                          |
| -------------- | -------------- | ----------------------------------------------- |
| 110000000      | 000123456789   | Success                                         |
| 110000000      | 000111111116   | Fails with `insufficient_funds`                 |
| 110000000      | 000111111113   | Fails with `account_closed`                     |
| 110000000      | 000222222227   | Fails with `debit_not_authorized` (R10 - fraud) |

**Important ACH Testing Notes:**

1. **Async nature** - ACH payments don't complete immediately. Use `checkout.session.async_payment_succeeded` webhook.

2. **Microdeposit verification** - In test mode, use amounts `0.32` and `0.45` to verify.

3. **Instant verification** - Stripe Financial Connections can verify instantly (no microdeposits). More secure.

4. **Simulating ACH returns:**
   ```bash
   # Trigger an ACH failure event
   stripe trigger payment_intent.payment_failed --add payment_intent:payment_method_types=["us_bank_account"]
   ```

## Platform Risks & Mitigation

### Negative Balance Liability

As a platform using Stripe Connect with the "Buyers purchase from you" model, **Shippy is liable for negative balances** when contributors can't repay funds.

#### How Negative Balances Occur

1. **Founder pays $1,000** via Stripe Checkout
2. **Shippy transfers $500** to Contributor Alice
3. **Alice withdraws** the $500 to her bank account
4. **Weeks later**: Founder's credit card issues a **chargeback** (fraud, dispute, etc.)
5. **Stripe reverses** the $1,000 from Shippy's account
6. **Alice's Stripe balance goes negative** (-$500)
7. **If Alice can't/won't repay** → **Shippy owes that $500**

#### Common Causes

| Cause           | Description                               | Typical Timeline             |
| --------------- | ----------------------------------------- | ---------------------------- |
| **Chargebacks** | Founder disputes charge with their bank   | Up to 120 days after payment |
| **Refunds**     | Founder requests refund after payout made | Any time                     |
| **Fraud**       | Stolen credit card used for payment       | Usually within 30 days       |
| **ACH Returns** | Bank account payment fails after clearing | Up to 60 days                |

#### Current Mitigations

1. **Payment verification before transfer** - We only transfer funds after `checkout.session.completed` confirms payment succeeded
2. **Stripe's built-in delays** - Stripe holds funds for new accounts (typically 7-14 days before first payout)
3. **Express accounts** - Stripe handles identity verification, reducing fraud risk
4. **Audit trail** - All payments and transfers are logged in `stripe_event` table for disputes

#### Fraud Prevention (Priority: HIGH)

> **See also:** [Payment Methods & Fraud Prevention Strategy](#payment-methods--fraud-prevention-strategy) for the complete tiered approach including ACH, 3D Secure liability shift, and delayed transfers.

Stolen credit cards are a major risk, especially from certain regions. Implement these measures:

##### Stripe Checkout Settings (Enable in Dashboard)

1. **Enable Stripe Radar** - [Dashboard → Radar](https://dashboard.stripe.com/radar)
   - Blocks known fraudulent cards automatically
   - Machine learning on billions of transactions
   - Free for basic rules, $0.05/transaction for advanced

2. **Require 3D Secure (SCA)** - Add to Checkout session:

   ```typescript
   payment_intent_data: {
     setup_future_usage: undefined, // Don't save card
   },
   payment_method_options: {
     card: {
       request_three_d_secure: 'any', // Always request 3DS
     },
   },
   ```

3. **Enable Address Verification (AVS)** - In Radar rules:
   - Block if postal code doesn't match
   - Block if address doesn't match

4. **Custom Radar Rules** - [Dashboard → Radar → Rules](https://dashboard.stripe.com/radar/rules)

   ```
   # Block high-risk countries (adjust based on your data)
   Block if :card_country: in ('RU', 'NG', 'BR', 'IN', 'PH', 'ID')

   # Block prepaid/virtual cards
   Block if :card_funding: = 'prepaid'

   # Block if email domain is disposable
   Block if :email_domain: in @disposable_email_domains

   # Review large transactions
   Review if :amount_in_usd: > 500

   # Block repeated failed attempts
   Block if :total_charges_per_card_number_daily: > 3
   Block if :total_charges_per_email_daily: > 5
   ```

##### Application-Level Fraud Prevention

| Measure                     | Description                               | Implementation                                     |
| --------------------------- | ----------------------------------------- | -------------------------------------------------- |
| **Payout delay**            | Hold transfers 7-14 days                  | Add `scheduledTransferAt` to PayoutRecipient       |
| **Email verification**      | Require verified email for founders       | Check `user.emailVerified` before checkout         |
| **Account age requirement** | No payouts to accounts < 7 days old       | Check `user.createdAt` in `processPayoutTransfers` |
| **Velocity limits**         | Max $X per day/week per project           | Add rate limiting table                            |
| **Large payout review**     | Manual approval for payouts > $1,000      | Add `requiresManualApproval` flag                  |
| **IP geolocation**          | Flag mismatched card country / IP country | Log IP in checkout metadata                        |

##### Country-Based Risk (Controversial but Practical)

High chargeback regions based on industry data. Options:

1. **Block entirely** - Risky but safest (may lose legitimate users)
2. **Require 3D Secure only** - Good balance
3. **Delay payouts longer** - 30 days instead of 7
4. **Lower payout limits** - Max $100/month until trust established

##### Recommended Radar Rules for Shippy

```
# === BLOCK RULES ===
# Known fraud patterns
Block if :card_funding: = 'prepaid' and :amount_in_usd: > 50
Block if :is_disposable_email:
Block if :card_country: != :ip_country: and :amount_in_usd: > 100

# Velocity abuse
Block if :total_charges_per_card_number_daily: > 2
Block if :total_charges_per_email_weekly: > 5

# === REVIEW RULES ===
# Manual review for high-risk
Review if :amount_in_usd: > 500
Review if :card_country: in ('NG', 'GH', 'KE', 'PH', 'ID', 'VN')
Review if :risk_level: = 'highest'
```

#### Future Mitigations (Backlog)

- **Reserve fund** - Keep 10% of platform fees as reserve for chargebacks
- **Chargeback insurance** - Stripe offers this for high-volume platforms
- **Contributor payout limits** - Cap withdrawals for new contributors
- **Two-factor for large payouts** - Require 2FA for payouts > $500
- **Founder verification** - Verify business/identity for projects with large pools

#### Financial Impact

With a 2% platform fee, Shippy would need ~50 successful payouts to cover one fully-charged-back payout of equal size. Monitor chargeback rates closely - industry standard is <1%.

### Stripe Fees

Shippy passes Stripe processing fees to founders (2.9% + $0.30 per transaction). However, be aware:

- **Refunds** - Stripe keeps the original processing fee even when refunding
- **Disputes** - Stripe charges $15 per dispute (waived if you win)
- **Connect transfers** - Free for transfers to Express accounts

## Troubleshooting

### "Insufficient available funds" when transferring

This is a **test mode issue**. See [Test Mode Transfers](#️-important-test-mode-transfers) above.

**Quick fix:** Use test card `4000 0000 0000 0077` instead of `4242 4242 4242 4242`. This card puts funds directly in your available balance.

### "Missing STRIPE_SECRET_KEY environment variable"

Ensure `STRIPE_SECRET_KEY` is set in your `.env` file and the server was restarted after adding it.

### Webhook signature verification failed

1. Make sure `STRIPE_WEBHOOK_SECRET` matches the secret from your webhook endpoint (or Stripe CLI output)
2. Ensure the raw request body is used for verification (not parsed JSON)
3. Check that no middleware is modifying the request body

### Connect account stuck in "onboarding"

1. Check if the user completed all Stripe verification steps
2. View account status in [Stripe Dashboard → Connect → Accounts](https://dashboard.stripe.com/connect/accounts)
3. Check `requirements.currently_due` for missing information

### Checkout session not completing

1. Verify the success URL includes `{CHECKOUT_SESSION_ID}` placeholder
2. Check webhook logs in Stripe Dashboard
3. Ensure `checkout.session.completed` webhook is properly configured

## Environment Variables Reference

| Variable                 | Required | Description                               |
| ------------------------ | -------- | ----------------------------------------- |
| `STRIPE_SECRET_KEY`      | Yes      | Stripe API secret key                     |
| `STRIPE_PUBLISHABLE_KEY` | Yes      | Stripe API publishable key (for frontend) |
| `STRIPE_WEBHOOK_SECRET`  | Yes      | Webhook signing secret for verification   |

## Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Stripe ACH Direct Debit](https://stripe.com/docs/payments/ach-debit)
- [Stripe 3D Secure](https://stripe.com/docs/payments/3d-secure)
- [Stripe Chargeback Protection](https://stripe.com/docs/disputes/chargeback-protection)
- [Stripe Radar Rules](https://stripe.com/docs/radar/rules)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Stripe API Reference](https://stripe.com/docs/api)
