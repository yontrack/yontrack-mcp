import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gqlClient } from "../client.js";

// Resolves to yontrack.graphql at the package root, both in dev (src/tools/) and built (build/tools/)
const schemaPath = fileURLToPath(new URL("../../yontrack.graphql", import.meta.url));
const schemaContent = readFileSync(schemaPath, "utf-8");

export function registerGraphQLTools(server: McpServer, allowMutations: boolean) {
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
    "Execute a raw GraphQL query against the Yontrack API. Prefer this over the simpler tools whenever: (1) no existing tool covers the exact data needed, (2) the task would otherwise require calling simpler tools in a loop (N+1 pattern — e.g. fetching validation runs for each of N builds), or (3) multiple related entities can be retrieved in a single round-trip (e.g. builds with their promotion runs and build links). Read the yontrack://schema resource first to understand available types and fields.",
    {
      query: z.string().describe("GraphQL query string"),
      variables: z.record(z.unknown()).optional().describe("Query variables"),
    },
    async ({ query, variables }) => {
      if (!allowMutations && /^\s*mutation\b/i.test(query)) {
        return {
          isError: true,
          content: [{ type: "text", text: "Mutations are disabled. Set YONTRACK_MUTATIONS_ENABLED=true to allow them." }],
        };
      }
      const data = await gqlClient.request(query, variables ?? {});
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
