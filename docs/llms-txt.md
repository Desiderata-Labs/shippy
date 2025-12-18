# llms.txt

Shippy provides an `/llms.txt` endpoint following the [llms.txt standard](https://llmstxt.org/) to help LLMs understand our platform.

## What is llms.txt?

The llms.txt specification is a proposal to standardize how websites provide LLM-friendly content. Instead of parsing complex HTML pages, LLMs can access concise, structured markdown files that explain what the site does and link to relevant documentation.

## Endpoints

### Main llms.txt

**URL:** `https://shippy.sh/llms.txt`

Returns a structured markdown file with:

- Project overview and description
- Links to documentation pages (as `.md` files)
- Optional supplementary resources

### Markdown Files

Individual documentation pages are available as plaintext markdown at:

```
https://shippy.sh/llms.txt/docs/{doc-id}.md
```

**Available docs:**

- `/llms.txt/docs/mcp-installation.md` - MCP server setup guide
- `/llms.txt/docs/shippy.md` - Platform overview (marketing page as markdown)
- `/llms.txt/docs/llms-txt.md` - This page

## Usage with AI Assistants

You can provide these URLs to AI coding assistants when you want them to understand Shippy:

```
Read https://shippy.sh/llms.txt to understand the Shippy platform.
```

Or for specific documentation:

```
Read https://shippy.sh/llms.txt/docs/mcp-installation.md for MCP setup instructions.
```

## Alternative: MCP Server

For deeper integration, Shippy also provides an MCP (Model Context Protocol) server that lets AI assistants interact with bounties directly from your IDE—not just read documentation.

- **Docs MCP server** (no auth required): `https://shippy.sh/mcp/docs`
- **Full MCP server** (requires token): `https://shippy.sh/mcp`

The docs MCP server provides `list_docs` and `read_doc` tools. The full MCP server lets contributors claim bounties, submit work, and lets founders manage their projects—all from within the IDE.

See the [MCP Server Installation](/docs/mcp-installation) guide for setup instructions.

## Related

- [MCP Server Installation](/docs/mcp-installation) - For direct IDE integration with AI assistants
- [llmstxt.org](https://llmstxt.org/) - The llms.txt specification
