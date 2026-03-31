# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build       # Compile TypeScript → ./build/ (also makes index.js executable)
npm run dev         # Watch mode with tsx (no compilation)
npm run typecheck   # Type-check without emitting
npm run start       # Run compiled server
```

No test framework is configured. Before running the server, set required environment variables:
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

## Yontrack GraphQL API Gotchas

The full schema is in `yontrack.graphql`. Key input field quirks to watch for when adding/modifying tools:

- `createBranch` input uses `projectName` (not `project`)
- `createBuild` input uses `projectName` + `branchName`
- Creating validation stamps and promotion levels requires `branchId` — use `resolveBranchId()` from `src/utils.ts`
- `createValidationRun` input field is `validationRunStatus` (not `status`)
- Build dependency queries use `usingQualified` / `usedByQualified` fields (not `using` / `usedBy`)
- `linksBuild` mutation uses `fromProject` + `fromBuild` only (no `fromBranch`); link items use `project` + `build` + optional `qualifier`
