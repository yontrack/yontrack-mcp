# yontrack-mcp

MCP server for [Yontrack](https://ontrack.nemerosa.net) (Ontrack CI/CD monitoring platform). It exposes Yontrack's GraphQL API as MCP tools so that AI assistants such as Claude can query and manage your CI/CD pipelines through natural language.

The server uses the [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http) (`POST /mcp`) and is available as a pre-built Docker image.

## Features

- **Read-only by default** — only query tools are active unless mutations are explicitly enabled
- **Mutation tools** — create projects, branches, builds, validation stamps/runs, promotion levels/runs, and build links (opt-in via `YONTRACK_MUTATIONS_ENABLED=true`)
- **Raw GraphQL access** — `graphql_query` tool for queries not covered by the dedicated tools
- **OAuth2 support** — required for claude.ai; enabled by setting two environment variables
- **Docker image** — published to Docker Hub on every release (`nemerosa/yontrack-mcp:latest`)
- **Helm chart** — OCI chart for Kubernetes deployments with full secret management support

## Available Tools

By default only read-only tools are available. Set `YONTRACK_MUTATIONS_ENABLED=true` to also expose the tools marked with ✎ below.

| Category | Read-only tools | Mutation tools (✎) |
|---|---|---|
| Projects | `list_projects` | `create_project` |
| Branches | `list_branches` | `create_branch` |
| Builds | `list_builds`, `find_build`, `get_build_duration` | `create_build` |
| Validation stamps | `list_validation_stamps` | `create_validation_stamp` |
| Validation runs | `get_validation_runs` | `create_validation_run` |
| Promotion levels | `list_promotion_levels`, `get_promotion_level_image` | `create_promotion_level` |
| Promotion runs | `get_promotion_runs` | `promote_build` |
| Build links | `get_build_links` | `set_build_links` |
| Search | `search` | — |
| GraphQL | `graphql_query` ✝ | — |

> ✝ `graphql_query` is always registered but rejects requests whose query string starts with `mutation` when `YONTRACK_MUTATIONS_ENABLED` is not set.

## Installation

### Cursor

Create or edit `.cursor/mcp.json` in your project (or `~/.cursor/mcp.json` for a global configuration):

```json
{
  "mcpServers": {
    "yontrack": {
      "command": "npx",
      "args": ["-y", "yontrack-mcp@latest", "stdio"],
      "env": {
        "YONTRACK_URL": "https://your-ontrack-instance",
        "YONTRACK_TOKEN": "your-api-token"
      }
    }
  }
}
```

Cursor will start the server automatically as a subprocess when needed.

### VSCode and IntelliJ

**VSCode** — create or edit `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "yontrack": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "yontrack-mcp@latest", "stdio"],
      "env": {
        "YONTRACK_URL": "https://your-ontrack-instance",
        "YONTRACK_TOKEN": "your-api-token"
      }
    }
  }
}
```

**IntelliJ IDEA** — open **Settings → Tools → AI Assistant → Model Context Protocol (MCP)**, click **+**, and configure:
- Command: `npx`
- Arguments: `-y yontrack-mcp@latest stdio`
- Environment: `YONTRACK_URL=https://your-ontrack-instance`, `YONTRACK_TOKEN=your-api-token`

### Claude Desktop

Add the server to your Claude Desktop configuration file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "yontrack": {
      "command": "npx",
      "args": ["-y", "yontrack-mcp@latest", "stdio"],
      "env": {
        "YONTRACK_URL": "https://your-ontrack-instance",
        "YONTRACK_TOKEN": "your-api-token"
      }
    }
  }
}
```

### Helm

A Helm chart is published to Docker Hub as an OCI image alongside every release:

```
oci://registry-1.docker.io/nemerosa/yontrack-mcp-chart
```

#### Install

```bash
helm install yontrack-mcp \
  oci://registry-1.docker.io/nemerosa/yontrack-mcp-chart \
  --version <version> \
  --set yontrack.url=https://your-ontrack-instance \
  --set yontrack.token=your-api-token
```

#### Configuration

| Value | Description | Default |
|---|---|---|
| `yontrack.url` | URL of the Yontrack instance | `""` |
| `yontrack.token` | Yontrack API token | `""` |
| `yontrack.mutationsEnabled` | Enable mutation tools (create/promote/link operations) | `false` |
| `oauth.serverUrl` | Public HTTPS URL of this server — enables OAuth2 when set with `oauth.authPassword` | `""` |
| `oauth.authPassword` | Password for the browser authorization form — enables OAuth2 when set with `oauth.serverUrl` | `""` |
| `persistence.enabled` | Create a PVC and mount it at `/data`; sets the clients file to `/data/clients.json` | `true` |
| `persistence.size` | PVC size | `10Mi` |
| `persistence.storageClass` | Storage class name (empty = cluster default) | `""` |
| `persistence.accessMode` | PVC access mode | `ReadWriteOnce` |
| `existingSecret` | Name of a pre-existing Secret (skips Secret creation) | `""` |
| `externalSecrets.enabled` | Render an `ExternalSecret` CRD instead of creating a Secret | `false` |
| `externalSecrets.refreshInterval` | How often ESO refreshes credentials from the backend | `"1h"` |
| `externalSecrets.secretStoreRef.name` | Name of the `SecretStore` or `ClusterSecretStore` | `""` |
| `externalSecrets.secretStoreRef.kind` | Kind of the store (`SecretStore` or `ClusterSecretStore`) | `SecretStore` |
| `externalSecrets.data.yontrackToken.key` | Backend path for `YONTRACK_TOKEN` | `""` |
| `externalSecrets.data.yontrackToken.property` | Sub-field within the backend entry (leave empty for the whole value) | `""` |
| `externalSecrets.data.authPassword.key` | Backend path for `YONTRACK_MCP_AUTH_PASSWORD` (OAuth2 only) | `""` |
| `externalSecrets.data.authPassword.property` | Sub-field within the backend entry (leave empty for the whole value) | `""` |
| `service.type` | Kubernetes Service type | `ClusterIP` |
| `service.port` | Service port | `3000` |
| `ingress.enabled` | Enable Ingress resource | `false` |
| `ingress.className` | Ingress class name | `""` |
| `ingress.hosts` | Ingress host rules | see `values.yaml` |
| `replicaCount` | Number of pod replicas | `1` |
| `image.tag` | Image tag override (defaults to chart `appVersion`) | `""` |
| `resources` | Pod resource requests/limits | `{}` |

#### Secret management

The chart supports three mutually exclusive modes for injecting credentials. `existingSecret` takes precedence over `externalSecrets.enabled`; if neither is set the chart creates the Secret itself.

**Chart-managed Secret (default)**

Credentials are taken from `yontrack.token` and `oauth.authPassword` in `values.yaml` and written into a Kubernetes Secret by the chart:

```bash
helm install yontrack-mcp \
  oci://registry-1.docker.io/nemerosa/yontrack-mcp-chart \
  --version <version> \
  --set yontrack.url=https://your-ontrack-instance \
  --set yontrack.token=your-api-token
```

**Existing Secret**

Point the chart to a pre-created Secret (e.g. created by Sealed Secrets or manually). The Secret must contain:

- `YONTRACK_TOKEN`
- `YONTRACK_MCP_AUTH_PASSWORD` (when OAuth2 is enabled)

```bash
helm install yontrack-mcp \
  oci://registry-1.docker.io/nemerosa/yontrack-mcp-chart \
  --version <version> \
  --set yontrack.url=https://your-ontrack-instance \
  --set existingSecret=my-yontrack-secret
```

**External Secrets Operator (ESO)**

When [ESO](https://external-secrets.io) is installed in the cluster, the chart can render an `ExternalSecret` CRD that instructs ESO to fetch credentials from an external backend (e.g. HashiCorp Vault, AWS Secrets Manager) and write them into a Kubernetes Secret automatically.

```yaml
externalSecrets:
  enabled: true
  refreshInterval: "1h"
  secretStoreRef:
    name: vault-store        # name of your SecretStore / ClusterSecretStore
    kind: SecretStore        # or ClusterSecretStore
  data:
    yontrackToken:
      key: secret/yontrack   # path in the backend
      property: token        # sub-field (omit if the whole entry is the value)
    authPassword:            # only needed when OAuth2 is enabled
      key: secret/yontrack
      property: authPassword
```

The `ExternalSecret` targets the same Secret name the chart would otherwise create, so the Deployment references it transparently.

#### Ingress example

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

### Claude AI

Claude.ai requires OAuth2 for remote MCP servers. Start the server with the two additional OAuth environment variables:

```bash
docker run -d --name yontrack-mcp \
  -e YONTRACK_URL=https://your-ontrack-instance \
  -e YONTRACK_TOKEN=your-api-token \
  -e YONTRACK_MCP_SERVER_URL=https://mcp.example.com \
  -e YONTRACK_MCP_AUTH_PASSWORD=some-strong-password \
  -p 3000:3000 \
  nemerosa/yontrack-mcp:latest
```

Both `YONTRACK_MCP_SERVER_URL` and `YONTRACK_MCP_AUTH_PASSWORD` must be set together; either alone is ignored and the server starts without authentication.

**First-time connection flow:**

1. In Claude.ai go to **Settings → Integrations** and add `https://mcp.example.com/mcp` as a new integration.
2. Claude.ai auto-discovers the OAuth2 endpoints via `/.well-known/oauth-authorization-server`.
3. Claude.ai registers itself as a client automatically (dynamic client registration — no manual client ID/secret needed).
4. You are redirected to the server's authorization page where you enter the configured password.
5. After approval, Claude.ai receives a Bearer token valid for 1 hour (refresh tokens last 30 days).
6. Subsequent requests use the token silently; you re-authorize only after the refresh token expires.

> **HTTPS required.** `YONTRACK_MCP_SERVER_URL` must use `https://`. For local testing only, `http://localhost` is also accepted.

> **Tokens are in-memory.** All issued tokens are lost when the server restarts. Users will be prompted to re-authorize after a restart.

## Configuration

### Read-only mode

By default the server runs in read-only mode: only query tools are registered and no data can be modified. This is the recommended mode when the AI assistant only needs to inspect CI/CD state.

To also expose the mutation tools (create projects, branches, builds, validation stamps/runs, promotion levels/runs, and build links), set:

```bash
YONTRACK_MUTATIONS_ENABLED=true
```

### Yontrack API token

An API token is required to authenticate against Yontrack. To generate one, log in to your Yontrack instance, open your user menu, and go to **User tokens**. Create a new token and copy it — it will not be shown again.

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `YONTRACK_URL` | Yes | — | URL of the Yontrack instance (e.g. `https://ontrack.example.com`) |
| `YONTRACK_TOKEN` | Yes | — | API token for authenticating against Yontrack |
| `YONTRACK_MUTATIONS_ENABLED` | No | `false` | Set to `true` to enable mutation tools (create/promote/link operations). When unset or `false`, only read-only query tools are registered. |
| `YONTRACK_MCP_SERVER_URL` | No | — | Public HTTPS URL of this server. When set together with `YONTRACK_MCP_AUTH_PASSWORD`, enables OAuth2 (required for claude.ai). |
| `YONTRACK_MCP_AUTH_PASSWORD` | No | — | Password users must enter in the browser authorization form. Required together with `YONTRACK_MCP_SERVER_URL` to enable OAuth2. |
| `YONTRACK_MCP_CLIENTS_FILE` | No | `./yontrack-mcp-clients.json` | File path where registered OAuth2 clients are persisted so they survive restarts. The Helm chart sets this automatically to `/data/clients.json` when `persistence.enabled` is true. |
| `PORT` | No | `3000` | Port the HTTP server listens on |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, running tests, and interactive testing with MCP Inspector.
