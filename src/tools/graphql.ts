import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DocumentNode, GraphQLError, Kind, OperationTypeNode, parse } from "graphql";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gqlClient } from "../client.js";

// Resolve to the schema files at the package root, both in dev (src/tools/) and built (build/tools/)
function readSchema(file: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${file}`, import.meta.url)), "utf-8");
}

const schemaV5 = readSchema("yontrack-v5.graphql");
// Snapshot of the Yontrack 6 schema, to be refreshed at each 6.x release
const schemaV6 = readSchema("yontrack-v6.graphql");

/** Why read-only mode refuses this document, if it does: only documents made of queries can run. */
function readOnlyRefusal(query: string): string | undefined {
  let document: DocumentNode;
  try {
    document = parse(query);
  } catch (error) {
    if (error instanceof GraphQLError) return error.message;
    throw error;
  }
  const writes = document.definitions.some(
    (definition) => definition.kind === Kind.OPERATION_DEFINITION && definition.operation !== OperationTypeNode.QUERY
  );
  return writes ? "Mutations are disabled. Set YONTRACK_MUTATIONS_ENABLED=true to allow them." : undefined;
}

/** `v6` is true when the connected Yontrack is detected as a Yontrack 6 (see src/capabilities.ts). */
export function registerGraphQLTools(server: McpServer, allowMutations: boolean, v6 = false) {
  const schemaContent = v6 ? schemaV6 : schemaV5;
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
      const refusal = allowMutations ? undefined : readOnlyRefusal(query);
      if (refusal) {
        return {
          isError: true,
          content: [{ type: "text", text: refusal }],
        };
      }
      const data = await gqlClient.request(query, variables ?? {});
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
