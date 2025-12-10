# Earn A Slice MVP - Development Todo

## Overview

Building the MVP for Earn A Slice - a platform where contributors earn ongoing royalties for helping startups grow.

**Core Loop**: Bounty → Claim → Submit → Approve → Points → Payout → Verify

---

## Phase 1: Foundation ✅

- [x] Project setup (Next.js 16, Prisma, tRPC, BetterAuth)
- [x] **Data Models** - Create comprehensive Prisma schema
- [x] **Database Migration** - Apply migration to PostgreSQL
- [x] **tRPC Setup** - Configure routers and context
- [x] **Auth Setup** - Configure BetterAuth with email/password and OAuth

---

## Phase 2: Core Components & Layout ✅

- [x] **UI Components** - Add required shadcn components
- [x] **App Layout** - Create main layout with navigation
- [x] **Theme Provider** - Set up dark/light mode toggle
- [x] **Auth Pages** - Sign in, Sign up flows

---

## Phase 3: Project Pages ✅

- [x] **Project Page Layout** - 3-tab layout (Readme, Bounties, Contributors)
- [x] **Readme Tab** - Description, links, pool info
- [x] **Bounties Tab** - List of bounties with filters, claim button
- [x] **Contributors Tab** - Auto-computed list with points and % of pool
- [x] **Project Header** - Stats (pool %, payout frequency, commitment)

---

## Phase 4: Discover Page ✅

- [x] **Discover Layout** - Browse public projects
- [x] **Project Cards** - At-a-glance stats (pool %, bounties, founder)
- [x] **Empty State** - Prompt to create first project

---

## Phase 5: Contributor Dashboard ✅

- [x] **Dashboard Layout** - Stats cards, projects, recent payouts
- [x] **My Projects** - List of projects I've contributed to
- [x] **My Points** - Points per project, % of each pool
- [x] **My Earnings** - Past payouts, lifetime total

---

## Phase 6: Founder Dashboard ✅

- [x] **Dashboard Layout** - My projects list
- [x] **Create Project** - Full form with pool configuration
- [ ] **Pending Submissions** - Review and approve/reject flow
- [ ] **Submission Thread** - Conversation UI like GitHub PR
- [ ] **Manage Bounties** - Create, edit, close bounties
- [ ] **Edit Project** - Update readme and settings

---

## Phase 7: Payout System 🔄

- [ ] **Create Payout** - Founder enters profit for period
- [ ] **Preview Split** - Show breakdown before confirming
- [ ] **Mark Sent** - Founder marks payouts as sent
- [ ] **Confirm Receipt** - Contributors confirm/dispute
- [ ] **Payout History** - Timeline of all payouts

---

## Phase 8: Bounty Flow 🔄

- [ ] **Create Bounty** - Form with templates
- [ ] **Claim Bounty** - Contributor claims with expiry
- [ ] **Submit Work** - Description + attachments
- [ ] **Review Submission** - Approve/reject with notes
- [ ] **Release Claim** - Founder can release stale claims

---

## Phase 9: Polish & Trust Signals

- [ ] **Trust Indicators** - Verified payouts, confirmation rates
- [ ] **Zero-Profit Warnings** - Surface patterns
- [ ] **Pool Commitment** - Show end dates on bounties
- [ ] **Responsive Design** - Mobile-first polish
- [ ] **Loading States** - Skeletons and spinners
- [ ] **Error Handling** - Toast notifications, error boundaries

---

## Completed Summary

### Infrastructure

- ✅ PostgreSQL database with Docker Compose + Tilt
- ✅ Prisma ORM with all MVP models
- ✅ BetterAuth with email/password + Google/GitHub OAuth
- ✅ tRPC API layer with 5 routers

### Data Models

- ✅ User (BetterAuth)
- ✅ Project with RewardPool
- ✅ Bounty with claims
- ✅ Submission with messages and attachments
- ✅ Payout with recipients

### UI Components (shadcn)

- ✅ Button, Card, Badge, Avatar, Input, Textarea
- ✅ Form, Label, Skeleton, Tooltip, ScrollArea
- ✅ DropdownMenu, Select, Tabs

### Pages

- ✅ Home (landing page)
- ✅ Sign In / Sign Up
- ✅ Discover (project list)
- ✅ Project Page (3 tabs)
- ✅ Contributor Dashboard
- ✅ Founder Dashboard
- ✅ Create Project

---

## Running the App

```bash
# Start database
docker compose up -d

# Run migrations
pnpm db:migrate:deploy

# Start dev server
pnpm dev
```

App runs at: http://localhost:3050
