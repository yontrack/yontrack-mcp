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

**Entry flow:** `src/index.ts` → `src/server.ts` (creates McpServer) → `src/tools/index.ts` (registers all tools)

**Core modules:**
- `src/config.ts` — Validates `YONTRACK_URL` and `YONTRACK_TOKEN` env vars via Zod; exits process on failure
- `src/client.ts` — Exports a `gqlClient` GraphQL client authenticated via `X-Ontrack-Token` header
- `src/utils.ts` — `resolveBranchId(project, branch)` helper that resolves names to a branch ID (required for some mutations)

**Tools** (24 total across 9 files in `src/tools/`): projects, branches, builds, validation stamps, validation runs, promotion levels, promotion runs, build links, search.

Each tool file follows a consistent pattern: define GraphQL strings → call `server.tool()` with a Zod input schema → async handler → check `userErrors` array on mutations.

## Versioning & releases

Releases are automated via [Release Please](https://github.com/googleapis/release-please). It reads commit messages to determine the version bump and generates `CHANGELOG.md`.

Commits to `main` must follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Effect |
|---|---|
| `fix:` | patch bump (1.0.x) |
| `feat:` | minor bump (1.x.0) |
| `feat!:` or `BREAKING CHANGE:` | major bump (x.0.0) |
| `chore:`, `docs:`, `test:`, etc. | no release |

Release Please opens a PR that updates `package.json` and `CHANGELOG.md`. Merging it triggers the GitHub release and pushes a versioned Docker image tag.

## Yontrack GraphQL API Gotchas

The full schema is in `yontrack.graphql`. Key input field quirks to watch for when adding/modifying tools:

- `createBranch` input uses `projectName` (not `project`)
- `createBuild` input uses `projectName` + `branchName`
- Creating validation stamps and promotion levels requires `branchId` — use `resolveBranchId()` from `src/utils.ts`
- `createValidationRun` input field is `validationRunStatus` (not `status`)
- Build dependency queries use `usingQualified` / `usedByQualified` fields (not `using` / `usedBy`)
- `linksBuild` mutation uses `fromProject` + `fromBuild` only (no `fromBranch`); link items use `project` + `build` + optional `qualifier`
