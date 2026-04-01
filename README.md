# yontrack-mcp

MCP server for [Yontrack](https://ontrack.nemerosa.net) (Ontrack CI/CD monitoring platform). Exposes Yontrack's GraphQL API as MCP tools for use with Claude and other MCP clients.

## Prerequisites

- Node.js
- A running Yontrack instance and an API token

## Setup

```bash
npm install
npm run build
```

Set the required environment variables:

```bash
export YONTRACK_URL=https://your-ontrack-instance
export YONTRACK_TOKEN=your-api-token
```

## Testing

### Unit tests

Tests use [Vitest](https://vitest.dev/) with a mocked GraphQL client. No running Yontrack instance is required.

```bash
npm test           # single run
npm run test:watch # watch mode
```

Tests live alongside the source files as `*.test.ts`. The helper in `src/test/helpers.ts` wires an in-process MCP client+server pair via `InMemoryTransport`, so tests exercise the full MCP protocol path without any network I/O.

### Interactive testing with MCP Inspector

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) provides a browser UI to browse and call tools against a real Yontrack instance:

```bash
YONTRACK_URL=https://your-ontrack-instance YONTRACK_TOKEN=your-token \
  npx @modelcontextprotocol/inspector node build/index.js
```

## Usage with Claude Desktop

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "yontrack": {
      "command": "node",
      "args": ["/path/to/yontrack-mcp/build/index.js"],
      "env": {
        "YONTRACK_URL": "https://your-ontrack-instance",
        "YONTRACK_TOKEN": "your-api-token"
      }
    }
  }
}
```

Restart Claude Desktop after updating the config.

## Available Tools

| Category | Tools |
|---|---|
| Projects | `list_projects`, `create_project` |
| Branches | `list_branches`, `create_branch` |
| Builds | `list_builds`, `find_build`, `create_build` |
| Validation stamps | `list_validation_stamps`, `create_validation_stamp` |
| Validation runs | `get_validation_runs`, `create_validation_run` |
| Promotion levels | `list_promotion_levels`, `create_promotion_level` |
| Promotion runs | `get_promotion_runs`, `promote_build` |
| Build links | `get_build_links`, `set_build_links` |
| Search | `search` |
