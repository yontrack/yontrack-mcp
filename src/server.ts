import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/index.js";
import type { Capabilities } from "./capabilities.js";

const INSTRUCTIONS = `
Use the specific tools (list_projects, get_build, etc.) for simple, single-entity lookups.
When a task would require calling multiple tools in a loop — for example fetching builds across many branches, or collecting validation runs for a list of builds — use graphql_query instead to retrieve all needed data in a single round-trip.
Read the yontrack://schema resource before writing a GraphQL query to understand available types and fields.
When displaying branches, builds, or other entities to the user, always prefer the displayName field over the name field.
When displaying promotion levels (in any form: list, table, chart, or graph), always fetch their image using get_promotion_level_image for each level whose image field is true, and embed the returned base64 data directly as a data URI (e.g. <img src="data:image/png;base64,...">) alongside the promotion level name. Do not reference the MCP server URL for images as it is not accessible from the browser.
`.trim();

const AGENT_CONTEXT_INSTRUCTIONS = `
To know whether a build is ready for a promotion level or a slot, what changed since what is deployed, what is deployed where, or which dependency builds are at a level, prefer build_readiness, changes_since_deployed, deployments and dependency_builds_at_level over graphql_query.
`.trim();

const AGENT_POLICY_INSTRUCTIONS = `
To know what the agent behind the current token may do on a project (promote, deploy, record evidence), use agent_policy.
`.trim();

export function createServer(serverUrl: string | undefined, capabilities: Capabilities): McpServer {
  const server = new McpServer(
    {
      name: "yontrack",
      version: "1.0.0",
      ...(serverUrl && {
        icons: [{ src: `${serverUrl}/yontrack.png`, mimeType: "image/png" }],
      }),
    },
    {
      instructions: [
        INSTRUCTIONS,
        ...(capabilities.agentTools ? [AGENT_CONTEXT_INSTRUCTIONS] : []),
        ...(capabilities.agentPolicy ? [AGENT_POLICY_INSTRUCTIONS] : []),
      ].join("\n"),
    }
  );
  registerAllTools(server, capabilities);
  return server;
}
