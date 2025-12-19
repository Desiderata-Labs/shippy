# Performance Bounties PRD

> **⚠️ On Hold**: The use cases here (referrals, leads, conversions) are being implemented via `prds/reward-codes.md` using MULTIPLE mode + external API. A separate PERFORMANCE mode may not be needed—revisit after reward codes ship.

## Overview

A new claim mode where contributors earn points per verified result, not per task completion. Enables referral programs, lead generation, sales commissions, and other performance-based incentives.

---

## The Model

| Claim Mode      | Who                 | Reward                     |
| --------------- | ------------------- | -------------------------- |
| SINGLE          | 1 person            | Fixed points, one-time     |
| COMPETITIVE     | Many, first wins    | Fixed points, one winner   |
| MULTIPLE        | Many (optional cap) | Fixed points, all approved |
| **PERFORMANCE** | Unlimited           | Points per verified result |

---

## How It Works

1. **Founder creates PERFORMANCE bounty** with points-per-result
2. **Contributors join** (no exclusive claim—anyone can participate)
3. **Results are tracked** (referrals, leads, sales, etc.)
4. **Founder verifies** (or automatic verification later)
5. **Points awarded per result** → permanent pool share

---

## Use Cases

| Use Case         | Result Type              | Example                             |
| ---------------- | ------------------------ | ----------------------------------- |
| **Referrals**    | User signup via link     | 10 pts per verified signup          |
| **Lead gen**     | Qualified lead submitted | 25 pts per lead that converts       |
| **Sales**        | Customer conversion      | 100 pts per paying customer         |
| **Traffic**      | Visits/signups driven    | 5 pts per signup from your audience |
| **Integrations** | Usage of integration     | 1 pt per 1000 API calls             |

Each use case may have its own tracking mechanism (referral links, lead forms, webhooks) but shares the same PERFORMANCE mode.

---

## Data Model

### Bounty Changes

```prisma
model Bounty {
  // Existing fields...
  claimMode       String   // "SINGLE" | "COMPETITIVE" | "MULTIPLE" | "PERFORMANCE"

  // Performance-specific
  pointsPerResult Int?     // Points per verified result
  resultCap       Int?     // Max points per contributor (optional)
  totalResultCap  Int?     // Max total points for bounty (optional)
  resultType      String?  // "REFERRAL" | "LEAD" | "SALE" | "CUSTOM" (later)
}
```

### Result Tracking (generic)

```prisma
model PerformanceResult {
  id          String   @id @default(dbgenerated("nanoid()"))
  bountyId    String
  bounty      Bounty   @relation(fields: [bountyId], references: [id])
  userId      String   // Contributor who earned this result
  user        User     @relation(fields: [userId], references: [id])

  // Result details
  resultType  String   // Matches bounty's resultType
  resultRef   String?  // External reference (user ID, lead ID, etc.)
  metadata    Json?    // Additional data depending on type

  // Verification
  status        String    // "PENDING" | "VERIFIED" | "REJECTED"
  pointsAwarded Int?
  verifiedAt    DateTime?
  verifiedBy    String?   // Founder ID (null if automatic)

  createdAt   DateTime @default(now())

  @@unique([bountyId, userId, resultRef]) // One result per unique reference
}
```

For referral-specific tracking, see `prds/referral-bounties.md`.

---

## UI

### Bounty Editor (Founder)

When PERFORMANCE selected:

- Show "Points per result" field
- Show optional caps (per contributor, total)
- Hide claim expiry (not applicable)
- Show result type selector (MVP: just "Referral")

### Bounty Detail (Contributor)

```
┌─────────────────────────────────────────────────┐
│ [Bounty Title]                                  │
│ Earn [X] pts per [result type]                  │
├─────────────────────────────────────────────────┤
│ [Join to Start Earning]                         │
│                                                 │
│ Your Stats:                                     │
│   12 results • 8 verified • 80 pts earned       │
└─────────────────────────────────────────────────┘
```

### Founder Review

```
┌─────────────────────────────────────────────────┐
│ Pending Results (4)                             │
├─────────────────────────────────────────────────┤
│ [Result details] by @jane • 2h ago  [✓] [✗]     │
│ [Result details] by @mike • 5h ago  [✓] [✗]     │
└─────────────────────────────────────────────────┘
```

---

## Key Behaviors

### Lifecycle

- PERFORMANCE bounties never auto-complete
- Run until founder closes or cap is reached
- No claim expiry (contributors stay "joined" indefinitely)

### Caps

- **Per-contributor cap**: Prevent one person dominating
- **Total cap**: Limit pool dilution
- When cap reached, bounty stops accepting new results

### Verification

- **MVP**: Manual verification by founder
- **Later**: Automatic based on result type (signup confirmed, payment received, etc.)

---

## MVP Scope

### In Scope

- [ ] PERFORMANCE claim mode
- [ ] `pointsPerResult` field
- [ ] Generic result tracking (`PerformanceResult` table)
- [ ] Manual verification UI
- [ ] Basic stats (results, verified, points)

### Out of Scope (Later)

- [ ] Per-contributor and total caps
- [ ] Automatic verification
- [ ] Multiple result types per bounty
- [ ] Webhooks for external result submission

---

## Relationship to Other PRDs

### Claim Mode Refactor (claim-mode-refactor.md)

PERFORMANCE is one of four claim modes added in the refactor.

### Referral Bounties (referral-bounties.md)

Referrals are a specific configuration of PERFORMANCE bounties with:

- Referral link generation
- Signup tracking
- Attribution logic

### Payouts (payouts.md)

PERFORMANCE bounties belong to a pool. When pool sunsets, bounty closes.
