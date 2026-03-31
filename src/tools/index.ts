import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProjectTools } from "./projects.js";
import { registerBranchTools } from "./branches.js";
import { registerBuildTools } from "./builds.js";
import { registerValidationStampTools } from "./validation-stamps.js";
import { registerValidationRunTools } from "./validation-runs.js";
import { registerPromotionLevelTools } from "./promotion-levels.js";
import { registerPromotionRunTools } from "./promotion-runs.js";
import { registerBuildLinkTools } from "./build-links.js";
import { registerSearchTools } from "./search.js";

export function registerAllTools(server: McpServer) {
  registerProjectTools(server);
  registerBranchTools(server);
  registerBuildTools(server);
  registerValidationStampTools(server);
  registerValidationRunTools(server);
  registerPromotionLevelTools(server);
  registerPromotionRunTools(server);
  registerBuildLinkTools(server);
  registerSearchTools(server);
}
