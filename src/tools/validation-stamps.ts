import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gqlClient } from "../client.js";
import { resolveBranchId } from "../utils.js";

const LIST_VALIDATION_STAMPS = `
  query ListValidationStamps($project: String!, $branch: String!, $name: String) {
    branches(project: $project, name: $branch) {
      validationStamps(name: $name) {
        id
        name
        description
      }
    }
  }
`;

const CREATE_VALIDATION_STAMP = `
  mutation CreateValidationStampById(
    $branchId: Int!
    $name: String!
    $description: String!
  ) {
    createValidationStampById(input: {
      branchId: $branchId
      name: $name
      description: $description
    }) {
      validationStamp { id name description }
      userErrors { message }
    }
  }
`;

export function registerValidationStampTools(server: McpServer, allowMutations: boolean) {
  server.tool(
    "list_validation_stamps",
    "List validation stamps for a branch",
    {
      project: z.string().describe("Project name"),
      branch: z.string().describe("Branch name"),
      name: z.string().optional().describe("Filter by stamp name"),
    },
    async ({ project, branch, name }) => {
      const data = await gqlClient.request<{
        branches: Array<{ validationStamps: unknown[] }>;
      }>(LIST_VALIDATION_STAMPS, { project, branch, name });

      const stamps = data.branches?.[0]?.validationStamps ?? [];
      return {
        content: [{ type: "text", text: JSON.stringify(stamps, null, 2) }],
      };
    }
  );

  if (allowMutations) server.tool(
    "create_validation_stamp",
    "Create a new validation stamp on a branch",
    {
      project: z.string().describe("Project name"),
      branch: z.string().describe("Branch name"),
      name: z.string().describe("Validation stamp name"),
      description: z.string().optional().default("").describe("Description"),
    },
    async ({ project, branch, name, description }) => {
      const branchId = await resolveBranchId(project, branch);
      const data = await gqlClient.request<{
        createValidationStampById: { validationStamp: unknown; userErrors: { message: string }[] };
      }>(CREATE_VALIDATION_STAMP, { branchId, name, description });

      const { validationStamp, userErrors } = data.createValidationStampById;
      if (userErrors?.length) {
        return {
          isError: true,
          content: [{ type: "text", text: userErrors.map((e) => e.message).join(", ") }],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(validationStamp, null, 2) }],
      };
    }
  );
}
