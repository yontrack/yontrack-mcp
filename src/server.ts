import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/index.js";

export function createServer(): McpServer {
  const server = new McpServer(
    { name: "yontrack", version: "1.0.0" },
    {
      instructions: `
Use the specific tools (list_projects, get_build, etc.) for simple, single-entity lookups.
When a task would require calling multiple tools in a loop — for example fetching builds across many branches, or collecting validation runs for a list of builds — use graphql_query instead to retrieve all needed data in a single round-trip.
Read the yontrack://schema resource before writing a GraphQL query to understand available types and fields.
When displaying branches, builds, or other entities to the user, always prefer the displayName field over the name field.
      `.trim(),
    }
  );
  registerAllTools(server);
  return server;
}
