import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gqlClient } from "../client.js";

// Resolves to yontrack.graphql at the package root, both in dev (src/tools/) and built (build/tools/)
const schemaPath = fileURLToPath(new URL("../../yontrack.graphql", import.meta.url));
const schemaContent = readFileSync(schemaPath, "utf-8");

export function registerGraphQLTools(server: McpServer) {
  server.resource(
    "yontrack-schema",
    "yontrack://schema",
    async (uri) => ({
      contents: [{
        uri: uri.href,
        text: schemaContent,
        mimeType: "text/plain",
      }],
    })
  );

  server.tool(
    "graphql_query",
    "Execute a raw GraphQL query against the Yontrack API. Use this when no existing tool covers your exact data needs — especially for queries that fetch multiple related entities in a single round-trip (e.g. builds with their promotion runs, validation runs, or build links). Read the yontrack://schema resource first to understand available fields.",
    {
      query: z.string().describe("GraphQL query string"),
      variables: z.record(z.unknown()).optional().describe("Query variables"),
    },
    async ({ query, variables }) => {
      const data = await gqlClient.request(query, variables ?? {});
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
