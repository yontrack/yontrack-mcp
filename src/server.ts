import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/index.js";

export function createServer(serverUrl?: string): McpServer {
  const server = new McpServer(
    {
      name: "yontrack",
      version: "1.0.0",
      ...(serverUrl && {
        icons: [{ src: `${serverUrl}/yontrack.png`, mimeType: "image/png" }],
      }),
    },
    {
      instructions: `
Use the specific tools (list_projects, get_build, etc.) for simple, single-entity lookups.
When a task would require calling multiple tools in a loop — for example fetching builds across many branches, or collecting validation runs for a list of builds — use graphql_query instead to retrieve all needed data in a single round-trip.
Read the yontrack://schema resource before writing a GraphQL query to understand available types and fields.
When displaying branches, builds, or other entities to the user, always prefer the displayName field over the name field.
When displaying promotion levels (in any form: list, table, chart, or graph), always fetch their image using get_promotion_level_image for each level whose image field is true, and render the returned image alongside the promotion level name.
      `.trim(),
    }
  );
  registerAllTools(server);
  return server;
}
