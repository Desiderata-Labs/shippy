# Payouts & Reward Pools PRD

## Overview

Expand Shippy's reward system beyond profit-share pools to support multiple pool types, multiple pools per project, and flexible payout models.

---

## Current State

Today, each project has one reward pool with:

- Fixed % of profit/revenue (e.g., 10%)
- Points = permanent share of pool
- Periodic payouts (monthly/quarterly)

This works great for ongoing contributor relationships but doesn't cover all use cases.

---

## Proposed Pool Types

| Pool Type        | How It Works                      | Best For                              |
| ---------------- | --------------------------------- | ------------------------------------- |
| **PROFIT_SHARE** | X% of profit, paid periodically   | Ongoing contributor relationships     |
| **FIXED_BUDGET** | Fixed $ cap, paid until exhausted | Security bounties, one-time campaigns |
| **PER_BOUNTY**   | Each bounty has explicit $ value  | Traditional bounty programs           |

### 1. PROFIT_SHARE (Current Model)

```
Pool: 10% of net profit
Capacity: 1,000 points
Payout: Monthly

Contributor earns 100 pts → Gets 10% of each payout forever
```

**Characteristics:**

- Points = permanent % of pool
- Payouts happen periodically based on reported profit
- Pool runs until sunset/closed
- Contributors aligned with long-term success

### 2. FIXED_BUDGET (New)

```
Pool: $20,000 budget
Security bug bounties

Critical bug: 500 pts ($5,000)
High bug: 200 pts ($2,000)
Medium bug: 50 pts ($500)

Pool closes when $20k spent
```

**Characteristics:**

- Fixed $ budget set upfront
- Points convert to $ at fixed rate (not %)
- Pool closes when budget exhausted
- Good for time-bound or scope-bound work
- No ongoing profit dependency

**Use cases:**

- Security bug bounty programs
- One-time content campaigns
- Crowdsourced design work
- Launch marketing pushes

### 3. PER_BOUNTY (New)

```
No pool percentage
Each bounty priced individually:

"Critical vulnerability": $50,000
"Add dark mode": $500
"Write blog post": $200

Paid on approval
```

**Characteristics:**

- No pool at all—bounties have direct $ values
- Paid immediately on approval (or batched)
- Like traditional freelance/bounty platforms
- No points system, no ongoing share

**Use cases:**

- Traditional bug bounty programs (like HackerOne)
- One-off contractor work
- Projects that want simple $/task model

---

## Use Cases

### 1. Different Contributor Types (Primary)

> "We want salespeople on 33% profit share but content creators on a fixed $5k/month budget."

```
Project: Oath
├── Sales Pool (PROFIT_SHARE, 33% profit)
│   └── "Close new clinic" → 100 pts (ongoing share)
├── Content Pool (FIXED_BUDGET, $5k/month)
│   └── "Write case study" → $500
```

### 2. Security Bug Bounty Program

> "We have $20k for security bounties. Critical = $5k, High = $2k, Medium = $500."

```
Project: Shippy
├── Security Pool (FIXED_BUDGET, $20,000)
│   └── "Critical vulnerability" → $5,000
│   └── "High severity bug" → $2,000
│   └── "Medium severity bug" → $500
│   Pool closes when $20k exhausted
```

### 3. Crowdsourced Content Campaign

> "We want 20 blog posts at $200 each. Fixed $4k budget."

```
Project: Oath
├── Content Campaign (FIXED_BUDGET, $4,000)
│   └── "Write a blog post about X" → $200 (MULTIPLE mode, max 20)
│   Pool closes when 20 posts approved
```

### 4. Terms Evolution

> "We started with 5% revenue. Now we're profitable and want to switch to 10% profit."

- Sunset old pool (SUNSET status, payouts continue for commitment period)
- Create new pool with new terms
- Contributors in old pool keep earning until sunset ends

### 5. Acquisition/Pivot

> "We're pivoting. Old contributors keep their legacy pool, new work goes to new pool."

- Old pool enters SUNSET (no new bounties)
- New pool for new direction
- Clean separation of terms

---

## Data Model

### RewardPool (Expanded)

```prisma
model RewardPool {
  id        String  @id @default(dbgenerated("nanoid()"))
  projectId String
  project   Project @relation(fields: [projectId], references: [id])

  // Identity
  name      String  // "Sales Pool", "Security Bounties", etc.

  // Pool type determines payout mechanics
  poolType  String  // "PROFIT_SHARE" | "FIXED_BUDGET" | "PER_BOUNTY"

  // PROFIT_SHARE fields
  poolPercentage   Int?     // % of profit/revenue
  profitBasis      String?  // "NET_PROFIT" | "GROSS_REVENUE"
  payoutFrequency  String?  // "MONTHLY" | "QUARTERLY"
  poolCapacity     Int?     // Points capacity (default 1000)

  // FIXED_BUDGET fields
  budgetCents      BigInt?  // Total budget in cents
  spentCents       BigInt?  // How much has been spent

  // Shared fields
  currencyCode     String   @default("USD")

  // Lifecycle
  status           String   @default("ACTIVE") // "ACTIVE" | "SUNSET" | "CLOSED"

  // Commitment (for PROFIT_SHARE)
  commitmentMonths  Int?
  commitmentEndsAt  DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  bounties Bounty[]
  payouts  Payout[]
}
```

### Bounty Changes

```prisma
model Bounty {
  // Existing fields...
  poolId    String?   // Link to specific pool (null = project default)
  pool      RewardPool? @relation(...)

  // For PER_BOUNTY pools or FIXED_BUDGET with direct pricing
  valueCents  BigInt?  // Direct $ value (alternative to points)

  // Existing
  points      Int?     // Point value (for PROFIT_SHARE pools)
}
```

---

## Pool Lifecycle

```
ACTIVE → SUNSET → CLOSED
```

| Status     | New Bounties | Claims | Payouts | Points        |
| ---------- | ------------ | ------ | ------- | ------------- |
| **ACTIVE** | ✅           | ✅     | ✅      | ✅            |
| **SUNSET** | ❌           | ❌     | ✅      | ✅ (existing) |
| **CLOSED** | ❌           | ❌     | ❌      | ❌            |

**SUNSET** (for PROFIT_SHARE):

- No new bounties, existing work can complete
- Payouts continue until commitment ends
- Contributors keep earning on approved work

**CLOSED** (for FIXED_BUDGET):

- Budget exhausted or manually closed
- Final payouts processed
- No further activity

---

## UI

### Project Settings (Founder)

```
Reward Pools
─────────────────────────────────────────
[+] Create New Pool

┌─ Sales Pool ───────────────────────────┐
│ Type: Profit Share (33% net profit)    │
│ Status: ACTIVE                         │
│ Capacity: 450 / 1,000 pts              │
│ [Manage] [Sunset]                      │
└────────────────────────────────────────┘

┌─ Security Bounties ────────────────────┐
│ Type: Fixed Budget ($20,000)           │
│ Status: ACTIVE                         │
│ Spent: $7,500 / $20,000                │
│ [Manage]                               │
└────────────────────────────────────────┘

┌─ Content Campaign (Legacy) ────────────┐
│ Type: Fixed Budget ($4,000)            │
│ Status: CLOSED (budget exhausted)      │
│ Spent: $4,000 / $4,000                 │
└────────────────────────────────────────┘
```

### Bounty Creation

```
Which pool does this bounty belong to?
[Sales Pool (Profit Share) ▼]

Reward:
[100] points → ~10% of pool

-- OR for Fixed Budget pool --

Which pool does this bounty belong to?
[Security Bounties (Fixed Budget) ▼]

Reward:
[$] [5000] → $5,000 per approval
```

### Contributor View

```
My Earnings - Oath

┌─ Sales Pool (Profit Share) ────────────┐
│ 150 pts • 15% of pool                  │
│ Lifetime: $1,200                       │
│ Next payout: Jan 15                    │
└────────────────────────────────────────┘

┌─ Content Campaign (Closed) ────────────┐
│ Earned: $600                           │
│ Status: Paid                           │
└────────────────────────────────────────┘
```

---

## Payout Mechanics by Type

### PROFIT_SHARE

```
1. Payout period ends (monthly/quarterly)
2. Founder enters profit for period
3. Pool amount = profit × pool %
4. Each contributor gets: (their pts / capacity) × pool amount
5. Founder pays externally, contributors confirm
```

### FIXED_BUDGET

```
1. Bounty is approved
2. $ amount deducted from pool budget
3. Contributor earns that $ amount
4. Payout can be:
   - Immediate (on approval)
   - Batched (weekly/monthly)
5. When budget exhausted, pool closes
```

### PER_BOUNTY

```
1. Bounty has explicit $ value
2. Contributor submits, founder approves
3. $ paid directly (no pool calculation)
4. Payout can be immediate or batched
```

---

## MVP Scope

### In Scope

- [ ] Multiple pools per project (PROFIT_SHARE type only for MVP)
- [ ] Bounty linked to specific pool
- [ ] Pool lifecycle: ACTIVE → SUNSET → CLOSED
- [ ] Pool management UI for founders (e.g. mirror others like `pool-editor` or `pools` tab)
- [ ] Contributor view of earnings, agnostic of pools

### Out of Scope (Later)

- [ ] FIXED_BUDGET pool type
- [ ] PER_BOUNTY pool type
- [ ] Direct $ pricing on bounties
- [ ] Immediate payout on approval
- [ ] Multi-currency support

---

## Open Questions

1. **Point migration?** Can founders move contributor points from old pool to new?
   - _Recommendation: No, keeps accounting clean_

2. **Default pool?** When creating a bounty, should there be a default pool?
   - _Recommendation: Yes, but if only one active pool, auto-select. If multiple, require selection or choose the default pool and let them change it after if needed._

3. **Mixed pools?** Can a single bounty earn both points AND fixed $?
   - _Recommendation: No, keep it simple. One reward type per bounty._

4. **Budget top-up?** Can founders add more budget to FIXED_BUDGET pools?
   - _Recommendation: Yes, with audit trail._

5. **Payout timing for FIXED_BUDGET?** When do contributors get paid?
   - _Recommendation: Same as pool's payout frequency (e.g. daily/weekly/monthly/quarterly). Keeps it simple and consistent._

---

## Future Considerations

These are not MVP but worth considering for architectural planning later

### Additional Pool Types

| Type           | Concept                                                             |
| -------------- | ------------------------------------------------------------------- |
| **MILESTONE**  | Payments unlock at project phases or KPI milestones                 |
| **OUTCOME**    | Pay % of measured result (MRR increase, leads converted)            |
| **TOURNAMENT** | Ranked payouts to top N submissions (design contests, competitions) |
| **TIERED**     | Payment scales with volume (first 10 = $50, next 40 = $75, etc.)    |

### Marketplace Dynamics

**Price discovery via bidding:**

- Bounties could have a "floor price" that rises over time until someone claims
- Or contributors bid on work, lowest qualified bid wins
- Creates a bid/ask market for work over time

**Why this matters:**

- Efficient price discovery without founder guessing
- Market determines fair value for work
- Natural fit as volume scales

### AI Agents

AI agents should work like any other contributor:

- Claim bounties, submit work, earn points
- No special "AI pool type" needed
- They just work faster and at higher volume and that will drive payouts per task lower most likely
- Same verification, same payouts

The platform should be agent-agnostic—good work is good work regardless of who (or what) does it.

---

## Migration Path

### From Current Model

1. Create `poolType` field on RewardPool (default: "PROFIT_SHARE")
2. Add `poolId` to Bounty (nullable, foreign key to RewardPool)
3. Migrate existing bounties to link to project's default pool
4. Update payout logic to handle pool-specific calculations
5. Move pools to a new tab on project page instead of in project settings

### Supporting Multiple Pools

1. Remove unique constraint on RewardPool.projectId
2. Add pool selector to bounty creation
3. Update contributor dashboard to be agnostic to pools and be just about payouts (fine to have an audit link to a pool similar to how one-time invoices work, but keep dashboard simple)
4. Update payout flow to run per-pool
