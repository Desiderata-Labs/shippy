# Shippy Development Guidelines

## Project Overview

Shippy is a platform where founders "open-source" parts of their startup by posting real work (growth, marketing, sales, etc.), and contributors who help ship it earn an ongoing share of the upside—not just a one-off payment.

**Core concept**: Contributors earn recurring royalties for helping startups ship real work.

**Key mechanics**:

- Founders create **Projects** with a **Reward Pool** (e.g., 10% of profit)
- They publish **Bounties** (specific tasks with point rewards)
- Contributors claim bounties, deliver results, and earn **Points**
- Points convert into **recurring payouts** proportional to their share of the pool

See `prds/shippy.md` for the complete product specification, including:

- User journeys (Section 7)
- MVP product surfaces (Section 8)
- Pool dilution & fairness mechanics (Section 9)
- MVP vs Later phases (Section 10)
- Risks, Legal & Trust considerations (Section 12)

## Domain

https://shippy.sh

## Team

- CEO / CTO: Rob Phillips

## Key Product Concepts

Before building, understand these core concepts from the PRD:

### The GitHub Mental Model

| GitHub       | Shippy           | Notes                                         |
| ------------ | ---------------- | --------------------------------------------- |
| Repository   | **Project**      | The product/company being built               |
| README.md    | **Readme**       | About, mission, links (Discord, assets, docs) |
| Issues       | **Bounties**     | Specific tasks with point rewards             |
| Contributors | **Contributors** | Auto-computed from accepted submissions       |
| Pull Request | **Submission**   | Contributor's work + proof                    |
| Merge        | **Approval**     | Founder approves → points awarded             |
| Sponsors     | **Reward Pool**  | The $ that flows to contributors              |

### The Core Loop

```
Bounty → Claim → Submit → Approve → Points → Payout → Verify
```

Every feature should support or enhance this loop.

### Trust Through Transparency

The platform's primary defense against gaming is transparency:

- Public contributor lists and point allocations
- Visible payout history with contributor confirmations
- Surfaced trust signals (verified payouts, zero-profit warnings)

## MVP Scope

**What we're building first** (see PRD Section 10):

- Project Page with 3 tabs: Readme, Bounties, Contributors
- Simple Discover page (browse public projects)
- Contributor Dashboard (my points, my earnings, my submissions)
- Founder Dashboard (review submissions, run payouts, manage bounties)
- Manual payout flow (founder enters profit, sees split, pays externally)
- Payout verification (contributors confirm receipt)

**Explicitly deferred**:

- ❌ In-app chat/discussions (use Discord/Slack)
- ❌ Multi-founder admin roles
- ❌ Integrations (Stripe, Paddle, HubSpot)
- ❌ Built-in payouts (Stripe Connect)
- ❌ Private/invite-only projects
- ❌ Contributor profiles across projects
- ❌ Code/feature marketplace ("Buy a Vibe, Ship a Biz")

## Tech Stack

- **Framework**: Next.js 16 + React 19 + TypeScript
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Database**: PostgreSQL + Prisma ORM
- **API Layer**: tRPC + TanStack Query v5
- **Auth**: BetterAuth (with eventual organization-based auth controls for multi-founder projects)
- **Asset Storage**: Cloudflare R2
- **Language**: TypeScript (strict mode)
- **Code Quality**: ESLint
- **Package Manager**: pnpm

## Development Commands

- `pnpm lint` - Run ESLint on all files
- `pnpm format` - Format all files using Prettier
- `pnpm check-types` - Run TypeScript compiler to check for errors
- `pnpm test` - Run all tests (node + dom)
- `pnpm test:node` - Run node environment tests only
- `pnpm test:dom` - Run jsdom environment tests only
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:ui` - Run tests with Vitest UI
- `pnpm db:generate` - Regenerate Prisma client after schema changes
- `pnpm db:migrate:create --name descriptive_name` - Create a new migration (dev)
- `pnpm db:migrate:deploy` - Apply migrations in production

### Database Migrations

**IMPORTANT**: NEVER use `pnpm db:push` - it bypasses migrations and causes drift.

When changing the Prisma schema:

1. Edit `prisma/schema.prisma`
2. Run `pnpm db:migrate:create --name your_change_name`
3. Review the generated SQL in `prisma/migrations/`
4. Commit the migration files to git

### General Rules

- NEVER run the app manually if it's already running—check first to avoid duplicate instances
- Always use typed routes from `@/lib/routes` instead of hardcoding URLs or paths
- Always install packages with `pnpm add` (or `pnpm add -D` for dev dependencies)
- Always use kebab-case for file names and directories (except for Next.js route conventions)
- Follow Next.js 16 App Router conventions for file structure
- Use server components by default, only add "use client" when necessary
- **Prefer surgical edits over full rewrites** to minimize token costs—only rewrite larger sections when the rewrite would use fewer tokens than targeted changes

### Server/Client Code Separation

For any library code that could be used on both server and client, use explicit export paths to prevent accidental bundling of server code into client bundles:

```
lib/
├── database/
│   ├── server.ts      # Server-only (Prisma, direct DB access)
│   ├── react.ts       # Client-safe (types, hooks, utilities)
│   └── shared.ts      # Truly isomorphic (types, constants)
├── auth/
│   ├── server.ts      # Server-only (session validation, tokens)
│   └── react.ts       # Client-safe (hooks, context)
└── points/
    ├── server.ts      # Server-only (calculation with DB)
    ├── react.ts       # Client-safe (display utilities)
    └── shared.ts      # Shared types and constants
```

**Import patterns:**

```tsx
// ✅ Correct - explicit about what you're importing
import { getUser } from "@/lib/auth/server";
import { useAuth } from "@/lib/auth/react";
import type { User } from "@/lib/auth/shared";

// ❌ Wrong - ambiguous, might pull in server code
import { getUser } from "@/lib/auth";
```

**Rules:**

- NEVER create a bare `index.ts` that re-exports both server and client code
- Mark server-only files with `import "server-only"` at the top
- Mark client-only files with `"use client"` at the top
- Shared files should only contain types, constants, and pure functions

### Type Safety

- Always use TypeScript with strict mode enabled
- Define proper interfaces for all data structures
- Avoid using `any` type
- **Strongly prefer enums over union string types** for states, modes, and fixed value sets; avoid stringly typed values whenever possible
- Use Prisma-generated types for database models
- Use Zod for input validation in tRPC procedures

### Status Enums (IMPORTANT)

**ALWAYS use status enums from `@/lib/db/types`** instead of string literals for database status / enum fields:

```tsx
// ✅ Correct - use enums
import { BountyStatus, ClaimStatus, SubmissionStatus } from '@/lib/db/types'

if (bounty.status === BountyStatus.OPEN) { ... }
if (claim.status === ClaimStatus.ACTIVE) { ... }
if (submission.status === SubmissionStatus.PENDING) { ... }

await prisma.bounty.update({
  where: { id },
  data: { status: BountyStatus.CLAIMED },
})

// ❌ Wrong - string literals
if (bounty.status === 'OPEN') { ... }
if (claim.status === 'ACTIVE') { ... }
await prisma.bounty.update({
  where: { id },
  data: { status: 'CLAIMED' },
})
```

Available enums:

- **`BountyStatus`**
- **`ClaimStatus`**
- **`SubmissionStatus`**
- **`PayoutStatus`**
- **`PayoutRecipientStatus`**
- **`NotificationType`**
- etc. (see `@/lib/db/types.ts`)

### Routes

- **NEVER use string literals for internal navigation URLs** (e.g., `/p/${slug}`, `/u/${username}`)
- **ALWAYS use the `routes` helper** from `@/lib/routes` for all internal links, navigation, and URL generation
- This applies to **both client and server code** (components, API routes, webhooks, notifications, etc.)
- This ensures type-safe routing and makes refactoring easier

```tsx
// ✅ Correct - type-safe routes
import { routes } from '@/lib/routes'

// Client-side navigation
<Link href={routes.project.detail({ slug: 'my-project' })}>View Project</Link>
<Link href={routes.user.profile({ username: 'rob' })}>View Profile</Link>
<Link href={routes.project.bountyDetail({ slug: 'my-project', bountyId: '123' })}>View Bounty</Link>

// Server-side URL generation (API routes, webhooks, notifications)
const bountyUrl = `${APP_URL}${routes.project.bountyDetail({ slug: project.slug, bountyId: bounty.id })}`
const projectUrl = `${APP_URL}${routes.project.detail({ slug: project.slug })}`

// ❌ Wrong - stringly typed URLs
<Link href={`/p/${slug}`}>View Project</Link>
<Link href={`/u/${username}`}>View Profile</Link>
const url = `${APP_URL}/p/${slug}/bounty/${id}` // Don't do this!
```

- When adding new routes, update the appropriate file in `src/lib/routes/` (e.g., `project.ts`, `user.ts`)
- Export both `paths` (for Next.js app router matching) and `routes` (for navigation)
- For absolute URLs, combine `NEXT_PUBLIC_APP_URL` with the route helper: `${APP_URL}${routes.project.detail({ slug })}`

### UI Components (shadcn/ui)

- Use shadcn/ui components for consistent design
- Always use shadcn semantic colors unless otherwise specified
- Use Tailwind's `size-` where width and height are the same value
- Utilize the `cn()` utility for conditional classes
- Keep components in `components/ui/` directory
- Import shadcn components as needed: `npx shadcn@latest add [component]`
- **All `<button>` elements MUST include `cursor-pointer` class** (unless disabled)

### Icons

Use Untitled UI icons:

```tsx
import { Trash03 } from '@untitled-ui/icons-react'
```

For loading icons, use Lucide:

```tsx
import { Loader2 } from 'lucide-react'
```

## Key Development Principles

### 1. PRD is the Source of Truth

- Read `prds/shippy.md` if needed before building any feature
- If something isn't covered, ask before assuming

### 2. Trust & Transparency First

Every feature should consider:

- What does the contributor see?
- What does the founder see?
- What does a prospective contributor (on Discover) see?
- How does this build or erode trust?
- Are any access controls needed?

### 3. MVP Discipline

- Build the core loop first, everything else is a distraction
- Manual before automatic (manual payouts before Stripe Connect)
- Transparency before enforcement (show bad actors, don't block them yet)

### 4. Financial Data Integrity

- Every payout, point award, and profit entry needs an audit trail
- Never delete financial records—soft delete or archive
- Store both raw inputs and calculated outputs
- Timestamps on everything

### 5. Clear States & Transitions

Bounties have states: Open → Claimed → Submitted → Approved/Rejected
Payouts have states: Announced → Sent → Confirmed/Disputed

Always make state transitions explicit and logged.

## UX Principles

### Design Philosophy

- Aspire to Linear's aesthetic: clean, minimal, dev/product-focused
- Prioritize clarity and speed over decoration
- Use subtle animations and transitions sparingly but intentionally
- Dense information display is fine—our users are power users

### Mobile-First by Default

- Design for mobile screens first, then enhance for desktop
- Use responsive Tailwind classes (`sm:`, `md:`, `lg:`) consistently
- Touch targets should be at least 44x44px

### Light/Dark Mode

- Support both light and dark modes, defaulting to the user's system preference
- Always use shadcn's semantic color variables (e.g., `bg-background`, `text-foreground`, `border-border`) which automatically adapt to the current theme
- Avoid raw Tailwind colors (e.g., `bg-gray-100`)—use semantic tokens instead

### For Founders

- Bounty creation should be fast (templates help)
- Approval flow should be simple (one-click approve with optional notes)
- Payout process should be guided (enter profit → see split → mark sent)

### For Contributors

- Discovering good projects should be easy (sort by payouts, verified status)
- Claiming should be low-friction (but show commitment end date)
- Submission should be clear (what evidence is needed?)
- Payout confirmation should be obvious (prompt when funds arrive)

### For Both

- Always show pool commitment end date
- Always show current point distribution
- Always show payout history and verification status

## File Organization (Suggested)

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth routes
│   ├── (dashboard)/       # Logged-in user views
│   │   ├── contributor/   # Contributor dashboard
│   │   └── founder/       # Founder dashboard
│   ├── discover/          # Public project discovery
│   └── project/[slug]/    # Public project pages
├── components/
│   ├── bounty/            # Bounty-related components
│   ├── payout/            # Payout-related components
│   ├── project/           # Project-related components
│   └── ui/                # shadcn/ui components
├── server/
│   ├── routers/           # tRPC routers
│   └── services/          # Business logic
└── lib/
    ├── points/            # Point calculation logic
    └── payouts/           # Payout calculation logic
```

## References

- **Full PRD**: `prds/shippy.md`
- **Platform Revenue Model**: PRD Section 12.2
- **Claim Mechanics**: PRD Section 12.3
- **Pool Lifecycle**: PRD Section 12.6
- **Anti-Gaming**: PRD Section 12.7
