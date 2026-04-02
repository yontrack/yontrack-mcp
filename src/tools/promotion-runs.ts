import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gqlClient } from "../client.js";

const GET_PROMOTION_RUNS = `
  query GetPromotionRuns(
    $project: String!
    $branch: String!
    $build: String!
    $promotion: String
  ) {
    builds(project: $project, branch: $branch, name: $build) {
      promotionRuns(promotion: $promotion) {
        id
        description
        creation { user time }
        promotionLevel { id name }
      }
    }
  }
`;

const PROMOTE_BUILD = `
  mutation PromoteBuild(
    $project: String!
    $branch: String!
    $build: String!
    $promotion: String!
    $description: String
  ) {
    createPromotionRun(input: {
      project: $project
      branch: $branch
      build: $build
      promotion: $promotion
      description: $description
    }) {
      promotionRun {
        id
        description
        creation { user time }
        promotionLevel { id name }
      }
      userErrors { message }
    }
  }
`;

export function registerPromotionRunTools(server: McpServer, allowMutations: boolean) {
  server.tool(
    "get_promotion_runs",
    "Get promotion runs for a build, optionally filtered by promotion level",
    {
      project: z.string().describe("Project name"),
      branch: z.string().describe("Branch name"),
      build: z.string().describe("Build name"),
      promotion: z.string().optional().describe("Filter by promotion level name"),
    },
    async ({ project, branch, build, promotion }) => {
      const data = await gqlClient.request<{
        builds: Array<{ promotionRuns: unknown[] }>;
      }>(GET_PROMOTION_RUNS, { project, branch, build, promotion });

      const runs = data.builds?.[0]?.promotionRuns ?? [];
      return {
        content: [{ type: "text", text: JSON.stringify(runs, null, 2) }],
      };
    }
  );

  if (allowMutations) server.tool(
    "promote_build",
    "Promote a build to a promotion level",
    {
      project: z.string().describe("Project name"),
      branch: z.string().describe("Branch name"),
      build: z.string().describe("Build name"),
      promotion: z.string().describe("Promotion level name"),
      description: z.string().optional().describe("Optional description"),
    },
    async ({ project, branch, build, promotion, description }) => {
      const data = await gqlClient.request<{
        createPromotionRun: { promotionRun: unknown; userErrors: { message: string }[] };
      }>(PROMOTE_BUILD, { project, branch, build, promotion, description });

      const { promotionRun, userErrors } = data.createPromotionRun;
      if (userErrors?.length) {
        return {
          isError: true,
          content: [{ type: "text", text: userErrors.map((e) => e.message).join(", ") }],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(promotionRun, null, 2) }],
      };
    }
  );
}
