#!/usr/bin/env node
import express from "express";
import type { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { createServer } from "./server.js";
import { oauthConfig } from "./config.js";
import {
  createOAuthProvider,
  clientsStore,
  generateAuthCode,
  renderAuthFormHtml,
} from "./auth.js";

const port = parseInt(process.env.PORT ?? "3000", 10);
const app = express();

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// MCP request handler
async function handleMcp(req: Request, res: Response) {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on("close", () => transport.close());
  await server.connect(transport);
  // req.body is pre-parsed by express.json() for POST requests
  await transport.handleRequest(req as any, res as any, req.body);
}

if (oauthConfig) {
  const { serverUrl, authPassword } = oauthConfig;
  const provider = createOAuthProvider(serverUrl);

  // Login form submission must be registered BEFORE mcpAuthRouter because the
  // SDK's /authorize handler (prefix-matched) also runs urlencoded() middleware
  // which would consume the request body before our handler gets to it.
  app.post(
    "/authorize/login",
    express.urlencoded({ extended: false }),
    async (req, res) => {
      const {
        client_id,
        redirect_uri,
        code_challenge,
        scopes,
        state,
        password,
      } = req.body as Record<string, string>;

      const client = await clientsStore.getClient(client_id);
      if (!client) {
        res
          .status(400)
          .json({ error: "invalid_client", error_description: "Unknown client" });
        return;
      }

      if (!password || password !== authPassword) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(
          renderAuthFormHtml({
            serverUrl,
            clientName: client.client_name ?? client.client_id,
            clientId: client_id,
            redirectUri: redirect_uri ?? "",
            codeChallenge: code_challenge ?? "",
            scopes: scopes ?? "",
            state: state ?? "",
            error: "Invalid password. Please try again.",
          })
        );
        return;
      }

      const code = generateAuthCode({
        clientId: client_id,
        codeChallenge: code_challenge ?? "",
        redirectUri: redirect_uri ?? "",
        scopes: scopes ? scopes.split(" ").filter(Boolean) : [],
        state: state || undefined,
      });

      const redirectUrl = new URL(redirect_uri);
      redirectUrl.searchParams.set("code", code);
      if (state) redirectUrl.searchParams.set("state", state);
      res.redirect(302, redirectUrl.href);
    }
  );

  // OAuth2 discovery + token endpoints
  app.use(
    mcpAuthRouter({
      provider,
      issuerUrl: new URL(serverUrl),
      resourceName: "Yontrack MCP",
    })
  );

  // Protected MCP endpoint — requires a valid Bearer token
  app.all(
    "/mcp",
    express.json(),
    requireBearerAuth({ verifier: provider }),
    handleMcp
  );
} else {
  // No OAuth configured — MCP is accessible without authentication
  app.all("/mcp", express.json(), handleMcp);
}

app.listen(port, () => {
  process.stderr.write(`MCP server listening on port ${port}\n`);
  if (oauthConfig) {
    process.stderr.write(
      `OAuth2 enabled — issuer: ${oauthConfig.serverUrl}\n`
    );
  }
});
