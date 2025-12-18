<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/logo-mark.svg" width="48">
  <source media="(prefers-color-scheme: light)" srcset="public/logo-mark-dark.svg" width="48">
  <img alt="" src="public/logo-mark-dark.svg" width="48">
</picture>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/logo-text.svg" width="94">
  <source media="(prefers-color-scheme: light)" srcset="public/logo-text-dark.svg" width="94">
  <img alt="Shippy" src="public/logo-text-dark.svg" width="94">
</picture>
<br /><br />

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js) ![React](https://img.shields.io/badge/React-19-61DAFB?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss) ![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma) ![pnpm](https://img.shields.io/badge/pnpm-package%20manager-F69220?logo=pnpm) ![License](https://img.shields.io/badge/License-Elastic--2.0-blue)

The platform where contributors earn recurring royalties for helping startups ship real work.

## Tech Stack

- **Framework**: Next.js 16 + React 19 + TypeScript
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Database**: PostgreSQL + Prisma ORM
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

## AI Integration

### MCP Server

Shippy also provides an MCP (Model Context Protocol) server so AI assistants can interact with bounties directly from your IDE.

- **Setup guide**: [shippy.sh/docs/mcp-installation](https://shippy.sh/docs/mcp-installation)
- **Docs endpoint** (no auth required): `https://shippy.sh/mcp/docs`

The docs MCP server provides `list_docs` and `read_doc` tools for AI assistants to reference Shippy documentation.

### llms.txt

Shippy provides an `/llms.txt` endpoint following the [llms.txt standard](https://llmstxt.org/) for LLM-friendly documentation:

- **llms.txt**: [shippy.sh/llms.txt](https://shippy.sh/llms.txt)
- **Docs guide**: [shippy.sh/llms.txt/docs/llms-txt.md](https://shippy.sh/llms.txt/docs/llms-txt.md)

## Documentation

Full product spec: [`prds/shippy.md`](./prds/shippy.md)

## License

This project is licensed under the [Elastic License 2.0](./LICENSE).
