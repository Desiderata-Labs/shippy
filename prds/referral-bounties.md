# Referral Bounties PRD

## Overview

Referral tracking for PERFORMANCE bounties. Contributors get unique referral links, earn points per verified signup.

> **Parent PRD**: See `prds/performance-bounties.md` for generic PERFORMANCE mode details (points per result, caps, verification flow, etc.)

---

## Why Shippy's Model Is Powerful

Traditional affiliate platforms pay one-time or recurring % of payments (complex tracking).

**Shippy's model:**

- Each referral = M points
- Points = permanent % of reward pool
- Pool pays out forever

No per-referral payment tracking needed. Referrers align with long-term project success.

---

## Referral-Specific Data Model

Extends the generic `PerformanceResult` with referral tracking:

```prisma
model ReferralLink {
  id        String   @id @default(dbgenerated("nanoid()"))
  bountyId  String
  bounty    Bounty   @relation(fields: [bountyId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  code      String   @unique  // e.g., "jane123"
  createdAt DateTime @default(now())

  @@unique([bountyId, userId])
}
```

When a user signs up via `?ref=code`:

1. Look up `ReferralLink` by code
2. Create `PerformanceResult` linking referrer → referred user
3. Await verification (or auto-verify)

---

## Referral-Specific UI

### Contributor View

```
┌─────────────────────────────────────────────────┐
│ Refer new users to Shippy                       │
│ Earn 10 pts per verified signup                 │
├─────────────────────────────────────────────────┤
│ Your referral link:                             │
│ [shippy.sh/sign-up?ref=jane123] [Copy]          │
│                                                 │
│ Your Stats:                                     │
│   12 referrals • 8 verified • 80 pts earned     │
│   4 pending verification                        │
└─────────────────────────────────────────────────┘
```

### Founder View

```
┌─────────────────────────────────────────────────┐
│ Pending Referrals (4)                           │
├─────────────────────────────────────────────────┤
│ @newuser1 referred by @jane • 2h ago [✓] [✗]    │
│ @newuser2 referred by @mike • 5h ago [✓] [✗]    │
└─────────────────────────────────────────────────┘
```

---

## MVP Scope

### In Scope

- [ ] Referral link generation (code per contributor per bounty)
- [ ] `?ref=` tracking at signup
- [ ] Manual verification by founder
- [ ] Basic stats (referrals, verified, points)

### Out of Scope (Later)

- [ ] Automatic verification (on signup, or after N days)
- [ ] Multi-tier rewards (signup = 10 pts, conversion = 50 pts)
- [ ] Two-sided rewards (bonus for referred user)
- [ ] Coupon codes (alternative to links)
- [ ] Fraud detection (self-referral, duplicate accounts)

---

## Open Questions

### 1. Link Format

- Query param: `shippy.sh/sign-up?ref=jane123` (simpler)
- Path-based: `shippy.sh/r/jane123` (cleaner sharing)

**Recommendation:** Query param for MVP.

### 2. Attribution Conflicts

Multiple links clicked before signup?

**Recommendation:** Last click wins (industry standard).

### 3. Self-Referral Prevention

**Recommendation:** Block. Check email patterns, IP, device fingerprint (later).

---

## Example Configurations

```
Bounty: "Refer new users to Shippy"
Mode: PERFORMANCE
Points: 10 pts per verified signup
Cap: 500 pts total
```

```
Bounty: "Refer clinics to Oath"
Mode: PERFORMANCE
Points: 100 pts per clinic that starts trial
Verification: Manual
```

```
Bounty: "Drive signups from your audience"
Mode: PERFORMANCE
Points: 5 pts per verified signup
Cap: 200 pts per contributor
```
