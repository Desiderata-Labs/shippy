# Shippy

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js) ![React](https://img.shields.io/badge/React-19-61DAFB?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss) ![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma) ![pnpm](https://img.shields.io/badge/pnpm-package%20manager-F69220?logo=pnpm)

A platform where contributors earn recurring royalties for helping startups ship real work.

## Tech Stack

- **Framework**: Next.js 16 + React 19 + TypeScript
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Database**: PostgreSQL (Supabase) + Prisma ORM
- **API**: tRPC + TanStack Query v5
- **Auth**: BetterAuth

## Getting Started

```bash
# Install dependencies
pnpm install

# Set up environment (copy and fill in values)
cp .env.example .env

# Start the database
tilt up

# Run database migrations
pnpm db:migrate:deploy

# Start dev server
pnpm dev
```

Open [http://localhost:3050](http://localhost:3050)

## Commands

| Command                                | Description              |
| -------------------------------------- | ------------------------ |
| `pnpm dev`                             | Start development server |
| `pnpm lint`                            | Run ESLint               |
| `pnpm format`                          | Format with Prettier     |
| `pnpm check-types`                     | TypeScript type checking |
| `pnpm db:generate`                     | Regenerate Prisma client |
| `pnpm db:migrate:create --name <name>` | Create new migration     |
| `pnpm db:migrate:deploy`               | Apply migrations         |

## Documentation

Full product spec: [`prds/shippy.md`](./prds/shippy.md)
