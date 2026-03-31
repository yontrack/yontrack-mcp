import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gqlClient } from "../client.js";

const LIST_BRANCHES = `
  query ListBranches($project: String!, $name: String) {
    branches(project: $project, name: $name) {
      id
      name
      displayName
      description
      disabled
      project { id name }
    }
  }
`;

const CREATE_BRANCH = `
  mutation CreateBranch($projectName: String!, $name: String!, $description: String) {
    createBranch(input: {
      projectName: $projectName
      name: $name
      description: $description
    }) {
      branch { id name displayName description disabled project { id name } }
      userErrors { message }
    }
  }
`;

export function registerBranchTools(server: McpServer) {
  server.tool(
    "list_branches",
    "List branches for a project, optionally filtered by name",
    {
      project: z.string().describe("Project name"),
      name: z.string().optional().describe("Filter by branch name"),
    },
    async ({ project, name }) => {
      const data = await gqlClient.request<{ branches: unknown[] }>(
        LIST_BRANCHES,
        { project, name }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data.branches, null, 2) }],
      };
    }
  );

  server.tool(
    "create_branch",
    "Create a new branch in a project",
    {
      project: z.string().describe("Project name"),
      name: z.string().describe("Branch name"),
      description: z.string().optional().describe("Branch description"),
    },
    async ({ project, name, description }) => {
      const data = await gqlClient.request<{
        createBranch: { branch: unknown; userErrors: { message: string }[] };
      }>(CREATE_BRANCH, { projectName: project, name, description });

      const { branch, userErrors } = data.createBranch;
      if (userErrors?.length) {
        return {
          isError: true,
          content: [{ type: "text", text: userErrors.map((e) => e.message).join(", ") }],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(branch, null, 2) }],
      };
    }
  );
}
