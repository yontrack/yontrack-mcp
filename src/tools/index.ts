import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mutationsEnabled } from "../config.js";
import { registerProjectTools } from "./projects.js";
import { registerBranchTools } from "./branches.js";
import { registerBuildTools } from "./builds.js";
import { registerValidationStampTools } from "./validation-stamps.js";
import { registerValidationRunTools } from "./validation-runs.js";
import { registerPromotionLevelTools } from "./promotion-levels.js";
import { registerPromotionRunTools } from "./promotion-runs.js";
import { registerBuildLinkTools } from "./build-links.js";
import { registerSearchTools } from "./search.js";
import { registerGraphQLTools } from "./graphql.js";

export function registerAllTools(server: McpServer) {
  registerProjectTools(server, mutationsEnabled);
  registerBranchTools(server, mutationsEnabled);
  registerBuildTools(server, mutationsEnabled);
  registerValidationStampTools(server, mutationsEnabled);
  registerValidationRunTools(server, mutationsEnabled);
  registerPromotionLevelTools(server, mutationsEnabled);
  registerPromotionRunTools(server, mutationsEnabled);
  registerBuildLinkTools(server, mutationsEnabled);
  registerSearchTools(server);
  registerGraphQLTools(server, mutationsEnabled);
}
