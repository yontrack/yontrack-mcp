import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gqlClient } from "../client.js";

const GET_VALIDATION_RUNS = `
  query GetValidationRuns(
    $project: String!
    $branch: String!
    $build: String!
    $validationStamp: String
    $count: Int
  ) {
    builds(project: $project, branch: $branch, name: $build) {
      validationRuns(validationStamp: $validationStamp, count: $count) {
        id
        runOrder
        description
        lastStatus { statusID { id name } description }
        creation { user time }
        validationStamp { id name }
      }
    }
  }
`;

const CREATE_VALIDATION_RUN = `
  mutation CreateValidationRun(
    $project: String!
    $branch: String!
    $build: String!
    $validationStamp: String!
    $status: String!
    $description: String
  ) {
    createValidationRun(input: {
      project: $project
      branch: $branch
      build: $build
      validationStamp: $validationStamp
      validationRunStatus: $status
      description: $description
    }) {
      validationRun {
        id
        runOrder
        lastStatus { statusID { id name } }
      }
      userErrors { message }
    }
  }
`;

export function registerValidationRunTools(server: McpServer, allowMutations: boolean) {
  server.tool(
    "get_validation_runs",
    "Get validation runs for a build, optionally filtered by validation stamp",
    {
      project: z.string().describe("Project name"),
      branch: z.string().describe("Branch name"),
      build: z.string().describe("Build name"),
      validationStamp: z.string().optional().describe("Filter by validation stamp name"),
      count: z.number().int().optional().default(10).describe("Max number of runs to return"),
    },
    async ({ project, branch, build, validationStamp, count }) => {
      const data = await gqlClient.request<{
        builds: Array<{ validationRuns: unknown[] }>;
      }>(GET_VALIDATION_RUNS, { project, branch, build, validationStamp, count });

      const runs = data.builds?.[0]?.validationRuns ?? [];
      return {
        content: [{ type: "text", text: JSON.stringify(runs, null, 2) }],
      };
    }
  );

  if (allowMutations) server.tool(
    "create_validation_run",
    "Create a validation run for a build with a status",
    {
      project: z.string().describe("Project name"),
      branch: z.string().describe("Branch name"),
      build: z.string().describe("Build name"),
      validationStamp: z.string().describe("Validation stamp name"),
      status: z
        .enum(["PASSED", "FAILED", "WARNING", "DEFECTIVE", "INTERRUPTED", "INVESTIGATED"])
        .describe("Validation status"),
      description: z.string().optional().describe("Optional description or notes"),
    },
    async ({ project, branch, build, validationStamp, status, description }) => {
      const data = await gqlClient.request<{
        createValidationRun: { validationRun: unknown; userErrors: { message: string }[] };
      }>(CREATE_VALIDATION_RUN, {
        project,
        branch,
        build,
        validationStamp,
        status,
        description,
      });

      const { validationRun, userErrors } = data.createValidationRun;
      if (userErrors?.length) {
        return {
          isError: true,
          content: [{ type: "text", text: userErrors.map((e) => e.message).join(", ") }],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(validationRun, null, 2) }],
      };
    }
  );
}
