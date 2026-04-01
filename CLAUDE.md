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
```

## Architecture

This is a TypeScript MCP server that exposes Yontrack (Ontrack CI/CD platform) functionality via its GraphQL API. It uses `@modelcontextprotocol/sdk` for the MCP protocol, `graphql-request` for GraphQL calls, and `zod` for input validation.

**Entry flow:** `src/index.ts` → `src/server.ts` (creates McpServer via factory) → `src/tools/index.ts` (registers all tools)

**Transport:** The server always uses Streamable HTTP transport (`POST /mcp`). It listens on `PORT` (default `3000`). A `GET /health` endpoint is also served for liveness/readiness probes.

**Core modules:**
- `src/config.ts` — Validates `YONTRACK_URL` and `YONTRACK_TOKEN` env vars via Zod; exits process on failure
- `src/client.ts` — Exports a `gqlClient` GraphQL client authenticated via `X-Ontrack-Token` header
- `src/server.ts` — Exports `createServer()` factory; called once per HTTP request (stateless) or once for stdio
- `src/utils.ts` — `resolveBranchId(project, branch)` helper that resolves names to a branch ID (required for some mutations)

**Tools** (24 total across 9 files in `src/tools/`): projects, branches, builds, validation stamps, validation runs, promotion levels, promotion runs, build links, search.

Each tool file follows a consistent pattern: define GraphQL strings → call `server.tool()` with a Zod input schema → async handler → check `userErrors` array on mutations.

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
- `values.yaml` — configures `yontrack.url`, `yontrack.token`, `oidc.*`, `existingSecret`, ingress, resources
- `templates/secret.yaml` — only rendered when `existingSecret` is empty; holds `YONTRACK_TOKEN`
- `templates/deployment.yaml` — sets `PORT=3000`, references the secret via `yontrack-mcp-chart.secretName` helper (resolves to `existingSecret` or the chart-managed secret)
- `templates/_helpers.tpl` — defines `yontrack-mcp-chart.secretName` in addition to the standard name/label helpers

## Yontrack GraphQL API Gotchas

The full schema is in `yontrack.graphql`. Key input field quirks to watch for when adding/modifying tools:

- `createBranch` input uses `projectName` (not `project`)
- `createBuild` input uses `projectName` + `branchName`
- Creating validation stamps and promotion levels requires `branchId` — use `resolveBranchId()` from `src/utils.ts`
- `createValidationRun` input field is `validationRunStatus` (not `status`)
- Build dependency queries use `usingQualified` / `usedByQualified` fields (not `using` / `usedBy`)
- `linksBuild` mutation uses `fromProject` + `fromBuild` only (no `fromBranch`); link items use `project` + `build` + optional `qualifier`
