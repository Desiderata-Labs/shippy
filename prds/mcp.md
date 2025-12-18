# MCP Integration PRD

## Overview

Enable Cursor, Claude, and other AI agents to interact with Shippy bounties via the [Model Context Protocol](https://modelcontextprotocol.io/).

## Goal

Contributors and founders can connect their IDE/agent to Shippy and:

- Read bounty details
- See their assigned bounties
- Browse projects
- Claim bounties, submit work
- Manage bounties (founders)

## Current Tools

### Visibility Logic

All tools respect project visibility:

- **If authenticated**: Access public projects + private projects you own
- **If not authenticated**: Access public projects only

This means founders can use MCP tools to manage their private projects when authenticated.

### Read Operations

| Tool                  | Description                                     | Auth Required |
| --------------------- | ----------------------------------------------- | ------------- |
| `read_bounty`         | Get bounty by identifier (e.g., "SHP-42") or ID | Optional\*    |
| `list_bounties`       | List bounties for a project                     | Optional\*    |
| `list_my_bounties`    | List bounties claimed by authenticated user     | Yes           |
| `read_project`        | Get project details by slug                     | Optional\*    |
| `list_projects`       | Browse projects                                 | Optional\*    |
| `list_labels`         | List all labels for a project                   | Optional\*    |
| `read_label`          | Get label details by ID                         | Optional\*    |
| `list_my_submissions` | List user's submissions                         | Yes           |

\*Optional: Works without auth for public projects. With auth, also includes your private projects.

### Bounty Write Operations (Founder)

| Tool            | Description                                    | Auth Required |
| --------------- | ---------------------------------------------- | ------------- |
| `create_bounty` | Create a new bounty for a project              | Yes (founder) |
| `update_bounty` | Update bounty title, description, points, etc. | Yes (founder) |
| `close_bounty`  | Close a bounty (expires claims)                | Yes (founder) |
| `reopen_bounty` | Reopen a closed bounty                         | Yes (founder) |

### Bounty Write Operations (Contributor)

| Tool                | Description                      | Auth Required |
| ------------------- | -------------------------------- | ------------- |
| `claim_bounty`      | Claim a bounty to work on it     | Yes + visible |
| `release_claim`     | Release your claim on a bounty   | Yes           |
| `create_submission` | Submit work for a claimed bounty | Yes + visible |

Note: `claim_bounty` and `create_submission` also respect visibility - you can't claim or submit to a bounty you can't see.

### Label Write Operations (Founder)

| Tool           | Description                      | Auth Required |
| -------------- | -------------------------------- | ------------- |
| `create_label` | Create a new label for a project | Yes (founder) |
| `update_label` | Update label name or color       | Yes (founder) |
| `delete_label` | Delete a label from a project    | Yes (founder) |

### Project Write Operations (Founder)

| Tool                  | Description                             | Auth Required |
| --------------------- | --------------------------------------- | ------------- |
| `create_project`      | Create a new project with reward pool   | Yes (founder) |
| `update_project`      | Update project settings and reward pool | Yes (founder) |
| `update_project_logo` | Update or remove project logo           | Yes (founder) |

### Authentication

**Approach: Personal Access Tokens**

The simplest, most battle-tested pattern (used by GitHub, Stripe, OpenAI, Anthropic):

1. User visits `https://shippy.sh/settings/tokens`
2. Clicks "Generate MCP Token"
3. Token shown once, user copies it
4. User adds to their MCP client config:
   ```json
   {
     "shippy": {
       "url": "https://shippy.sh/mcp",
       "headers": {
         "Authorization": "Bearer shp_xxxx..."
       }
     }
   }
   ```

**Why not OAuth/Device Auth for MVP?**

- BetterAuth's MCP plugin is marked "not production ready"
- Device Authorization adds complexity (polling, approval pages)
- Personal tokens are simpler to implement and debug
- Can upgrade to Device Auth later for better UX

### Data Model

```prisma
model McpAccessToken {
  id          String    @id @default(cuid())
  token       String    @unique // hashed, prefixed with "shp_"
  name        String    // user-provided label
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  createdAt   DateTime  @default(now())
}
```

### API Route

`/mcp/route.ts` — uses `@modelcontextprotocol/sdk` directly (not mcp-handler):

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp'
import { verifyMcpToken, extractBearerToken } from '@/lib/mcp-token/server'

const server = new McpServer(
  { name: 'Shippy', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

// Register tools
server.registerTool('read_bounty', { ... }, async ({ identifier }) => { ... })
server.registerTool('list_my_bounties', { ... }, async (_, extra) => {
  if (!extra.authInfo?.clientId) throw new Error('Auth required')
  // ...
})

// Create stateless transport
const transport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
})
server.connect(transport)

// Verify token and build AuthInfo
async function verifyToken(req: Request): Promise<AuthInfo | undefined> {
  const token = extractBearerToken(req.headers.get('Authorization'))
  if (!token) return undefined

  const result = await verifyMcpToken(token)
  if (!result) return undefined

  return {
    token,
    clientId: result.userId,
    scopes: ['read'],
    extra: { user: result.user },
  }
}

export async function POST(req: Request) {
  const authInfo = await verifyToken(req)
  return transport.handleRequest(req, { authInfo })
}
```

## Future Enhancements

### Review Operations (Founder)

- `review_submission` - Approve, reject, or request info on submission
- `add_bounty_comment` - Comment on a bounty thread
- `add_submission_comment` - Comment on a submission thread

### Better Auth Flow

- Device Authorization (click link → approve → done)
- No copy-paste needed

## Implementation Tasks

### Phase 1 - Read Operations ✅

1. ✅ **Schema**: Add `McpAccessToken` model
2. ✅ **Token Generation UI**: Settings page with MCP Tokens section
3. ✅ **MCP Route**: `/mcp/route.ts` with tools (using SDK directly, not mcp-handler)
4. ✅ **Token Validation**: `verifyMcpToken()` in `lib/mcp-token/server.ts`
5. ✅ **Read Tools**: `read_bounty`, `list_my_bounties`, `read_project`, `list_projects`

### Phase 2 - Write Operations ✅

1. ✅ **Bounty Management**: `create_bounty`, `update_bounty`, `close_bounty`, `reopen_bounty`
2. ✅ **Claim Management**: `claim_bounty`, `release_claim`
3. ✅ **Submissions**: `create_submission`, `list_my_submissions`
4. ✅ **Labels**: `create_label`, `update_label`, `delete_label`, `list_labels`, `read_label`
5. ✅ **Bounty Listing**: `list_bounties`

## Dependencies

```bash
pnpm add @modelcontextprotocol/sdk
```

> **Note:** We intentionally do NOT use `mcp-handler`. See [Why Not mcp-handler](#why-not-mcp-handler) below.

## Infra Needs (Rob)

- None for MVP — just API routes on existing Vercel deployment
- Optional: Increase function timeout to 60s if needed for long-running connections

## How Users Connect

**Cursor** (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "shippy": {
      "url": "https://shippy.sh/mcp",
      "headers": {
        "Authorization": "Bearer shp_your_token_here"
      }
    }
  }
}
```

**Older clients** (via mcp-remote for stdio-only clients):

```json
{
  "mcpServers": {
    "shippy": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://shippy.sh/mcp",
        "--header",
        "Authorization: Bearer shp_your_token_here"
      ]
    }
  }
}
```

> **Note:** Cursor 0.50+ supports Streamable HTTP natively. Only use mcp-remote for older clients that only support stdio transport.

## Example Usage

Once connected:

### For Contributors

> "What bounties am I working on?"

> "Show me bounty SHP-42"

> "List open bounties on the shippy project"

> "Claim bounty SHP-15"

> "Submit my work for SHP-15 with description: Implemented the dark mode toggle as requested. See PR #42."

> "Release my claim on SHP-15"

### For Founders

> "Create a bounty for my project 'shippy' titled 'Add dark mode support' with 50 points"

> "Update SHP-42 to have 100 points"

> "Close bounty SHP-10"

> "Create a label called 'urgent' with color #FF0000 for my shippy project"

---

## Design Decision: Why Personal Access Tokens over OAuth

### Context

BetterAuth has two relevant plugins:

1. **MCP Plugin** — OAuth flow for MCP clients, marked "not production ready"
2. **OAuth 2.1 Provider** ([PR #4163](https://github.com/better-auth/better-auth/pull/4163)) — Complete rewrite, in draft for 4+ months

### Key Insights from PR Discussion

The OAuth 2.1 Provider PR will deprecate both the OIDC Provider and MCP plugins. Key points:

- **MCP plugin has flaws**: The maintainer notes "many inherent flaws in its design"
- **API keys are debated**: The maintainer wants to deprecate API keys in favor of OAuth, but there's pushback:
  > _"If API keys are fine for GitHub, Google, OpenAI, Anthropic, DigitalOcean, Vercel... why couldn't we use them too?"_
- **Token prefixes matter**: Discussion confirms prefixes (like `shp_`) are important for GitHub secret scanning
- **Introspection endpoint planned**: Server-side token verification will be available

### Our Approach

We're using Personal Access Tokens (PATs) because:

1. **Production-ready now** — No waiting for OAuth 2.1 Provider to ship
2. **Industry standard** — Same pattern as GitHub, Stripe, OpenAI, Anthropic
3. **Simple to implement** — ~1 day vs weeks for full OAuth
4. **Easy migration path** — When OAuth 2.1 ships, we can add it as an alternative

### Future Migration

When BetterAuth's OAuth 2.1 Provider ships (PR #4163), we can:

1. Add Device Authorization flow for better UX (no copy-paste)
2. Keep PATs as a fallback for legacy/simple integrations
3. Use the new `withMcpAuth` helpers for token validation

Track progress: https://github.com/better-auth/better-auth/pull/4163

---

## Why Not mcp-handler

We initially tried using [`mcp-handler`](https://github.com/vercel/mcp-handler) but hit a critical bug where valid requests were rejected with `406 Not Acceptable`.

### The Problem

`mcp-handler` performs unnecessary header conversions that corrupt the `Accept` header:

1. **Next.js App Router** provides a native Web `Request` with proper `Headers` API
2. **mcp-handler** converts this to a Node.js `IncomingMessage` (headers become a plain object)
3. **mcp-handler** uses `@hono/node-server` to convert it BACK to a Web `Request`
4. Somewhere in this round-trip, the `Accept` header gets corrupted

The MCP SDK's `WebStandardStreamableHTTPServerTransport` requires:

```js
const acceptHeader = req.headers.get('accept');
if (!acceptHeader?.includes('application/json') || !acceptHeader.includes('text/event-stream')) {
  return new Response('Not Acceptable', { status: 406 });
}
```

Even with a correct `Accept: application/json, text/event-stream` header from the client, the request fails after mcp-handler's conversions.

### Reproduction Steps

1. Create a Next.js 15+ App Router project
2. Install `mcp-handler` and set up per their docs:

   ```ts
   // app/mcp/[transport]/route.ts
   import { createMcpHandler } from 'mcp-handler'

   const handler = createMcpHandler(
     (server) => {
       server.registerTool('test', { inputSchema: {} }, async () => ({
         content: [{ type: 'text', text: 'Hello' }],
       }))
     },
     {},
     { basePath: '/mcp' },
   )

   export { handler as GET, handler as POST }
   ```

3. Send a valid MCP request:

   ```bash
   curl -X POST http://localhost:3000/mcp/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
   ```

4. **Expected:** 200 OK with initialization response
5. **Actual:** 406 Not Acceptable with message "Client must accept both application/json and text/event-stream"

### Our Solution

We bypass `mcp-handler` entirely and use `WebStandardStreamableHTTPServerTransport` directly from `@modelcontextprotocol/sdk`:

```ts
// app/mcp/route.ts
import { McpServer } from '@modelcontextprotocol/sdk/server'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp'

const server = new McpServer({ name: 'MyApp', version: '1.0.0' })
server.registerTool(...)

const transport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: undefined, // Stateless
})
server.connect(transport)

export async function POST(req: Request) {
  return transport.handleRequest(req)
}
```

This works perfectly because Next.js App Router already provides native Web `Request` objects — no conversion needed.

### Bug Report Template

```markdown
## mcp-handler returns 406 on valid requests in Next.js App Router

### Environment

- Next.js 15+ with App Router
- mcp-handler 0.x.x
- @modelcontextprotocol/sdk 1.x.x

### Description

Valid MCP requests with correct `Accept: application/json, text/event-stream` header
are rejected with 406 Not Acceptable.

### Root Cause

mcp-handler converts the native Web `Request` to Node.js `IncomingMessage` and back
to Web `Request` via @hono/node-server. This round-trip corrupts the `Accept` header.

### Reproduction

[See steps above]

### Workaround

Use `WebStandardStreamableHTTPServerTransport` directly from @modelcontextprotocol/sdk,
which accepts native Web Requests without conversion.

### Suggested Fix

Since Next.js App Router provides native Web `Request` objects, mcp-handler should
detect this and skip the Node.js IncomingMessage conversion entirely.
```
