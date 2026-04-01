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
| `existingSecret` | Name of a pre-existing Secret (skips Secret creation) | `""` |
| `oidc.enabled` | Enable OIDC env vars injection | `false` |
| `oidc.issuerUrl` | OIDC issuer URL | `""` |
| `oidc.clientId` | OAuth client ID | `""` |
| `oidc.clientSecret` | OAuth client secret | `""` |
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
- `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` (only required when `oidc.enabled: true`)

```bash
helm install yontrack-mcp \
  oci://registry-1.docker.io/nemerosa/yontrack-mcp-chart \
  --version <version> \
  --set yontrack.url=https://your-ontrack-instance \
  --set existingSecret=my-yontrack-secret
```

### Ingress example

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
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

The MCP endpoint is then available at `https://mcp.example.com/mcp`.

### OIDC example

```yaml
yontrack:
  url: https://your-ontrack-instance
oidc:
  enabled: true
  issuerUrl: https://idp.example.com/realms/myrealm
existingSecret: my-yontrack-secret  # must contain YONTRACK_TOKEN, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET
```

## Usage with Claude Desktop / Claude.ai

The server exposes a Streamable HTTP transport (MCP spec 2025-03-26) on `POST /mcp`. Start it locally:

```bash
YONTRACK_URL=https://your-ontrack-instance YONTRACK_TOKEN=your-api-token npm start
# or with a custom port:
PORT=8080 YONTRACK_URL=... YONTRACK_TOKEN=... npm start
```

Then register it in your MCP client as a remote server pointing to `http://localhost:3000/mcp`.

For Claude.ai, add it under **Settings → Integrations** using the public URL of your deployed instance (e.g. `https://mcp.example.com/mcp`).

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
