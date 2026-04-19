import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gqlClient } from "../client.js";
import { config } from "../config.js";
import { resolveBranchId } from "../utils.js";

const LIST_PROMOTION_LEVELS = `
  query ListPromotionLevels($project: String!, $branch: String!) {
    branches(project: $project, name: $branch) {
      promotionLevels {
        id
        name
        description
        image
      }
    }
  }
`;

const CREATE_PROMOTION_LEVEL = `
  mutation CreatePromotionLevelById(
    $branchId: Int!
    $name: String!
    $description: String!
  ) {
    createPromotionLevelById(input: {
      branchId: $branchId
      name: $name
      description: $description
    }) {
      promotionLevel { id name description branch { id name } }
      userErrors { message }
    }
  }
`;

export function registerPromotionLevelTools(server: McpServer, allowMutations: boolean) {
  server.tool(
    "list_promotion_levels",
    "List all promotion levels for a branch",
    {
      project: z.string().describe("Project name"),
      branch: z.string().describe("Branch name"),
    },
    async ({ project, branch }) => {
      const data = await gqlClient.request<{
        branches: Array<{ promotionLevels: unknown[] }>;
      }>(LIST_PROMOTION_LEVELS, { project, branch });

      const levels = data.branches?.[0]?.promotionLevels ?? [];
      return {
        content: [{ type: "text", text: JSON.stringify(levels, null, 2) }],
      };
    }
  );

  server.tool(
    "get_promotion_level_image",
    "Fetch the PNG image for a promotion level. Returns an image if the promotion level has one, or an error text if it does not.",
    {
      promotionLevelId: z.number().int().describe("Numeric ID of the promotion level"),
    },
    async ({ promotionLevelId }) => {
      const url = `${config.YONTRACK_URL}/rest/structure/promotionLevels/${promotionLevelId}/image`;
      const response = await fetch(url, {
        headers: { "X-Ontrack-Token": config.YONTRACK_TOKEN },
      });
      if (!response.ok) {
        return {
          isError: true,
          content: [{ type: "text", text: `No image available for promotion level ${promotionLevelId} (HTTP ${response.status})` }],
        };
      }
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      return {
        content: [{ type: "image", data: base64, mimeType: "image/png" }],
      };
    }
  );

  if (allowMutations) server.tool(
    "create_promotion_level",
    "Create a new promotion level on a branch",
    {
      project: z.string().describe("Project name"),
      branch: z.string().describe("Branch name"),
      name: z.string().describe("Promotion level name (e.g. 'GOLD', 'SILVER')"),
      description: z.string().optional().default("").describe("Description"),
    },
    async ({ project, branch, name, description }) => {
      const branchId = await resolveBranchId(project, branch);
      const data = await gqlClient.request<{
        createPromotionLevelById: { promotionLevel: unknown; userErrors: { message: string }[] };
      }>(CREATE_PROMOTION_LEVEL, { branchId, name, description });

      const { promotionLevel, userErrors } = data.createPromotionLevelById;
      if (userErrors?.length) {
        return {
          isError: true,
          content: [{ type: "text", text: userErrors.map((e) => e.message).join(", ") }],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(promotionLevel, null, 2) }],
      };
    }
  );
}
