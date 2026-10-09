import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gqlClient } from "../client.js";

// `type` is required on v5 (and deprecated, but still accepted, on v6)
const SEARCH = `
  query Search($token: String!, $type: String!, $size: Int) {
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

const SEARCH_RESULT_TYPES = `
  query SearchResultTypes {
    searchResultTypes { id }
  }
`;

type SearchResult = { accuracy?: number | null };
type SearchPage = { pageItems: SearchResult[]; pageInfo: { totalSize: number } | null };
type SearchResponse = { search: SearchPage | null };

async function searchType(token: string, type: string, size: number): Promise<SearchPage> {
  const data = await gqlClient.request<SearchResponse>(SEARCH, { token, type, size });
  return data.search ?? { pageItems: [], pageInfo: { totalSize: 0 } };
}

/** Searches each type of result, keeping the best `size` results overall. */
async function searchAllTypes(token: string, size: number): Promise<SearchPage> {
  const { searchResultTypes } = await gqlClient.request<{ searchResultTypes: { id: string | null }[] }>(
    SEARCH_RESULT_TYPES
  );
  const pages = await Promise.all(
    searchResultTypes.flatMap(({ id }) => (id ? [searchType(token, id, size)] : []))
  );
  return {
    pageItems: pages
      .flatMap((page) => page.pageItems)
      .sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0))
      .slice(0, size),
    pageInfo: { totalSize: pages.reduce((total, page) => total + (page.pageInfo?.totalSize ?? 0), 0) },
  };
}

export function registerSearchTools(server: McpServer) {
  server.tool(
    "search",
    "Full-text search across all Yontrack entities (projects, branches, builds, etc.)",
    {
      token: z.string().describe("Search query"),
      type: z
        .string()
        .optional()
        .describe("Type of result to search for (e.g. 'project', 'build'); all types when omitted"),
      size: z.number().int().optional().default(10).describe("Max number of results"),
    },
    async ({ token, type, size }) => {
      const search = type ? await searchType(token, type, size) : await searchAllTypes(token, size);
      return {
        content: [{ type: "text", text: JSON.stringify(search, null, 2) }],
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
      const search = await searchType(token, "scm-commit", size);
      return {
        content: [{ type: "text", text: JSON.stringify(search, null, 2) }],
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
      const search = await searchType(token, "scm-issue", size);
      return {
        content: [{ type: "text", text: JSON.stringify(search, null, 2) }],
      };
    }
  );
}
