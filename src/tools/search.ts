import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gqlClient } from "../client.js";

const SEARCH = `
  query Search($token: String!, $type: String, $size: Int) {
    search(token: $token, type: $type, size: $size) {
      pageItems {
        type { id name description }
        title
        description
        accuracy
      }
      pageInfo { totalSize }
    }
  }
`;

const SEARCH_TYPED = `
  query SearchTyped($token: String!, $type: String!, $size: Int) {
    search(token: $token, type: $type, size: $size) {
      pageItems {
        type { id name description }
        title
        description
        accuracy
        data
      }
      pageInfo { totalSize }
    }
  }
`;

type SearchResponse = { search: { pageItems: unknown[]; pageInfo: { totalSize: number } } };

export function registerSearchTools(server: McpServer) {
  server.tool(
    "search",
    "Full-text search across all Yontrack entities (projects, branches, builds, etc.)",
    {
      token: z.string().describe("Search query"),
      type: z.string().optional().describe("Entity type filter (e.g. 'project', 'build')"),
      size: z.number().int().optional().default(10).describe("Max number of results"),
    },
    async ({ token, type, size }) => {
      const data = await gqlClient.request<{
        search: { pageItems: unknown[]; pageInfo: { totalSize: number } };
      }>(SEARCH, { token, type, size });

      return {
        content: [{ type: "text", text: JSON.stringify(data.search, null, 2) }],
      };
    }
  );

  server.tool(
    "search_commits",
    "Search for SCM commits by keyword or commit message",
    {
      token: z.string().describe("Search query (keyword or commit message fragment)"),
      size: z.number().int().optional().default(10).describe("Max number of results"),
    },
    async ({ token, size }) => {
      const data = await gqlClient.request<SearchResponse>(SEARCH_TYPED, {
        token,
        type: "scm-commit",
        size,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(data.search, null, 2) }],
      };
    }
  );

  server.tool(
    "search_issues",
    "Search for SCM issues by keyword or issue key",
    {
      token: z.string().describe("Search query (keyword or issue key)"),
      size: z.number().int().optional().default(10).describe("Max number of results"),
    },
    async ({ token, size }) => {
      const data = await gqlClient.request<SearchResponse>(SEARCH_TYPED, {
        token,
        type: "scm-issue",
        size,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(data.search, null, 2) }],
      };
    }
  );
}
