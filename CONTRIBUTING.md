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

The release workflow requires three repository secrets. Add them under **Settings → Secrets and variables → Actions → New repository secret** in the GitHub repository.

### NPM_TOKEN

Required by the `npm-publish` job to publish the package to npmjs.com.

1. Log in to [npmjs.com](https://www.npmjs.com)
2. Click your avatar → **Access Tokens** → **Generate New Token** → **Granular Access Token**
3. Fill in the form:
   - **Token name**: e.g. `yontrack-mcp CI`
   - **Expiration**: choose a duration appropriate for your CI setup (e.g. 1 year)
   - **Packages and scopes**: set to **Read and write**
     - For the **first publish** (package does not exist on npm yet): choose **All packages**
     - After the package exists: rotate the token and choose **Only select packages and scopes** → `yontrack-mcp`
4. Click **Generate token** and copy it (shown only once)
5. Add it as a repository secret named `NPM_TOKEN`

### DOCKERHUB_USERNAME and DOCKERHUB_TOKEN

Required by the `docker` job to push images to Docker Hub.

1. Log in to [hub.docker.com](https://hub.docker.com)
2. Click your avatar → **My Account** → **Security** → **New Access Token**
3. Give it read/write access and copy the token
4. Add two repository secrets:
   - `DOCKERHUB_USERNAME` — your Docker Hub username
   - `DOCKERHUB_TOKEN` — the access token
