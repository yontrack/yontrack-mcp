import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gqlClient } from "../client.js";

const LIST_PROJECTS = `
  query ListProjects($name: String) {
    projects(name: $name) {
      id
      name
      description
      disabled
    }
  }
`;

const CREATE_PROJECT = `
  mutation CreateProject($name: String!, $description: String) {
    createProject(input: { name: $name, description: $description }) {
      project { id name description disabled }
      userErrors { message }
    }
  }
`;

export function registerProjectTools(server: McpServer, allowMutations: boolean) {
  server.tool(
    "list_projects",
    "List all projects in Yontrack, optionally filtered by name",
    {
      name: z.string().optional().describe("Filter by exact project name"),
    },
    async ({ name }) => {
      const data = await gqlClient.request<{ projects: unknown[] }>(
        LIST_PROJECTS,
        { name }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data.projects, null, 2) }],
      };
    }
  );

  if (allowMutations) server.tool(
    "create_project",
    "Create a new project in Yontrack",
    {
      name: z.string().describe("Project name"),
      description: z.string().optional().describe("Project description"),
    },
    async ({ name, description }) => {
      const data = await gqlClient.request<{
        createProject: { project: unknown; userErrors: { message: string }[] };
      }>(CREATE_PROJECT, { name, description });

      const { project, userErrors } = data.createProject;
      if (userErrors?.length) {
        return {
          isError: true,
          content: [{ type: "text", text: userErrors.map((e) => e.message).join(", ") }],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(project, null, 2) }],
      };
    }
  );
}
