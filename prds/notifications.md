# Notifications System PRD

## Overview

A simple in-app notification system for Shippy that notifies users about activity relevant to them (starting with comments on bounties and submissions).

---

## MVP Scope

### What Gets Notified

| Event                   | Recipients                                                |
| ----------------------- | --------------------------------------------------------- |
| Comment on a bounty     | Project founder + previous commenters on that bounty      |
| Comment on a submission | Project founder + submission author + previous commenters |

### UI

- **Bell icon** in header (next to avatar)
- **Unread count badge** on the bell
- **Popover** showing recent notifications (newest first)
- **Mark all as read** when popover is opened
- Each notification shows: actor avatar, action description, relative time
- Clicking a notification navigates to the relevant bounty/submission

### Behavior

- Notifications are created server-side when comments are added
- Don't notify the actor (person who commented) about their own comment
- Notifications are never deleted, just marked as read
- Popover shows last ~20 notifications (paginate later if needed)

---

## Out of Scope (MVP)

These are explicitly deferred but the schema design supports them:

| Feature                   | Notes                                           |
| ------------------------- | ----------------------------------------------- |
| Email notifications       | Requires email service integration              |
| Grouped/digest emails     | Batch notifications into daily/weekly summaries |
| Watch a bounty/project    | Opt-in to notifications even if not involved    |
| Slack/Discord integration | Push notifications to external channels         |
| @mentions                 | Parse comment content for @username and notify  |
| Push notifications        | Browser/mobile push                             |
| Agent webhooks            | Dispatch notifications to AI agents via webhook |

> **Note:** `ThreadSubscription` is included in MVP to support future email unsubscribe links.

---

## Data Model

### Notification Table

```prisma
model Notification {
  id            String    @id @default(dbgenerated("nanoid()"))
  userId        String    // Recipient of the notification
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Notification type (extensible for future notification kinds)
  type          String    // NotificationType enum

  // Reference to the entity - allows grouping and navigation
  referenceType String    // "BOUNTY" | "SUBMISSION"
  referenceId   String    // ID of the bounty/submission

  // Who triggered this notification
  actorId       String
  actor         User      @relation("NotificationActor", ...)

  // Read state
  readAt        DateTime? @db.Timestamptz(3)

  createdAt     DateTime  @default(now()) @db.Timestamptz(3)

  @@index([userId, readAt])           // Fetch unread for a user
  @@index([userId, createdAt])        // Fetch recent for a user
  @@index([referenceType, referenceId]) // Group by entity
}
```

### ThreadSubscription Table

Tracks user preferences for specific threads. Added in MVP to support future email unsubscribe.

```prisma
model ThreadSubscription {
  id            String  @id @default(dbgenerated("nanoid()"))
  userId        String
  user          User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  referenceType String  // "BOUNTY" | "SUBMISSION" | "PROJECT"
  referenceId   String

  // Subscription state (only muted used in MVP)
  muted         Boolean @default(false)  // Explicitly opted out
  watching      Boolean @default(false)  // Explicitly opted in (future)

  createdAt     DateTime @default(now()) @db.Timestamptz(3)
  updatedAt     DateTime @updatedAt @db.Timestamptz(3)

  @@unique([userId, referenceType, referenceId])
  @@index([userId])
}
```

### Notification Types (Enum)

```typescript
enum NotificationType {
  BOUNTY_COMMENT = 'BOUNTY_COMMENT',
  SUBMISSION_COMMENT = 'SUBMISSION_COMMENT',
  // Future: SUBMISSION_APPROVED, SUBMISSION_REJECTED, PAYOUT_SENT, etc.
}

enum NotificationReferenceType {
  BOUNTY = 'BOUNTY',
  SUBMISSION = 'SUBMISSION',
  // Future: PROJECT, PAYOUT, etc.
}
```

---

## Recipient Logic

### Who Gets Notified

When a comment is created, we build a recipient list:

```
recipients = Set()

# 1. Always include founder
recipients.add(project.founderId)

# 2. Add previous commenters (thread participants)
for event in previous_comment_events:
    recipients.add(event.userId)

# 3. For submissions: always include the submission author
if referenceType == SUBMISSION:
    recipients.add(submission.userId)

# 4. Future: Add @mentioned users (parsed from comment content)
# for username in parse_mentions(comment.content):
#     recipients.add(resolve_user(username))

# 5. Remove the actor (don't notify yourself)
recipients.remove(actor.id)

# 6. Filter out muted users
for userId in recipients:
    if ThreadSubscription.exists(userId, referenceType, referenceId, muted=true):
        recipients.remove(userId)

# Create one Notification per recipient
```

### @Mentions (Future)

How @mentions interact with thread participants:

| Scenario                           | Recipients                                                            |
| ---------------------------------- | --------------------------------------------------------------------- |
| Comment 1 by @rob with @alice      | founder (if not rob) + @alice                                         |
| Comment 2 by @bob (no mentions)    | founder + @rob (commented before), NOT @alice                         |
| Comment 3 by @alice                | founder + @rob + @bob                                                 |
| Comment 4 by @rob with @alice @bob | founder + @alice + @bob (but @bob already in thread, so just 1 notif) |

**Key rules:**

- @mentions are **one-time** for that specific comment
- You become a permanent thread participant only by **commenting**
- Deduplication happens automatically via Set—no double notifications
- If you're already a thread participant, @mention doesn't create a second notification

---

## Agent Support

AI agents (see `prds/ai-agent-integration.md`) need notifications too. The design supports this:

### How It Works

1. **Agents have user accounts** - An agent is just a User with `isAgent = true` (future flag)
2. **Notifications are created normally** - Agent gets `Notification` records like any user
3. **Delivery is separate** - The `Notification` is the record; how we deliver it is configurable

### Future: Agent Webhooks

When we add `NotificationChannel`:

```prisma
model NotificationChannel {
  id              String  @id
  userId          String
  channelType     String  // "EMAIL" | "WEBHOOK" | "SLACK"
  config          Json    // { webhookUrl, slackChannel, etc. }
  enabled         Boolean @default(true)
}
```

Agents register a webhook URL. When notifications are created, a delivery job:

1. Checks user's notification channels
2. For webhooks: POST to the URL with notification payload
3. For email: queue email (future)
4. For Slack: post to channel (future)

This keeps the core `Notification` model simple while enabling flexible delivery.

---

## How the Design Enables Future Work

### Email Notifications

**Add fields to Notification:**

```prisma
emailSentAt   DateTime? // When email was sent (null = not sent yet)
emailStatus   String?   // "PENDING" | "SENT" | "FAILED"
```

A background job queries `WHERE emailSentAt IS NULL AND createdAt > NOW() - 5 minutes` and sends emails.

### Grouped/Digest Emails

Query notifications by `userId` + time window, group by `referenceType/referenceId`, render a digest template.

### Unsubscribe from Thread

Already supported via `ThreadSubscription.muted`. Email footer links to an endpoint that sets `muted = true`.

### Watch a Bounty/Project

Use `ThreadSubscription.watching = true`. When creating notifications, also include users who are watching that entity (even if they haven't commented).

### Slack/Discord/Agent Webhooks

Use `NotificationChannel` table (see Agent Support section above). A delivery job dispatches to configured channels after notifications are created.

### @Mentions

Parse comment content for `@username` patterns, resolve to user IDs, add to recipient Set. Deduplication is automatic—if they're already a thread participant, they get one notification, not two.

---

## API

### tRPC Router: `notification`

```typescript
notification.list // Get recent notifications for current user
notification.unreadCount // Get count of unread notifications
notification.markAllRead // Mark all as read (returns new unread count: 0)
```

### Notification Creation

Happens inside existing mutation handlers:

- `bounty.addComment` → create notifications for founder + previous commenters
- `submission.addComment` → create notifications for founder + submitter + previous commenters

---

## UI Components

### NotificationBell

Location: Header, between GitHub icon and avatar

```
┌─────────────────────────────────────────────┐
│  [Logo]  ...nav...  [GitHub] [🔔3] [Avatar] │
└─────────────────────────────────────────────┘
```

The badge shows unread count. Clicking opens a popover.

### NotificationPopover

```
┌─────────────────────────────────────────────┐
│ Notifications                               │
├─────────────────────────────────────────────┤
│ 🟢 @jane commented on "Close a new clinic"  │
│    "Looks good! Can you add..."  • 2m ago   │
├─────────────────────────────────────────────┤
│    @mike commented on your submission       │
│    "Thanks for the update"       • 1h ago   │
├─────────────────────────────────────────────┤
│    @rob commented on "SEO audit"            │
│    "Great work on this"          • 2d ago   │
└─────────────────────────────────────────────┘
```

- Blue dot (🟢) indicates unread
- Opening popover marks all as read
- Clicking a row navigates to the bounty/submission
- Show up to 20 notifications, with "View all" link later

---

## Implementation Checklist

### Schema & Types

1. [x] Add `Notification` model to Prisma schema
2. [x] Add `ThreadSubscription` model to Prisma schema
3. [x] Create migration (`20251215183233_notifications`)
4. [x] Add notification enums to `src/lib/db/types.ts`

### Backend

5. [x] Create `src/server/routers/notification.ts` with list/unreadCount/markAllRead
6. [x] Register router in `_app.ts`
7. [x] Create notification helper (builds recipient list, checks muted, creates records)
8. [x] Update `bounty.addComment` to create notifications
9. [x] Update `submission.addComment` to create notifications

### Frontend

10. [x] Create `NotificationPopover` component
11. [x] Add notification bell to `Header` component
12. [x] Style and test
