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

## CI secrets setup

The release workflow requires two repository secrets, and npm trusted publishing. Add the secrets under **Settings → Secrets and variables → Actions → New repository secret** in the GitHub repository.

### npm trusted publishing

The `npm-publish` job publishes the package to npmjs.com with [trusted publishing](https://docs.npmjs.com/trusted-publishers): npm authenticates the GitHub Actions job through OIDC, so there is no npm token to store or rotate.

1. Log in to [npmjs.com](https://www.npmjs.com) and open the `yontrack-mcp` package → **Settings** → **Trusted publishing**
2. Choose **GitHub Actions** and fill in:
   - **Organization or user**: `yontrack`
   - **Repository**: `yontrack-mcp`
   - **Workflow filename**: `ci.yml`
   - **Environment**: leave empty
3. Save. Optionally, under **Publishing access**, require two-factor authentication and disallow tokens, so that only the workflow can publish.

The job needs `id-token: write` and npm 11.5.1 or later (both set in `ci.yml`), and the `repository` field of `package.json` must match the GitHub repository.

### DOCKERHUB_USERNAME and DOCKERHUB_TOKEN

Required by the `docker` job to push images to Docker Hub.

1. Log in to [hub.docker.com](https://hub.docker.com)
2. Click your avatar → **My Account** → **Security** → **New Access Token**
3. Give it read/write access and copy the token
4. Add two repository secrets:
   - `DOCKERHUB_USERNAME` — your Docker Hub username
   - `DOCKERHUB_TOKEN` — the access token
