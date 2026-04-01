#!/usr/bin/env node
import { createServer as createHttpServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";

const port = parseInt(process.env.PORT ?? "3000", 10);

const httpServer = createHttpServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (pathname === "/mcp") {
    let body: unknown;
    if (req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const raw = Buffer.concat(chunks).toString();
      if (raw) body = JSON.parse(raw);
    }
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
    return;
  }

  res.writeHead(404);
  res.end();
});

httpServer.listen(port, () => {
  process.stderr.write(`MCP server listening on port ${port}\n`);
});
