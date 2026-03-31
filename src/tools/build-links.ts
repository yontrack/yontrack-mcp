import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gqlClient } from "../client.js";

const GET_BUILD_LINKS = `
  query GetBuildLinks($project: String!, $branch: String!, $build: String!) {
    builds(project: $project, branch: $branch, name: $build) {
      usingQualified {
        pageItems {
          qualifier
          build { id name branch { id name project { id name } } }
        }
        pageInfo { totalSize }
      }
      usedByQualified {
        pageItems {
          qualifier
          build { id name branch { id name project { id name } } }
        }
        pageInfo { totalSize }
      }
    }
  }
`;

const SET_BUILD_LINKS = `
  mutation LinksBuild(
    $fromProject: String!
    $fromBuild: String!
    $links: [LinksBuildInputItem!]!
  ) {
    linksBuild(input: {
      fromProject: $fromProject
      fromBuild: $fromBuild
      links: $links
    }) {
      userErrors { message }
    }
  }
`;

const BuildLinkInput = z.object({
  project: z.string().describe("Target project name"),
  build: z.string().describe("Target build name"),
  qualifier: z.string().optional().describe("Optional link qualifier"),
});

export function registerBuildLinkTools(server: McpServer) {
  server.tool(
    "get_build_links",
    "Get dependency links for a build (builds it uses and builds that use it)",
    {
      project: z.string().describe("Project name"),
      branch: z.string().describe("Branch name"),
      build: z.string().describe("Build name"),
    },
    async ({ project, branch, build }) => {
      const data = await gqlClient.request<{
        builds: Array<{ usingQualified: unknown; usedByQualified: unknown }>;
      }>(GET_BUILD_LINKS, { project, branch, build });

      const result = data.builds?.[0] ?? { usingQualified: null, usedByQualified: null };
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "set_build_links",
    "Set dependency links from a build to one or more target builds",
    {
      fromProject: z.string().describe("Source project name"),
      fromBuild: z.string().describe("Source build name"),
      links: z.array(BuildLinkInput).describe("Target builds to link to"),
    },
    async ({ fromProject, fromBuild, links }) => {
      const data = await gqlClient.request<{
        linksBuild: { userErrors: { message: string }[] };
      }>(SET_BUILD_LINKS, { fromProject, fromBuild, links });

      const { userErrors } = data.linksBuild;
      if (userErrors?.length) {
        return {
          isError: true,
          content: [{ type: "text", text: userErrors.map((e) => e.message).join(", ") }],
        };
      }
      return {
        content: [{ type: "text", text: "Build links updated successfully." }],
      };
    }
  );
}
