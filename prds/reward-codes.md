# Reward Codes PRD

## Overview

Trackable affiliate-style links for MULTIPLE bounties. Contributors claim a bounty and get a unique link. Clicks are tracked, and founders log conversions via API.

---

## Why This Exists

Founders want to reward contributors for driving external results (signups, sales, leads, content reach). Contributors need shareable, trackable links. Founders need an API to log when conversions happen.

**Shippy's model makes this powerful:**

- Each conversion = submission = points
- Points = permanent % of reward pool
- No per-conversion payment tracking needed
- Contributors align with long-term project success

**Similar to:** Rewardful, PartnerStack, Dub.co

---

## The Flow

```
1. Founder creates MULTIPLE bounty
   └─ "Refer customers to Oath" • 25 pts per signup
   └─ Sets destinationUrl: "https://oath.med/signup"

2. Contributor claims bounty
   └─ Reward code auto-generated: "ABC123"
   └─ Their link: shippy.sh/r/ABC123

3. Contributor shares link
   └─ LinkedIn post, TikTok bio, podcast mention, etc.

4. Someone clicks the link
   └─ shippy.sh/r/ABC123 → 302 redirect
   └─ Destination: oath.med/signup?ref=ABC123&utm_source=shippy&utm_medium=affiliate
   └─ Click recorded for analytics

5. Person converts on founder's site
   └─ Founder's backend sees ?ref=ABC123
   └─ Calls: POST shippy.sh/api/projects/oath/rewards { code: "ABC123" }

6. Submission created for contributor
   └─ Founder reviews/approves (or auto-approve)

7. Points awarded via normal flow
```

---

## Data Model

### BountyClaim (extended)

Add reward code directly to claims—no separate table needed.

```prisma
model BountyClaim {
  // existing fields...

  rewardCode String? @unique  // Auto-generated at claim time, e.g., "ABC123"

  clicks Click[]

  @@index([rewardCode])
}
```

### Bounty (extended)

Add destination URL for reward links.

```prisma
model Bounty {
  // existing fields...

  destinationUrl String?  // Where reward links redirect to
}
```

### Click

Track link clicks for analytics.

```prisma
model Click {
  id        String      @id @default(dbgenerated("nanoid()"))
  claimId   String
  claim     BountyClaim @relation(fields: [claimId], references: [id], onDelete: Cascade)

  // Analytics (optional, privacy-conscious)
  ipHash    String?   // Hashed IP for dedup, not stored raw
  userAgent String?
  referer   String?
  country   String?   // Derived from IP, then IP discarded

  createdAt DateTime @default(now()) @db.Timestamptz(3)

  @@index([claimId])
  @@index([createdAt])
  @@map("click")
}
```

### ProjectApiKey

Server-to-server authentication for founders to call the rewards API.

```prisma
model ProjectApiKey {
  id        String  @id @default(dbgenerated("nanoid()"))
  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  keyHash String @unique  // SHA-256 hash of the key
  name    String          // "Production", "Staging", etc.
  prefix  String          // First 8 chars for display: "sh_proj_abc1..."

  lastUsedAt DateTime? @db.Timestamptz(3)
  createdAt  DateTime  @default(now()) @db.Timestamptz(3)

  @@index([projectId])
  @@map("project_api_key")
}
```

---

## Link Format

### Default: Code as Link

```
shippy.sh/r/ABC123
```

- Clean, memorable
- Reward code IS the short link
- Redirects to bounty's `destinationUrl` with attribution params appended

### Redirect Behavior

```
GET shippy.sh/r/ABC123

1. Look up BountyClaim by rewardCode
2. Get bounty.destinationUrl (e.g., "https://oath.med/signup")
3. Record Click (async, non-blocking)
4. 302 redirect to: oath.med/signup?ref=ABC123&utm_source=shippy&utm_medium=affiliate
```

### Attribution Parameters

The redirect appends standard affiliate tracking parameters:

| Param        | Value       | Purpose                                        |
| ------------ | ----------- | ---------------------------------------------- |
| `ref`        | `{code}`    | Contributor's reward code (for conversion API) |
| `utm_source` | `shippy`    | Identifies Shippy as the traffic source        |
| `utm_medium` | `affiliate` | Channel type for analytics segmentation        |

This lets founders:

- See "shippy" as a source in GA/Mixpanel
- Filter affiliate traffic from organic/paid
- Capture the `ref` code in signup forms for conversion tracking

### Future: Custom Short Links

Founders can build their own branded short link layer on top of Shippy's reward codes:

```
go.oath.med/jane → oath.med/signup?ref=ABC123&utm_source=shippy&utm_medium=affiliate
```

**How it works:**

1. Founder creates a simple redirect service on their domain (e.g., `go.oath.med`)
2. Maps friendly slugs to reward codes: `jane` → `ABC123`
3. Redirects to destination with the `ref` param

**Example (Next.js API route):**

```typescript
// go.oath.med/[slug]/route.ts
const slugToCode: Record<string, string> = {
  jane: 'ABC123',
  mike: 'DEF456',
}

export async function GET(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const code = slugToCode[params.slug]
  if (!code) return new Response('Not found', { status: 404 })

  const dest = `https://oath.med/signup?ref=${code}&utm_source=shippy&utm_medium=affiliate`
  return Response.redirect(dest, 302)
}
```

This gives founders:

- Branded, memorable links (`go.oath.med/jane` vs `shippy.sh/r/ABC123`)
- Custom slugs per contributor
- Full control over their redirect logic

Shippy doesn't need to support custom domains directly—founders just need the `ref` code to log conversions via API.

---

## API

### Link Redirect (Public)

```
GET /r/:code

→ 302 redirect to destinationUrl?ref={code}&utm_source=shippy&utm_medium=affiliate
→ Records click asynchronously
```

If no destination URL is set on the bounty, returns 404 or redirects to bounty page.

### Contributor API (MCP / tRPC)

**Get my reward link (auto-generated at claim time):**

```typescript
// Returns existing reward code for this bounty
claim.getRewardLink({ bountyId: "..." })
→ {
    code: "ABC123",
    link: "https://shippy.sh/r/ABC123",
    destinationUrl: "https://oath.med/signup",
    stats: {
      clicks: 142,
      conversions: 12,
      approved: 8,
      pending: 3,
      rejected: 1,
      pointsEarned: 200
    }
  }
```

### Founder API (Server-to-Server)

**Log a conversion:**

```
POST /api/projects/:slug/rewards
Authorization: Bearer sk_live_xxxxxxxxxxxx

{
  "code": "ABC123",
  "externalId": "cust_123",        // Optional: your customer/order ID (for idempotency)
  "metadata": {                     // Optional: additional context
    "email": "customer@example.com",
    "plan": "pro",
    "value": 99.00
  }
}

→ 201 Created
{
  "submissionId": "xyz789",
  "contributorId": "user_456",
  "contributorUsername": "jane",
  "status": "PENDING"
}
```

**Idempotency:**

If `externalId` is provided, calling again with the same code + externalId returns the existing submission instead of creating a duplicate.

**API Key Management:**

```
POST   /api/projects/:slug/api-keys          // Create key (returns raw key once)
DELETE /api/projects/:slug/api-keys/:id      // Revoke key
GET    /api/projects/:slug/api-keys          // List keys (shows prefix only)
```

---

## Submission Auto-Creation

When the rewards API is called, a submission is created:

```typescript
{
  bountyId: claim.bountyId,
  userId: claim.userId,
  description: `Conversion logged via reward link.

**Code:** ABC123
**External ID:** cust_123
**Metadata:**
- email: customer@example.com
- plan: pro
- value: $99.00

*Submitted automatically via API*`,
  status: "PENDING"  // or "APPROVED" if auto-approve enabled
}
```

---

## UI

### Contributor View (Bounty Detail)

When viewing a MULTIPLE bounty they've claimed:

```
┌─────────────────────────────────────────────────┐
│ Refer customers to Oath                         │
│ Earn 25 pts per verified signup                 │
├─────────────────────────────────────────────────┤
│ Your Reward Link                                │
│ ┌─────────────────────────────────────────────┐ │
│ │ shippy.sh/r/ABC123                  [Copy]  │ │
│ └─────────────────────────────────────────────┘ │
│ Redirects to: oath.med/signup                │
│                                                 │
│ Your Stats                                      │
│   142 clicks • 12 conversions • 200 pts earned  │
│   3 pending review                              │
└─────────────────────────────────────────────────┘
```

### Founder View (Bounty Editor)

When editing a MULTIPLE bounty:

```
┌─────────────────────────────────────────────────┐
│ Reward Link Settings                            │
├─────────────────────────────────────────────────┤
│ Destination URL                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ https://oath.med/signup                  │ │
│ └─────────────────────────────────────────────┘ │
│ Contributors' links will redirect here with     │
│ ?ref=CODE appended for tracking.                │
│                                                 │
│ ☐ Auto-approve conversions (skip manual review) │
└─────────────────────────────────────────────────┘
```

### Founder View (Project Settings)

**API Keys section:**

```
┌─────────────────────────────────────────────────┐
│ API Keys                                        │
│ Use these to log conversions from your backend  │
├─────────────────────────────────────────────────┤
│ Production    sk_live_abc1...    Created Dec 15 │
│               Last used: 2 hours ago   [Revoke] │
│                                                 │
│ [+ Create API Key]                              │
└─────────────────────────────────────────────────┘
```

---

## Security

### API Key Security

- Keys are hashed (SHA-256) before storage
- Raw key shown only once at creation
- Keys scoped to project (can only log rewards for that project's bounties)
- Rate limiting: 100 requests/minute per key

### Click Tracking Privacy

- IP addresses are hashed, not stored raw
- Country derived from IP, then IP discarded
- User agent stored for bot detection
- No cookies or cross-site tracking

### Fraud Prevention

- Founders review submissions (unless auto-approve)
- `externalId` enables idempotency (prevents duplicate submissions)
- Click-to-conversion ratio visible for anomaly detection
- Metadata provides context for verification
- Future: velocity checks, pattern detection

---

## Example: Oath Bounties

| Bounty                  | Destination URL       | How It Works                                                           |
| ----------------------- | --------------------- | ---------------------------------------------------------------------- |
| OTH-17: Refer paid user | `oath.med/signup`     | Link tracks signup, founder logs conversion when user upgrades to paid |
| OTH-18: Refer practice  | `oath.med/enterprise` | Same flow, higher points for enterprise leads                          |
| OTH-13: LinkedIn share  | `oath.med`            | Link in post tracked, contributor submits with screenshot + view count |
| OTH-14: TikTok/Reels    | `oath.med`            | Link in bio tracked, contributor submits with video link + metrics     |
| OTH-15: Podcast mention | `oath.med/podcast`    | Custom landing page, contributor submits with episode link             |

---

## MVP Scope

### In Scope

**Database:**

- [ ] Add `rewardCode` field to `BountyClaim`
- [ ] Add `destinationUrl` field to `Bounty`
- [ ] Create `Click` model
- [ ] Create `ProjectApiKey` model
- [ ] Migration

**Backend:**

- [ ] `GET /r/:code` — redirect endpoint with click tracking
- [ ] `POST /api/projects/:slug/rewards` — log conversion
- [ ] `POST /api/projects/:slug/api-keys` — create key
- [ ] `DELETE /api/projects/:slug/api-keys/:id` — revoke key
- [ ] tRPC: `claim.getRewardLink({ bountyId })`
- [ ] MCP: expose reward link endpoints
- [ ] Auto-generate `rewardCode` when claiming MULTIPLE bounties with `destinationUrl`

**Frontend:**

- [ ] Bounty editor: destination URL field for MULTIPLE bounties
- [ ] Bounty detail: show reward link + stats for contributors
- [ ] Project settings: API key management

### Out of Scope (Later)

- [ ] Auto-approve setting per bounty
- [ ] Custom short codes (let contributors pick their code)
- [ ] Custom domains (CNAME support)
- [ ] Click analytics dashboard
- [ ] Webhook notifications when conversions logged
- [ ] Bulk import conversions (CSV)
- [ ] Bot detection / click fraud prevention

---

## Do We Need PERFORMANCE Mode?

**No, not for MVP.**

The reward code system works with MULTIPLE mode:

- `allowsMultipleSubmissionsPerUser(MULTIPLE)` → `true` ✅
- Each conversion = submission with points ✅
- Bounty stays open until `maxClaims` reached or manually closed ✅

PERFORMANCE mode was designed for "points per result" but that's exactly what MULTIPLE + reward links achieves. Keep PERFORMANCE commented out until there's a clear need for differentiation.

---

## Example Integration

### Founder's Backend (Node.js)

```typescript
// When a customer converts (signup, purchase, etc.)
async function onCustomerConversion(customer: Customer) {
  // The ?ref= param was captured at signup
  if (!customer.referralCode) return

  await fetch('https://shippy.sh/api/projects/oath/rewards', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SHIPPY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: customer.referralCode,
      externalId: customer.id,
      metadata: {
        email: customer.email,
        plan: customer.plan,
        value: customer.mrr,
      },
    }),
  })
}
```

### Founder's Backend (curl)

```bash
curl -X POST https://shippy.sh/api/projects/oath/rewards \
  -H "Authorization: Bearer sk_live_xxxxxxxxxxxx" \
  -H "Content-Type: "application/json" \
  -d '{
    "code": "ABC123",
    "externalId": "cust_123",
    "metadata": {
      "email": "customer@example.com",
      "plan": "pro"
    }
  }'
```
