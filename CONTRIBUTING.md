# Contributing

## Development setup

```bash
npm install
npm run build       # Compile TypeScript → ./build/
npm run dev         # Watch mode with tsx (no compilation)
npm run typecheck   # Type-check without emitting
```

Set the required environment variables before running the server:

```bash
export YONTRACK_URL=https://your-ontrack-instance
export YONTRACK_TOKEN=your-api-token
```

Then start the server:

```bash
npm start
```

## Unit tests

Tests use [Vitest](https://vitest.dev/) with a mocked GraphQL client. No running Yontrack instance is required.

```bash
npm test           # single run
npm run test:watch # watch mode
```

Tests live alongside the source files as `*.test.ts`. The helper in `src/test/helpers.ts` wires an in-process MCP client+server pair via `InMemoryTransport`, so tests exercise the full MCP protocol path without any network I/O.

## Interactive testing with MCP Inspector

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) provides a browser UI to browse and call tools against a real Yontrack instance:

```bash
YONTRACK_URL=https://your-ontrack-instance YONTRACK_TOKEN=your-token \
  npx @modelcontextprotocol/inspector node build/index.js
```
