import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gqlClient } from "../client.js";

const LIST_BUILDS = `
  query ListBuilds($project: String!, $branch: String!, $count: Int) {
    branches(project: $project, name: $branch) {
      builds(count: $count) {
        id
        name
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
      description
      branch { id name project { id name } }
      creation { user time }
      runInfo { sourceType sourceUri triggerType triggerData runTime }
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
      build { id name description branch { id name project { id name } } }
      userErrors { message }
    }
  }
`;

export function registerBuildTools(server: McpServer) {
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

  server.tool(
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
}
