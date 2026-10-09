# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build       # Compile TypeScript → ./build/ (also makes index.js executable)
npm run dev         # Watch mode with tsx (no compilation)
npm run typecheck   # Type-check without emitting
npm run start       # Run compiled server
npm test            # Run unit tests (Vitest, no live instance needed)
npm run test:watch  # Vitest in watch mode
```

Before running the server, set required environment variables:
```bash
export YONTRACK_URL=https://your-instance
export YONTRACK_TOKEN=your-token
export YONTRACK_MUTATIONS_ENABLED=true              # optional; enables mutation tools (default: false)
export YONTRACK_MCP_SERVER_URL=https://example.com  # optional; enables OAuth2 when set with AUTH_PASSWORD
export YONTRACK_MCP_AUTH_PASSWORD=secret            # optional; enables OAuth2 when set with SERVER_URL
export YONTRACK_AGENT_TOOLS=auto                    # optional; auto|true|false — agent-context tools (Yontrack 6)
export YONTRACK_UI_URL=https://your-instance        # optional; UI links in the agent-context tools
export YONTRACK_AGENT_SESSION=...                   # optional; agent session sent when the MCP request has none
export YONTRACK_AGENT_SESSION_LINK=https://...      # optional; link of that session
```

## Architecture

This is a TypeScript MCP server that exposes Yontrack (Ontrack CI/CD platform) functionality via its GraphQL API. It uses `@modelcontextprotocol/sdk` for the MCP protocol, `graphql-request` for GraphQL calls, and `zod` for input validation.

**Entry flow:** `src/index.ts` (awaits `getCapabilities()`) → `src/server.ts` (creates McpServer via factory) → `src/tools/index.ts` (registers all tools)

**Transport:** The server uses Streamable HTTP transport (`POST /mcp`) via an Express app. It listens on `PORT` (default `3000`). A `GET /health` endpoint is also served for liveness/readiness probes.

**Core modules:**
- `src/config.ts` — Validates `YONTRACK_URL` and `YONTRACK_TOKEN` env vars via Zod (exits on failure); also parses `YONTRACK_MUTATIONS_ENABLED` (optional boolean, default `false`) and exports `mutationsEnabled`; exports `oauthConfig` (non-null when both `YONTRACK_MCP_SERVER_URL` and `YONTRACK_MCP_AUTH_PASSWORD` are set)
- `src/client.ts` — Exports a `gqlClient` GraphQL client and `yontrackHeaders()`: `X-Ontrack-Token` plus the agent session headers, computed per request
- `src/session.ts` — Agent session (`X-Yontrack-Agent-Session[-Link]`): carried per MCP request through `AsyncLocalStorage` (`runWithAgentSession`), falling back to `YONTRACK_AGENT_SESSION[_LINK]`
- `src/capabilities.ts` — Probes the Yontrack schema for `Readiness` / `AgentPolicy` (cached per process, errors not cached) to gate the Yontrack 6 tools; `YONTRACK_AGENT_TOOLS` overrides it (see `docs/adr/0001-agent-context-tools-v6-only.md`). Also probes `SearchResults` to select the search API, which the override does not affect (`docs/adr/0002-search-api-by-capability.md`)
- `src/server.ts` — Exports `createServer(serverUrl, capabilities)` factory; called once per HTTP request (stateless)
- `src/auth.ts` — OAuth2 provider implementation (in-memory token stores, HTML authorization form, PKCE support); exports `createOAuthProvider`, `clientsStore`, `generateAuthCode`, `renderAuthFormHtml`
- `src/utils.ts` — `resolveBranchId(project, branch)` helper that resolves names to a branch ID (required for some mutations)

**OAuth2 flow (when `oauthConfig` is set):**
- `POST /authorize/login` (registered first to avoid body-stream conflict with SDK's `/authorize` prefix handler)
- `app.use(mcpAuthRouter(...))` — mounts `/.well-known/oauth-authorization-server`, `/authorize`, `/token`, `/register`, `/revoke`
- `/mcp` is protected by `requireBearerAuth` middleware from the SDK

**Tools** (28 total across 11 files in `src/tools/`): projects, branches, builds, validation stamps, validation runs, promotion levels, promotion runs, build links, search, GraphQL, and the agent-context tools (`agent-context.ts`, Yontrack 6 only: `build_readiness`, `changes_since_deployed`, `deployments`, `dependency_builds_at_level`, `agent_policy`). Anything added for Yontrack 6 only goes behind `Capabilities`, never registered unconditionally. The search tools use `search(query, types)` on Yontrack 6 (`search-results.ts`) and `search(token, type)` on Yontrack 5 (`search.ts`), keeping the same output shape.

Each tool file follows a consistent pattern: define GraphQL strings → call `server.tool()` with a Zod input schema → async handler → check the `errors` array of the mutation payload (Yontrack has no `userErrors` field). `src/graphql-documents.test.ts` validates every query and mutation against both schema snapshots.

## Versioning & releases

Releases are fully automated via [semantic-release](https://semantic-release.gitbook.io). On every push to `main`, it analyses commits since the last release, computes the next version, updates `package.json` and `CHANGELOG.md`, and creates a GitHub release. No manual step required.

Commits to `main` must follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Effect |
|---|---|
| `fix:` | patch bump (1.0.x) |
| `feat:` | minor bump (1.x.0) |
| `feat!:` or `BREAKING CHANGE:` | major bump (x.0.0) |
| `chore:`, `docs:`, `test:`, etc. | no release |

The GitHub release is initially created as a draft and published only after both the Docker image and the Helm chart OCI image have been successfully pushed.

The Helm chart is packaged and pushed to `oci://registry-1.docker.io/nemerosa/yontrack-mcp-chart` with the same version as the Docker image. The `version` and `appVersion` in `helm/yontrack-mcp-chart/Chart.yaml` are set to `0.0.0` in the repository; CI overrides them at package time via `helm package --version $VERSION --app-version $VERSION`.

## Helm chart

The chart lives in `helm/yontrack-mcp-chart/`. Key files:

- `Chart.yaml` — `version`/`appVersion` are `0.0.0` placeholders; overridden by CI at release time
- `values.yaml` — configures `yontrack.url`, `yontrack.token`, `yontrack.mutationsEnabled`, `oauth.serverUrl`, `oauth.authPassword`, `existingSecret`, ingress, resources
- `templates/secret.yaml` — only rendered when `existingSecret` is empty; holds `YONTRACK_TOKEN` and (when OAuth is enabled) `YONTRACK_MCP_AUTH_PASSWORD`
- `templates/deployment.yaml` — sets `PORT=3000`, injects OAuth env vars when `oauth.serverUrl` is non-empty, references the secret via `yontrack-mcp-chart.secretName` helper (resolves to `existingSecret` or the chart-managed secret)
- `templates/_helpers.tpl` — defines `yontrack-mcp-chart.secretName` in addition to the standard name/label helpers

## Yontrack GraphQL API Gotchas

The full schemas are in `yontrack-v5.graphql` and `yontrack-v6.graphql` (a snapshot of Yontrack's `main`, to refresh at each 6.x release); the `yontrack://schema` resource serves the one matching the detected version. Key input field quirks to watch for when adding/modifying tools:

- Mutation payloads expose `errors { message }` (not `userErrors`); agent-policy refusals come back there too
- `createBranch` input uses `projectName` (not `project`)
- `createBuild` input uses `projectName` + `branchName`
- Creating validation stamps and promotion levels requires `branchId` — use `resolveBranchId()` from `src/utils.ts`
- `createValidationRun` input field is `validationRunStatus` (not `status`)
- Build dependency queries use `usingQualified` / `usedByQualified` fields (not `using` / `usedBy`)
- `linksBuild` mutation uses `fromProject` + `fromBuild` only (no `fromBranch`); link items use `project` + `build` + optional `qualifier`
- (V6) `Build.readiness(promotionLevel | slotId)` takes exactly one of the two; slots are resolved by name through `Build.slots(environment, qualifier)` (qualifier `""` is the default slot)
- `search(token, type)` (v5: `type` required) is deprecated on v6 for `search(query, types)` returning `SearchResults { items, total, capped, message }`
- `builds(buildBranchFilter: ...)` requires `branch`; across a project use `buildProjectFilter: { promotionName, maximumCount }`
- `scmChangeLog(from, to)` takes build IDs as `Int`, while `Build.id` comes back as an `ID` string

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on `yontrack/yontrack-mcp` (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
