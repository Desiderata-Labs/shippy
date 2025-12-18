# MCP Server Installation

Shippy provides a remote [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that lets AI coding assistants interact with your bounties directly in your IDE.

## Documentation MCP Server

Note that we also provide a separate MCP endpoint for reading Shippy documentation via MCP:

**Endpoint:** `https://shippy.sh/mcp/docs`

This endpoint requires no authentication and provides two tools:

| Tool        | Description                              |
| ----------- | ---------------------------------------- |
| `list_docs` | List all available documentation pages   |
| `read_doc`  | Read a specific documentation page by ID |

This is useful if you want your AI assistant to be able to reference Shippy docs without leaving your IDE.

## Features

With the Shippy MCP server, your AI assistant can:

**For Contributors:**

- Browse and search bounties across projects
- Read full bounty details and acceptance criteria
- Claim bounties to start working
- Submit completed work for review
- View and manage your active claims

**For Founders:**

- Create and update bounties
- Close and reopen bounties
- Manage project labels
- Create and configure projects

## Prerequisites

1. A Shippy account ([sign up here](/sign-up))
2. An MCP access token (generate one in your User Settings → MCP Access Tokens)

## Quick Install (Cursor)

If you're using Cursor, click the **"Add to Cursor"** button in your user settings after generating a token. This will automatically configure the MCP server.

## Manual Installation

### Cursor

Add this to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "shippy": {
      "url": "https://shippy.sh/mcp",
      "headers": {
        "Authorization": "Bearer shp_YOUR_TOKEN"
      }
    }
  }
}
```

### Windsurf

Add this to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "shippy": {
      "serverUrl": "https://shippy.sh/mcp",
      "headers": {
        "Authorization": "Bearer shp_YOUR_TOKEN"
      }
    }
  }
}
```

> **Note:** Windsurf uses `serverUrl` instead of `url` for HTTP servers. See the [Windsurf MCP docs](https://docs.windsurf.com/windsurf/cascade/mcp).

### Codex (OpenAI)

Codex uses TOML configuration in `~/.codex/config.toml`. You have two options:

**Option 1: Direct token (simpler)**

Add this to `~/.codex/config.toml`:

```toml
[mcp_servers.shippy]
url = "https://shippy.sh/mcp"
http_headers = { "Authorization" = "Bearer shp_YOUR_TOKEN" }
```

**Option 2: Environment variable (more secure)**

Add this to `~/.codex/config.toml`:

```toml
[mcp_servers.shippy]
url = "https://shippy.sh/mcp"
bearer_token_env_var = "SHIPPY_MCP_TOKEN"
```

Then set the environment variable in your shell (add to `~/.zshrc` or `~/.bashrc`):

```bash
export SHIPPY_MCP_TOKEN="shp_YOUR_TOKEN"
```

> **Note:** See the [Codex MCP documentation](https://developers.openai.com/codex/mcp/) for more configuration options.

### Claude Desktop

Claude Desktop only supports stdio-based MCP servers, so you'll need [mcp-remote](https://www.npmjs.com/package/mcp-remote) to connect to Shippy's HTTP endpoint.

Add to your Claude Desktop config:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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
        "Authorization: Bearer shp_YOUR_TOKEN"
      ]
    }
  }
}
```

### Claude Code

Claude Code also uses stdio-based servers. You can add Shippy via the CLI:

```bash
claude mcp add shippy -- npx -y mcp-remote https://shippy.sh/mcp --header "Authorization: Bearer shp_YOUR_TOKEN"
```

Or add to your project's `.mcp.json`:

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
        "Authorization: Bearer shp_YOUR_TOKEN"
      ]
    }
  }
}
```

### Other Clients (stdio-only)

For other MCP clients that only support stdio transport (not Streamable HTTP), use [mcp-remote](https://www.npmjs.com/package/mcp-remote) with the same configuration pattern as Claude Desktop above.

> **Note:** Cursor 0.50+ and Windsurf support Streamable HTTP natively. Claude Desktop, Claude Code, and older clients require mcp-remote.

## Available Tools

### Read Operations

| Tool                  | Description                               | Auth       |
| --------------------- | ----------------------------------------- | ---------- |
| `list_projects`       | Browse projects on Shippy                 | Optional\* |
| `read_project`        | Get project details by slug               | Optional\* |
| `list_bounties`       | List bounties for a project               | Optional\* |
| `read_bounty`         | Get bounty by identifier (e.g., "SHP-42") | Optional\* |
| `list_labels`         | List all labels for a project             | Optional\* |
| `read_label`          | Get label details by ID                   | Optional\* |
| `list_my_bounties`    | List bounties you have claimed            | Required   |
| `list_my_submissions` | List your submissions                     | Required   |

\*Optional: Works without auth for public projects. With auth, also shows your private projects.

### Contributor Operations

| Tool                | Description                           |
| ------------------- | ------------------------------------- |
| `claim_bounty`      | Claim a bounty to start working on it |
| `release_claim`     | Release your claim on a bounty        |
| `create_submission` | Submit work for a claimed bounty      |
| `update_submission` | Update a draft/pending submission     |

### Founder Operations

| Tool                  | Description                                    |
| --------------------- | ---------------------------------------------- |
| `create_bounty`       | Create a new bounty for a project              |
| `update_bounty`       | Update bounty title, description, points, etc. |
| `close_bounty`        | Close a bounty (expires claims)                |
| `reopen_bounty`       | Reopen a closed bounty                         |
| `create_label`        | Create a new label for a project               |
| `update_label`        | Update label name or color                     |
| `delete_label`        | Delete a label from a project                  |
| `create_project`      | Create a new project with reward pool          |
| `update_project`      | Update project settings                        |
| `update_project_logo` | Update or remove project logo                  |

## Example Usage

Once connected, try prompts like:

**For Contributors:**

> "What bounties am I working on?"

> "Show me bounty SHP-42"

> "List open bounties on the shippy project"

> "Claim bounty SHP-15"

> "Submit my work for SHP-15 with description: Implemented the dark mode toggle. See PR #42."

> "Update submission sub_123 with description: Added screenshots and test results."

> "Update submission sub_123 to status: PENDING"

**For Founders:**

> "Create a bounty for my project 'shippy' titled 'Add dark mode support' with 50 points"

> "Update SHP-42 to have 100 points"

> "Create a label called 'urgent' with color #FF0000 for my shippy project"

## Troubleshooting

### Server not connecting

1. Verify your token is correct and hasn't been deleted
2. Make sure you're using the correct config file path for your IDE
3. Restart your IDE after making config changes
4. Check that Shippy is accessible at https://shippy.sh/mcp

### Authentication errors

1. Check that your token starts with `shp_`
2. Ensure the `Authorization` header format is `Bearer shp_YOUR_TOKEN` (with a space)
3. Generate a new token if the current one isn't working

### Tools not appearing

1. Make sure the MCP server is enabled in your IDE's settings
2. Check your IDE's MCP logs for connection errors
3. Try refreshing/reloading the MCP server list

### 406 Not Acceptable errors

If you're building your own MCP client, ensure your requests include:

```
Accept: application/json, text/event-stream
```

## Security

- Your MCP token is tied to your Shippy account
- Tokens can be revoked at any time from your settings
- Each token shows when it was last used for auditing
- We recommend using separate tokens for different machines
- Token prefix `shp_` enables GitHub secret scanning

## Resources

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Cursor MCP Documentation](https://cursor.com/docs/context/mcp)
- [Windsurf MCP Documentation](https://docs.windsurf.com/windsurf/cascade/mcp)
- [Claude Desktop MCP Guide](https://support.anthropic.com/en/articles/10949351-getting-started-with-model-context-protocol-mcp-on-claude-for-desktop)
- [mcp-remote on npm](https://www.npmjs.com/package/mcp-remote)

## Need Help?

Email [hello@shippy.sh](mailto:hello@shippy.sh)
