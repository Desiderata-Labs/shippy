# Pool Versioning PRD

## Overview

Enable projects to have multiple reward pools with different terms, or to sunset an existing pool and replace it with a new one.

---

## The Problem

Currently, each project has one reward pool with fixed terms:

- Pool percentage (e.g., 10% of profit)
- Payout frequency (monthly/quarterly)
- Pool capacity (default 1,000 points)

Founders need flexibility to:

1. **Sunset a pool** — End current terms, start fresh with new terms
2. **Run parallel pools** — Different incentive structures for different contributor types
3. **Migrate contributors** — Transition existing contributors to new terms gracefully

---

## Use Cases

### 1. Terms Evolution

> "We started with 5% of revenue. Now we're profitable and want to switch to 10% of profit. But existing contributors earned under the old terms."

### 2. Different Contributor Types

> "We want salespeople on 15% rev-share but content creators on 5% rev-share."

### 3. Acquisition/Pivot

> "We're pivoting the product. Old contributors should keep earning on legacy, new contributors join the new pool."

---

## Proposed Solution

### Model: Pool Versions

Instead of a single embedded pool, projects have multiple `RewardPool` records:

```prisma
model RewardPool {
  id              String   @id @default(dbgenerated("nanoid()"))

  projectId       String
  project         Project  @relation(fields: [projectId], references: [id])

  // Pool terms
  name            String   // "Growth Pool 2024", "Sales Pool", etc.
  poolPercentage  Int      // % of profit/revenue
  profitBasis     String   // "NET_PROFIT" | "GROSS_REVENUE"
  payoutFrequency String   // "MONTHLY" | "QUARTERLY"
  capacity        Int      @default(1000) // Point capacity

  // Lifecycle
  status          String   // "ACTIVE" | "SUNSET" | "CLOSED"
  startsAt        DateTime @default(now())
  endsAt          DateTime? // When pool stops accepting new work

  // Commitment
  commitmentMonths Int     // Minimum pool duration
  commitmentEndsAt DateTime // Calculated from creation + commitment

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  bounties        Bounty[]
  payouts         Payout[]
}
```

### Pool Lifecycle

```
ACTIVE → SUNSET → CLOSED
```

| Status     | New Bounties | New Claims | Payouts | Points Earning |
| ---------- | ------------ | ---------- | ------- | -------------- |
| **ACTIVE** | ✅           | ✅         | ✅      | ✅             |
| **SUNSET** | ❌           | ❌         | ✅      | ✅ (existing)  |
| **CLOSED** | ❌           | ❌         | ❌      | ❌             |

### Key Behaviors

#### 1. Sunsetting a Pool

- No new bounties can be created
- Existing claimed bounties can still be completed
- Payouts continue until commitment ends
- Contributors keep earning on approved work

#### 2. Creating a Replacement Pool

- New pool becomes ACTIVE
- Founder can choose which pool new bounties belong to (if multiple active)
- Or: only one ACTIVE pool at a time (simpler)

#### 3. Contributor View

- Contributors see all pools they have points in
- Each pool shows: points held, % of pool, payout history
- Clear labeling: "Growth Pool 2024 (Sunset - payouts until June 2025)"

---

## UI Changes

### Project Settings (Founder)

```
Reward Pools
─────────────────────────────────────────
[+] Create New Pool

┌─ Growth Pool 2024 ─────────────────────┐
│ Status: ACTIVE                         │
│ Terms: 10% of net profit, monthly      │
│ Capacity: 450 / 1,000 pts allocated    │
│ Commitment: Through Dec 2025           │
│                                        │
│ [Sunset Pool] [Edit]                   │
└────────────────────────────────────────┘

┌─ Launch Pool (Legacy) ─────────────────┐
│ Status: SUNSET                         │
│ Terms: 5% of gross revenue, quarterly  │
│ Capacity: 800 / 1,000 pts allocated    │
│ Final payout: March 2025               │
│                                        │
│ Contributors still earning from this   │
└────────────────────────────────────────┘
```

### Bounty Creation

If multiple active pools:

```
Which pool does this bounty belong to?
[Growth Pool 2024 ▼]
```

### Contributor Dashboard

```
My Points

┌─ Shippy ───────────────────────────────┐
│ Growth Pool 2024 (Active)              │
│   150 pts • 15% of pool                │
│   Earned: $1,200                       │
│                                        │
│ Launch Pool (Sunset)                   │
│   80 pts • 8% of pool                  │
│   Earned: $450 • Final payout: Mar 25 │
└────────────────────────────────────────┘
```

### Project Page (Public)

Show active pool(s) prominently. Sunset pools shown in "legacy" section or hidden.

---

## Migration Path

### From Current Model

Current: Pool terms embedded in `Project`

```prisma
model Project {
  poolPercentage   Int
  profitBasis      String
  payoutFrequency  String
  // ...
}
```

New: Pool terms in `RewardPool`

**Migration:**

1. Create `RewardPool` table
2. For each project, create a RewardPool with current terms
3. Update Bounty to reference `poolId` instead of just `projectId`
4. Update Payout to reference `poolId`

---

## Simpler MVP: Single Active Pool

For MVP, we could simplify:

- **One active pool at a time** per project
- **Sunset = close** (no ongoing payouts after sunset)
- **No migration** of contributors between pools

This covers the main use case: "Start fresh with new terms."

Later, add:

- Multiple concurrent active pools
- Ongoing payouts for sunset pools
- Contributor migration tools

---

## MVP Scope

### In Scope

- [ ] `RewardPool` model (extracted from Project)
- [ ] Pool lifecycle: ACTIVE → CLOSED
- [ ] Sunset pool + create new pool flow
- [ ] Bounties linked to specific pool
- [ ] Contributor view of multiple pools

### Out of Scope (Later)

- [ ] Multiple concurrent ACTIVE pools
- [ ] SUNSET status with ongoing payouts
- [ ] Contributor migration between pools
- [ ] Pool comparison analytics

---

## Open Questions

1. **One active or many?** Should projects have only one ACTIVE pool, or support multiple?
   - _Recommendation: One for MVP, multiple later_

2. **Point migration?** Can founders move contributor points from old pool to new?
   - _Recommendation: No, keeps accounting clean_

3. **Legacy display?** How prominently to show sunset/closed pools?
   - _Recommendation: Collapsed by default, expandable_

4. **Commitment enforcement?** What happens if founder tries to close before commitment ends?
   - _Recommendation: Warn but allow (reputation impact)_
