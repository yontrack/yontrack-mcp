import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gqlClient } from "../client.js";

const LIST_BUILDS = `
  query ListBuilds($project: String!, $branch: String!, $count: Int) {
    branches(project: $project, name: $branch) {
      builds(count: $count) {
        id
        name
        displayName
        description
        creation { user time }
      }
    }
  }
`;

const FIND_BUILD = `
  query FindBuild($project: String!, $branch: String!, $name: String!) {
    builds(project: $project, branch: $branch, name: $name) {
      id
      name
      displayName
      description
      branch { id name displayName project { id name } }
      creation { user time }
      runInfo { sourceType sourceUri triggerType triggerData runTime }
    }
  }
`;

const GET_BUILD_DURATION = `
  query GetBuildDuration($project: String!, $branch: String!, $name: String!, $promotion: String!) {
    builds(project: $project, branch: $branch, name: $name) {
      creation { time }
      promotionRuns(promotion: $promotion) {
        creation { time }
      }
    }
  }
`;

const CREATE_BUILD = `
  mutation CreateBuild(
    $project: String!
    $branch: String!
    $name: String!
    $description: String
  ) {
    createBuild(input: {
      projectName: $project
      branchName: $branch
      name: $name
      description: $description
    }) {
      build { id name displayName description branch { id name displayName project { id name } } }
      userErrors { message }
    }
  }
`;

export function registerBuildTools(server: McpServer, allowMutations: boolean) {
  server.tool(
    "list_builds",
    "List builds for a branch",
    {
      project: z.string().describe("Project name"),
      branch: z.string().describe("Branch name"),
      count: z.number().int().optional().default(10).describe("Max number of builds to return"),
    },
    async ({ project, branch, count }) => {
      const data = await gqlClient.request<{
        branches: Array<{ builds: unknown[] }>;
      }>(LIST_BUILDS, { project, branch, count });

      const builds = data.branches?.[0]?.builds ?? [];
      return {
        content: [{ type: "text", text: JSON.stringify(builds, null, 2) }],
      };
    }
  );

  server.tool(
    "find_build",
    "Find a specific build by project, branch, and build name",
    {
      project: z.string().describe("Project name"),
      branch: z.string().describe("Branch name"),
      name: z.string().describe("Build name"),
    },
    async ({ project, branch, name }) => {
      const data = await gqlClient.request<{ builds: unknown[] }>(
        FIND_BUILD,
        { project, branch, name }
      );
      const build = data.builds?.[0] ?? null;
      return {
        content: [{ type: "text", text: JSON.stringify(build, null, 2) }],
      };
    }
  );

  if (allowMutations) server.tool(
    "create_build",
    "Create a new build on a branch",
    {
      project: z.string().describe("Project name"),
      branch: z.string().describe("Branch name"),
      name: z.string().describe("Build name (e.g. '1.0.42')"),
      description: z.string().optional().describe("Build description"),
    },
    async ({ project, branch, name, description }) => {
      const data = await gqlClient.request<{
        createBuild: { build: unknown; userErrors: { message: string }[] };
      }>(CREATE_BUILD, { project, branch, name, description });

      const { build, userErrors } = data.createBuild;
      if (userErrors?.length) {
        return {
          isError: true,
          content: [{ type: "text", text: userErrors.map((e) => e.message).join(", ") }],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(build, null, 2) }],
      };
    }
  );

  server.tool(
    "get_build_duration",
    "Get the duration of a build, measured from build creation to its first promotion to a given level (defaults to BRONZE)",
    {
      project: z.string().describe("Project name"),
      branch: z.string().describe("Branch name"),
      build: z.string().describe("Build name"),
      promotion: z.string().optional().default("BRONZE").describe("Promotion level name to measure duration against"),
    },
    async ({ project, branch, build, promotion }) => {
      const data = await gqlClient.request<{
        builds: Array<{
          creation: { time: string };
          promotionRuns: Array<{ creation: { time: string } }>;
        }>;
      }>(GET_BUILD_DURATION, { project, branch, name: build, promotion });

      const buildData = data.builds?.[0];
      if (!buildData) {
        return { isError: true, content: [{ type: "text", text: `Build not found: ${build}` }] };
      }

      const promotionRun = buildData.promotionRuns?.[0];
      if (!promotionRun) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              project, branch, build, promotion,
              buildCreatedAt: buildData.creation.time,
              promoted: false,
              durationSeconds: null,
            }, null, 2),
          }],
        };
      }

      const buildTime = new Date(buildData.creation.time).getTime();
      const promotionTime = new Date(promotionRun.creation.time).getTime();
      const durationSeconds = Math.round((promotionTime - buildTime) / 1000);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            project, branch, build, promotion,
            buildCreatedAt: buildData.creation.time,
            promotedAt: promotionRun.creation.time,
            durationSeconds,
          }, null, 2),
        }],
      };
    }
  );
}
