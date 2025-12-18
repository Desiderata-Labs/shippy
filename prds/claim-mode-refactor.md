# Claim Mode Refactor PRD

## Overview

Rename the existing MULTIPLE claim mode to COMPETITIVE, and introduce new claim modes to support different collaboration patterns.

---

## Current State

| Mode         | Behavior                                |
| ------------ | --------------------------------------- |
| **SINGLE**   | One person claims, others locked out    |
| **MULTIPLE** | Multiple can claim, first approved wins |

The name "MULTIPLE" is confusing because:

- It sounds like multiple people can complete it (they can't—only one gets rewarded)
- It doesn't describe the competitive nature
- We want to use "MULTIPLE" for actual multi-person bounties

---

## Proposed State

| Mode            | Claims              | Reward                     | Best For                        |
| --------------- | ------------------- | -------------------------- | ------------------------------- |
| **SINGLE**      | 1 person            | Fixed points, one-time     | Exclusive tasks, sensitive work |
| **COMPETITIVE** | Many, first wins    | Fixed points, one winner   | Races, contests                 |
| **MULTIPLE**    | Many (optional cap) | Fixed points, all approved | Influencer, content, parallel   |
| **PERFORMANCE** | Unlimited           | Points per verified result | Referrals, leads, sales         |

---

## Changes

### 1. Rename MULTIPLE → COMPETITIVE

**Database migration:**

```sql
UPDATE "Bounty" SET "claimMode" = 'COMPETITIVE' WHERE "claimMode" = 'MULTIPLE';
```

**Code changes:**

- Update `BountyClaimMode` enum
- Update all references in code
- Update UI labels

### 2. Add MULTIPLE Mode

For bounties where multiple people can complete and all get rewarded:

```
Bounty: "Create social media content for our launch"
Mode: MULTIPLE
Points: 50 pts per approved submission
Max completions: 10 (optional, default unlimited)
```

Behavior:

- Anyone can claim (up to optional limit)
- Each approved submission gets the full points
- Bounty closes when max completions reached (or manually)

Use cases:

- Influencer campaigns (post about us → get points)
- Content creation (write articles → each gets points)
- Parallel work (multiple designers submit concepts)

### 3. Add PERFORMANCE Mode

For bounties where points are awarded per verified result (referrals, leads, sales, etc.):

```
Bounty: "Refer new users"
Mode: PERFORMANCE
Points: 10 pts per verified signup
```

See `prds/referral-bounties.md` for detailed referral use case.

---

## Migration Plan

### Phase 1: Rename (Breaking Change)

1. Create migration to rename MULTIPLE → COMPETITIVE in DB
2. Update `BountyClaimMode` enum in code
3. Update all code references
4. Update UI labels and descriptions

### Phase 2: Add MULTIPLE (new behavior)

1. Add MULTIPLE to enum (reusing the name with new meaning)
2. Update bounty service logic for "all approved get points"
3. Add optional `maxCompletions` field
4. Add UI for configuring multiple-completion bounties

### Phase 3: Add PERFORMANCE

1. Add PERFORMANCE to enum
2. Add performance-tracking tables (referrals, leads, etc.)
3. Add result verification workflow
4. Add tracking and attribution (referral links, lead forms, etc.)

---

## UI Changes

### Bounty Editor

Current:

```
Claim Mode: [Single ▼]
  - Single (one contributor)
  - Multiple (competitive)
```

Proposed:

```
Claim Mode: [Single ▼]
  - Single — One contributor claims exclusively
  - Competitive — Multiple can claim, first approved wins
  - Multiple — Multiple can complete, all get rewarded
  - Performance — Points per verified result (referrals, leads, etc.)
```

When "Multiple" is selected, show optional limit field:

```
Max completions: [10] (leave empty for unlimited)
```

### Bounty Display

Show claim mode context to contributors:

- **Single**: "1 spot available" or "Claimed by @jane"
- **Competitive**: "5 working on this • First approved wins"
- **Multiple**: "3 of 10 completed" or "3 completed" (if unlimited)
- **Performance**: "47 contributors • 1,234 results verified"

---

## MVP Scope

### In Scope

- [ ] Rename MULTIPLE → COMPETITIVE (DB + code + UI)
- [ ] Add MULTIPLE mode with new behavior (all approved get points)
- [ ] Add optional `maxCompletions` limit for MULTIPLE mode
- [ ] Add PERFORMANCE mode (see referral-bounties.md for referral use case)

### Out of Scope (Later)

- [ ] Advanced claim limits per mode
- [ ] `inviteOnly` flag on Bounty (gates any mode to invited contributors only)

---

## Implementation Tasks

### Rename MULTIPLE → COMPETITIVE

1. [ ] Create migration: `rename_multiple_to_competitive`
2. [ ] Update `BountyClaimMode` enum in `src/lib/db/types.ts`
3. [ ] Update `prisma/schema.prisma` default value
4. [ ] Search/replace all code references:
   - `BountyClaimMode.MULTIPLE` → `BountyClaimMode.COMPETITIVE`
   - String literals "MULTIPLE" → "COMPETITIVE"
5. [ ] Update MCP route descriptions
6. [ ] Update bounty editor UI labels
7. [ ] Update bounty display UI

### Add MULTIPLE Mode (new behavior)

1. [ ] Add `MULTIPLE` to `BountyClaimMode` enum
2. [ ] Add `maxCompletions` field to Bounty model (nullable Int)
3. [ ] Update bounty service: allow multiple approved submissions
4. [ ] Update bounty status logic: COMPLETED when maxCompletions reached
5. [ ] Update claim logic: allow claims up to maxCompletions (or unlimited)
6. [ ] Update bounty editor UI: show maxCompletions field when MULTIPLE selected
7. [ ] Update bounty display: show completion count

---

## Backwards Compatibility

- Existing MULTIPLE bounties become COMPETITIVE (same behavior, better name)
- The name "MULTIPLE" is then reused for the new "all approved get points" behavior
- API accepts both "MULTIPLE" and "COMPETITIVE" during transition period (optional)
- MCP tools updated to show new mode names

---

## Future: Invite-Only Gating

Orthogonal to claim mode, bounties could have an `inviteOnly` boolean:

```prisma
model Bounty {
  // ...
  inviteOnly  Boolean @default(false)
}
```

When `true`, only contributors explicitly invited can claim/join, regardless of mode:

| Mode + Invite Only   | Behavior                                     |
| -------------------- | -------------------------------------------- |
| SINGLE + invite      | Invited contributor claims exclusively       |
| MULTIPLE + invite    | Only invited contributors can complete       |
| PERFORMANCE + invite | Only invited contributors get referral links |

This enables private bounties, VIP affiliate programs, etc.

---

## Naming Summary

| Old Name | New Name        | Behavior                        |
| -------- | --------------- | ------------------------------- |
| SINGLE   | SINGLE          | No change                       |
| MULTIPLE | **COMPETITIVE** | Same behavior, renamed          |
| (new)    | **MULTIPLE**    | New: all approved get points    |
| (new)    | **PERFORMANCE** | New: points per verified result |
