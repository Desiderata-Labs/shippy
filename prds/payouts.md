# Fixed-Payment Bounties PRD

## Overview

Extend Shippy to support **fixed-payment bounties** alongside the existing profit-share model. Contributors can earn either ongoing profit share (points) OR immediate fixed payments ($) depending on the bounty type.

---

## Current State

Today, all bounties use profit-share:

- Bounty has a `points` field (nullable Int, null = backlog)
- Points = permanent share of reward pool
- Contributors paid periodically when founder reports profit
- Submission has `pointsAwarded` field (set on approval)

This works great for ongoing contributor relationships but doesn't cover:

- Bug bounty programs with fixed payouts
- One-off tasks with clear $ value
- Campaigns where immediate payment makes more sense

---

## Proposed Model

Each bounty can be one of two types:

| Type              | Reward          | When Paid                  | Best For                          |
| ----------------- | --------------- | -------------------------- | --------------------------------- |
| **PROFIT_SHARE**  | Points → % pool | Periodic (monthly/quarter) | Ongoing contributor relationships |
| **FIXED_PAYMENT** | Fixed $ amount  | Immediately on approval    | Bug bounties, one-off tasks       |

### Profit Share (Current Model)

```
Bounty: "Build feature X" → 50 points

Contributor completes work
→ Founder approves
→ Contributor earns 50 pts (5% of 1,000 pt pool)
→ Gets paid every month/quarter based on reported profit
→ Keeps earning forever (or until pool sunsets)
```

**Characteristics:**

- Points = permanent % of pool
- Payouts happen periodically based on reported profit
- Contributors aligned with long-term success
- No upfront cost to founder

### Fixed Payment (New)

```
Bounty: "Critical vulnerability" → $5,000

Contributor completes work
→ Founder approves
→ Stripe immediately pays contributor $5,000
→ Done. No ongoing relationship.
```

**Characteristics:**

- Fixed $ amount set upfront
- Paid immediately on approval via Stripe
- No points, no ongoing share
- Clear cost to founder, clear payout to contributor

---

## Use Cases

### 1. Bug Bounty Program

> "We want a security bounty program with fixed payouts like HackerOne."

```
Critical vulnerability: $5,000 (FIXED_PAYMENT)
High severity bug: $2,000 (FIXED_PAYMENT)
Medium severity bug: $500 (FIXED_PAYMENT)
```

Researchers know exactly what they'll earn. Paid instantly on verified fix.

### 2. One-Off Content Campaign

> "We need 10 blog posts at $200 each."

```
"Write a blog post about X" → $200 (FIXED_PAYMENT, MULTIPLE mode)
```

Clear scope, clear payment. No ongoing relationship needed.

### 3. Mixed Project

> "Sales work should be profit-share, but design tasks are one-off."

```
"Close enterprise deal" → 100 points (PROFIT_SHARE)
"Design landing page" → $1,000 (FIXED_PAYMENT)
"Build referral system" → 50 points (PROFIT_SHARE)
"Write case study" → $300 (FIXED_PAYMENT)
```

Founders choose the right model per task.

### 4. Traditional Freelance Model

> "We just want to pay people for work, no profit sharing."

All bounties set to FIXED_PAYMENT. Works like Upwork/Fiverr but on Shippy's platform.

---

## Data Model Changes

### New Enum (src/lib/db/types.ts)

```typescript
export enum RewardType {
  PROFIT_SHARE = 'PROFIT_SHARE', // Points → ongoing pool share
  FIXED_PAYMENT = 'FIXED_PAYMENT', // Direct $ → paid on approval
}
```

### Bounty Changes (prisma/schema.prisma)

```prisma
model Bounty {
  // Existing fields...
  id          String  @id @default(dbgenerated("nanoid()"))
  projectId   String
  number      Int
  title       String
  description String  @db.Text
  status      String  @default("OPEN")

  // Claim configuration (existing)
  claimMode       String   @default("SINGLE")
  claimExpiryDays Int      @default(14)
  maxClaims       Int?

  // Evidence requirements (existing)
  evidenceDescription String? @db.Text

  // === NEW: Reward type ===
  rewardType  String  @default("PROFIT_SHARE") // "PROFIT_SHARE" | "FIXED_PAYMENT"

  // For PROFIT_SHARE bounties (existing field)
  points      Int?    // Point value (null = backlog)

  // For FIXED_PAYMENT bounties (new)
  valueCents  BigInt? // Dollar value in cents (e.g., 500000 = $5,000)

  // ... rest of existing fields
}
```

### Submission Changes (prisma/schema.prisma)

```prisma
model Submission {
  // Existing fields...
  id          String @id @default(dbgenerated("nanoid()"))
  bountyId    String
  userId      String
  description String @db.Text
  status      String @default("PENDING")

  // Points awarded - for PROFIT_SHARE (existing)
  pointsAwarded Int?
  approvedAt    DateTime? @db.Timestamptz(3)
  rejectedAt    DateTime? @db.Timestamptz(3)
  rejectionNote String?   @db.Text

  // === NEW: Fixed payment tracking ===
  payoutStatus    String?   // "PENDING" | "PROCESSING" | "PAID" | "FAILED"
  payoutId        String?   // Stripe payout/transfer ID
  paidAt          DateTime? @db.Timestamptz(3)
  paidAmountCents BigInt?   // Actual amount paid (may differ due to fees)

  // ... rest of existing fields
}
```

### New Enum for Payout Status (src/lib/db/types.ts)

```typescript
export enum FixedPayoutStatus {
  PENDING = 'PENDING', // Approved, awaiting payout
  PROCESSING = 'PROCESSING', // Stripe transfer initiated
  PAID = 'PAID', // Successfully paid
  FAILED = 'FAILED', // Payment failed (needs retry)
}
```

### Migration Strategy

```sql
-- Add rewardType with default for existing bounties
ALTER TABLE "bounty" ADD COLUMN "rewardType" TEXT NOT NULL DEFAULT 'PROFIT_SHARE';

-- Add valueCents for fixed-payment bounties
ALTER TABLE "bounty" ADD COLUMN "valueCents" BIGINT;

-- Add payout tracking to submissions
ALTER TABLE "submission" ADD COLUMN "payoutStatus" TEXT;
ALTER TABLE "submission" ADD COLUMN "payoutId" TEXT;
ALTER TABLE "submission" ADD COLUMN "paidAt" TIMESTAMPTZ(3);
ALTER TABLE "submission" ADD COLUMN "paidAmountCents" BIGINT;
```

---

## Stripe Integration

Shippy acts as the **payment facilitator** (like Upwork, Fiverr, or GitHub Sponsors). Founders pay Shippy, Shippy pays contributors.

### How It Works

```
Founder creates bounty ($500)
     ↓
Contributor claims, completes, submits
     ↓
Founder approves
     ↓
Shippy charges founder ($500 + fees)
     ↓
Shippy pays contributor via Stripe Connect ($500)
     ↓
Contributor receives funds in bank account
```

### Contributor Setup (Stripe Connect Express)

1. Contributor claims a fixed-payment bounty (or receives first profit-share payout)
2. Prompted to connect Stripe Express account
3. Stripe handles KYC, tax info, bank account setup
4. Contributor's account ready to receive payouts
5. `stripeAccountId` stored on User model

### Founder Payment

Founders pay Shippy directly — no Stripe Connect setup needed:

- **Per-approval:** Charged when approving a FIXED_PAYMENT submission
- **Balance/credits:** Pre-fund Shippy account (future)
- **Invoicing:** Monthly invoice for all payouts (future, for larger customers)

### Approval → Payout Flow

```
1. Contributor submits work
2. Founder reviews and clicks "Approve & Pay"
3. approveSubmission() detects FIXED_PAYMENT bounty
4. Shippy charges founder:
   - Bounty amount: $500
   - Platform fee (10%): $50
   - Stripe fees: ~$16
   - Total charged: ~$566
5. Shippy transfers $500 to contributor's Express account
6. Submission.payoutStatus = "PAID"
7. Both parties notified
```

### Fee Structure

```
Bounty value:           $500.00
Platform fee (10%):     + $50.00
Stripe fee (~2.9%+$0.30): + $16.33
─────────────────────────────────
Founder pays:           $566.33
Contributor receives:   $500.00
```

**Contributor always gets the full bounty amount.** Founder covers all fees.

### Profit-Share Payouts (Future Enhancement)

Same infrastructure can automate periodic profit-share payouts:

1. Payout period ends (monthly/quarterly)
2. Founder enters profit and clicks "Run Payout"
3. Shippy calculates each contributor's share
4. Shippy charges founder the total pool amount + fees
5. Shippy pays each contributor their share via Stripe Connect

This replaces the current manual "mark as sent" → "confirm receipt" flow.

---

## Service Changes

### createBounty (src/server/services/bounty.ts)

Add validation for reward type:

```typescript
export interface CreateBountyParams {
  // ... existing params
  rewardType?: RewardType // NEW
  valueCents?: bigint // NEW (for FIXED_PAYMENT)
}

// In createBounty():
if (rewardType === RewardType.FIXED_PAYMENT) {
  if (!valueCents || valueCents <= 0) {
    return { success: false, code: 'INVALID_VALUE', message: 'Fixed payment bounties require a positive valueCents' }
  }
  if (points !== null) {
    return { success: false, code: 'INVALID_POINTS', message: 'Fixed payment bounties cannot have points' }
  }
} else {
  if (valueCents) {
    return { success: false, code: 'INVALID_VALUE', message: 'Profit share bounties cannot have valueCents' }
  }
}
```

### approveSubmission (src/server/services/submission.ts)

Branch on reward type:

```typescript
// In approveSubmission():
const rewardType = submission.bounty.rewardType as RewardType

if (rewardType === RewardType.FIXED_PAYMENT) {
  const valueCents = submission.bounty.valueCents!
  const contributor = await prisma.user.findUnique({
    where: { id: submission.userId },
  })

  // Verify contributor has Stripe account
  if (!contributor?.stripeAccountId) {
    throw new Error('Contributor must connect Stripe to receive payment')
  }

  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      status: SubmissionStatus.APPROVED,
      approvedAt: new Date(),
      payoutStatus: FixedPayoutStatus.PENDING,
      paidAmountCents: valueCents,
    },
  })

  // Charge founder and pay contributor (via Shippy's Stripe account)
  await processFixedPayment({
    submissionId,
    founderId: project.founderId,
    contributorStripeAccountId: contributor.stripeAccountId,
    amountCents: valueCents,
    platformFeePercent: 10,
  })
} else {
  // Existing points logic (unchanged)
  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      status: SubmissionStatus.APPROVED,
      pointsAwarded,
      approvedAt: new Date(),
    },
  })
  // ... pool expansion logic
}
```

---

## UI Changes

### Bounty Editor (src/components/bounty/bounty-editor.tsx)

Add reward type toggle:

```tsx
<div className="space-y-2">
  <Label>Reward Type</Label>
  <RadioGroup value={rewardType} onValueChange={setRewardType}>
    <RadioGroupItem value="PROFIT_SHARE" label="Profit Share">
      Points earned = ongoing share of reward pool
    </RadioGroupItem>
    <RadioGroupItem value="FIXED_PAYMENT" label="Fixed Payment" disabled={!hasStripeConnect}>
      Dollar amount paid immediately on approval
      {!hasStripeConnect && <span className="text-muted-foreground"> (requires Stripe Connect)</span>}
    </RadioGroupItem>
  </RadioGroup>
</div>

{rewardType === 'PROFIT_SHARE' ? (
  <div className="space-y-2">
    <Label>Points</Label>
    <Input type="number" value={points} onChange={...} />
  </div>
) : (
  <div className="space-y-2">
    <Label>Amount</Label>
    <div className="flex items-center gap-2">
      <span>$</span>
      <Input type="number" value={valueDollars} onChange={...} />
    </div>
  </div>
)}
```

### Bounty Card/Detail

```tsx
// Display based on reward type
{
  bounty.rewardType === 'FIXED_PAYMENT' ? (
    <Badge variant="secondary">
      ${(Number(bounty.valueCents) / 100).toLocaleString()}
    </Badge>
  ) : bounty.points ? (
    <Badge variant="secondary">{bounty.points} pts</Badge>
  ) : (
    <Badge variant="outline">Backlog</Badge>
  )
}
```

### Approval Flow (Fixed Payment)

```tsx
// When approving a FIXED_PAYMENT submission
<AlertDialog>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Approve & Pay</AlertDialogTitle>
      <AlertDialogDescription>
        This will approve the submission and immediately pay the contributor{' '}
        <strong>${(Number(bounty.valueCents) / 100).toLocaleString()}</strong>{' '}
        via Stripe.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleApprove}>
        Approve & Pay
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Contributor Dashboard

```tsx
<Tabs defaultValue="profit-share">
  <TabsList>
    <TabsTrigger value="profit-share">Profit Share</TabsTrigger>
    <TabsTrigger value="fixed-payments">Fixed Payments</TabsTrigger>
  </TabsList>

  <TabsContent value="profit-share">
    {/* Existing points/pool share view */}
  </TabsContent>

  <TabsContent value="fixed-payments">
    <div className="space-y-4">
      <div className="text-2xl font-bold">
        ${totalFixedEarnings.toLocaleString()}
      </div>
      <div className="text-muted-foreground">
        Total earned from fixed-payment bounties
      </div>
      {/* List of fixed-payment submissions */}
    </div>
  </TabsContent>
</Tabs>
```

---

## Validation Rules

### Creating Bounties

| Field        | PROFIT_SHARE       | FIXED_PAYMENT        |
| ------------ | ------------------ | -------------------- |
| `rewardType` | Required           | Required             |
| `points`     | Required (or null) | Must be null         |
| `valueCents` | Must be null       | Required, > 0        |
| Stripe       | Not required       | Founder must connect |

### Claiming Bounties

| Condition          | PROFIT_SHARE | FIXED_PAYMENT                |
| ------------------ | ------------ | ---------------------------- |
| Contributor Stripe | Not required | Prompted before first payout |

### Approving Submissions

| Condition              | PROFIT_SHARE   | FIXED_PAYMENT                        |
| ---------------------- | -------------- | ------------------------------------ |
| Founder payment method | N/A            | Required (Stripe charges on approve) |
| Contributor Stripe     | Not required   | Required (prompted if missing)       |
| Points override        | Yes (existing) | No (fixed amount)                    |

---

## MVP Scope

### Phase 1: Data Model & UI (No Payments Yet)

- [ ] Add `RewardType` enum to `src/lib/db/types.ts`
- [ ] Add `rewardType` and `valueCents` to Bounty model
- [ ] Create migration (default existing bounties to PROFIT_SHARE)
- [ ] Update bounty services: `createBounty`, `updateBounty`
- [ ] Update tRPC router validation schemas
- [ ] Bounty editor: toggle between profit-share and fixed-payment
- [ ] Display $ amounts on fixed-payment bounties
- [ ] Block fixed-payment creation (show "Coming soon" / require Stripe setup later)

### Phase 2: Stripe Connect Integration (SHP-12)

- [ ] Founder Stripe Connect onboarding
- [ ] Contributor Stripe Express account setup
- [ ] Add payout tracking fields to Submission
- [ ] Approval triggers Stripe payout for FIXED_PAYMENT
- [ ] Payout status tracking
- [ ] Error handling and retry logic

### Phase 3: Polish

- [ ] Contributor dashboard for fixed earnings
- [ ] Payout history and receipts
- [ ] Fee transparency (who pays what)
- [ ] Notifications for payout events

---

## Open Questions

1. **Who pays Stripe fees?**
   - Option A: Contributor absorbs (simpler, but they get less)
   - Option B: Founder pays extra (cleaner for contributor)
   - _Recommendation: Founder pays, contributor gets exact amount_

2. **Minimum payout?**
   - Stripe has minimum transfer amounts (~$1)
   - _Recommendation: $5 minimum for fixed-payment bounties_

3. **What if founder's payment fails?**
   - Stripe charge fails (insufficient funds, expired card, etc.)
   - _Recommendation: Submission stays APPROVED but payoutStatus = FAILED. Prompt founder to retry payment._

4. **Refunds/disputes?**
   - What if founder wants to reverse a payout?
   - _Recommendation: Out of scope for MVP. Handle manually via Stripe dashboard._

5. **Can fixed-payment bounties go to backlog?**
   - _Recommendation: No. valueCents is required. Use PROFIT_SHARE with null points for backlog._

---

## Relationship to Other Bounties

### SHP-12: Stripe Connect Integration

That bounty handles the technical Stripe integration infrastructure. This PRD defines _what_ we're building (fixed-payment bounties); SHP-12 defines _how_ we implement the payment rails.

**Dependency:** Phase 2 of this feature requires SHP-12 to be completed first.

### Reward Pool

Fixed-payment bounties exist _outside_ the reward pool system:

- They don't consume pool capacity
- They don't affect point calculations
- They don't dilute profit-share contributors
- The pool is purely for PROFIT_SHARE bounties

### Platform Fee

Shippy's platform fee (currently 10%) applies to both:

- **Profit-share:** % of each periodic payout
- **Fixed-payment:** % of each bounty value (taken at approval time)

---

## Future Considerations

### Pre-Funded Balance / Credits

Instead of charging per-approval:

1. Founder pre-funds Shippy account (like ad credits)
2. Approvals deduct from balance
3. Auto-top-up when low

_Pros: Faster approvals (no payment step), predictable for founders_
_Cons: Requires balance management UI_

### Escrow Model

Instead of founder paying on approval:

1. Founder funds escrow when bounty created
2. Funds held by Shippy until approval
3. Released to contributor on approval

_Pros: Guaranteed payment, builds contributor trust_
_Cons: Ties up founder capital, adds complexity_

### Hybrid Bounties

Could a bounty have _both_ points and fixed payment?

```
"Close enterprise deal" → $500 bonus + 50 pts ongoing
```

_Recommendation: Keep it simple. One reward type per bounty for MVP._

### Bonus/Tip on Approval

Founder wants to add extra on a fixed-payment bounty:

```
Bounty: $500
Tip: $100
Total paid: $600
```

_Could be added later as optional field on approval (similar to existing pointsAwarded override)._

### Multiple Currencies

Support EUR, GBP, etc. for international contributors.

_Recommendation: USD only for MVP. Add multi-currency when demand justifies complexity._
