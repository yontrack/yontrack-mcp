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

See [Environment Variables](#environment-variables) for the full list of supported variables.

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

## Docker

A pre-built image is published to Docker Hub on every push to `main`:

```
nemerosa/yontrack-mcp:latest
```

To build locally:

```bash
docker build -t yontrack-mcp .
```

Run the container (listens on port 3000 by default):

```bash
docker run --rm \
  -e YONTRACK_URL=https://your-ontrack-instance \
  -e YONTRACK_TOKEN=your-api-token \
  -e YONTRACK_MUTATIONS_ENABLED=true \
  -p 3000:3000 \
  nemerosa/yontrack-mcp:latest
```

Omit `YONTRACK_MUTATIONS_ENABLED` (or set it to `false`) to run in read-only mode.

To enable OAuth2 (required for claude.ai), add the two OAuth variables:

```bash
docker run --rm \
  -e YONTRACK_URL=https://your-ontrack-instance \
  -e YONTRACK_TOKEN=your-api-token \
  -e YONTRACK_MCP_SERVER_URL=https://mcp.example.com \
  -e YONTRACK_MCP_AUTH_PASSWORD=some-strong-password \
  -p 3000:3000 \
  nemerosa/yontrack-mcp:latest
```

## Kubernetes / Helm

A Helm chart is published to Docker Hub as an OCI image alongside every release:

```
oci://registry-1.docker.io/nemerosa/yontrack-mcp-chart
```

### Install

```bash
helm install yontrack-mcp \
  oci://registry-1.docker.io/nemerosa/yontrack-mcp-chart \
  --version <version> \
  --set yontrack.url=https://your-ontrack-instance \
  --set yontrack.token=your-api-token
```

### Configuration

| Value | Description | Default |
|---|---|---|
| `yontrack.url` | URL of the Yontrack instance | `""` |
| `yontrack.token` | Yontrack API token | `""` |
| `yontrack.mutationsEnabled` | Enable mutation tools (create/promote/link operations) | `false` |
| `oauth.serverUrl` | Public HTTPS URL of this server — enables OAuth2 when set with `oauth.authPassword` | `""` |
| `oauth.authPassword` | Password for the browser authorization form — enables OAuth2 when set with `oauth.serverUrl` | `""` |
| `existingSecret` | Name of a pre-existing Secret (skips Secret creation) | `""` |
| `service.type` | Kubernetes Service type | `ClusterIP` |
| `service.port` | Service port | `3000` |
| `ingress.enabled` | Enable Ingress resource | `false` |
| `ingress.className` | Ingress class name | `""` |
| `ingress.hosts` | Ingress host rules | see `values.yaml` |
| `replicaCount` | Number of pod replicas | `1` |
| `image.tag` | Image tag override (defaults to chart `appVersion`) | `""` |
| `resources` | Pod resource requests/limits | `{}` |

### Using an existing Secret

When credentials are managed externally (e.g. External Secrets Operator, Vault, or a manually created Secret), set `existingSecret` to skip Secret creation. The referenced Secret must contain:

- `YONTRACK_TOKEN`
- `YONTRACK_MCP_AUTH_PASSWORD` (when OAuth2 is enabled)

```bash
helm install yontrack-mcp \
  oci://registry-1.docker.io/nemerosa/yontrack-mcp-chart \
  --version <version> \
  --set yontrack.url=https://your-ontrack-instance \
  --set existingSecret=my-yontrack-secret
```

### Ingress example

**Without OAuth2** — expose only the `/mcp` endpoint:

```yaml
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: mcp.example.com
      paths:
        - path: /mcp
          pathType: Prefix
  tls:
    - secretName: mcp-tls
      hosts:
        - mcp.example.com
```

**With OAuth2** — all paths must be reachable (OAuth2 discovery, `/authorize`, `/token`, etc.):

```yaml
oauth:
  serverUrl: https://mcp.example.com
  authPassword: some-strong-password

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: mcp.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: mcp-tls
      hosts:
        - mcp.example.com
```

The MCP endpoint is available at `https://mcp.example.com/mcp`.

## Usage with Claude Desktop / Claude.ai

The server exposes a Streamable HTTP transport (MCP spec 2025-03-26) on `POST /mcp`.

### Local / Claude Desktop (no auth)

Start the server locally:

```bash
YONTRACK_URL=https://your-ontrack-instance YONTRACK_TOKEN=your-api-token npm start
# or with a custom port:
PORT=8080 YONTRACK_URL=... YONTRACK_TOKEN=... npm start
```

Register it in your MCP client as a remote server at `http://localhost:3000/mcp`.

Add `YONTRACK_MUTATIONS_ENABLED=true` to also expose the mutation tools.

### Claude.ai (OAuth2 required)

Claude.ai requires OAuth2 for remote MCP servers. To enable it, set two additional environment variables alongside the standard ones:

```bash
export YONTRACK_MCP_SERVER_URL=https://mcp.example.com   # public HTTPS URL of this server
export YONTRACK_MCP_AUTH_PASSWORD=some-strong-password   # users enter this in the browser
```

Both must be set together; either alone is ignored and the server starts without authentication.

**First-time connection flow:**

1. In Claude.ai go to **Settings → Integrations** and add `https://mcp.example.com/mcp` as a new integration.
2. Claude.ai auto-discovers the OAuth2 endpoints via `/.well-known/oauth-authorization-server`.
3. Claude.ai registers itself as a client automatically (dynamic client registration — no manual client ID/secret needed).
4. You are redirected to the server's authorization page where you enter the configured password.
5. After approval, Claude.ai receives a Bearer token valid for 1 hour (refresh tokens last 30 days).
6. Subsequent requests use the token silently; you re-authorize only after the refresh token expires.

> **HTTPS required.** `YONTRACK_MCP_SERVER_URL` must use `https://`. For local testing only, `http://localhost` is also accepted.

> **Tokens are in-memory.** All issued tokens are lost when the server restarts. Users will be prompted to re-authorize after a restart.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `YONTRACK_URL` | Yes | — | URL of the Yontrack instance (e.g. `https://ontrack.example.com`) |
| `YONTRACK_TOKEN` | Yes | — | API token for authenticating against Yontrack |
| `YONTRACK_MUTATIONS_ENABLED` | No | `false` | Set to `true` to enable mutation tools (create/promote/link operations). When unset or `false`, only read-only query tools are registered. |
| `YONTRACK_MCP_SERVER_URL` | No | — | Public HTTPS URL of this server. When set together with `YONTRACK_MCP_AUTH_PASSWORD`, enables OAuth2 (required for claude.ai). |
| `YONTRACK_MCP_AUTH_PASSWORD` | No | — | Password users must enter in the browser authorization form. Required together with `YONTRACK_MCP_SERVER_URL` to enable OAuth2. |
| `PORT` | No | `3000` | Port the HTTP server listens on |

## Available Tools

By default only read-only tools are available. Set `YONTRACK_MUTATIONS_ENABLED=true` to also expose the tools marked with ✎ below.

| Category | Read-only tools | Mutation tools (✎) |
|---|---|---|
| Projects | `list_projects` | `create_project` |
| Branches | `list_branches` | `create_branch` |
| Builds | `list_builds`, `find_build`, `get_build_duration` | `create_build` |
| Validation stamps | `list_validation_stamps` | `create_validation_stamp` |
| Validation runs | `get_validation_runs` | `create_validation_run` |
| Promotion levels | `list_promotion_levels` | `create_promotion_level` |
| Promotion runs | `get_promotion_runs` | `promote_build` |
| Build links | `get_build_links` | `set_build_links` |
| Search | `search` | — |
| GraphQL | `graphql_query` ✝ | — |

> ✝ `graphql_query` is always registered but rejects requests whose query string starts with `mutation` when `YONTRACK_MUTATIONS_ENABLED` is not set.
