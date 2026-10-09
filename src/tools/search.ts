import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gqlClient } from "../client.js";
import { searchResults } from "./search-results.js";

// Yontrack 5 API: `type` is required on v5 (and deprecated, but still accepted, on v6).
// On Yontrack 6, `searchResults` is used instead.
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

export type SearchResult = { accuracy?: number | null };
/** Output of the search tools; `capped` and `message` are only returned by Yontrack 6. */
export type SearchPage = {
  pageItems: SearchResult[];
  pageInfo: { totalSize: number } | null;
  capped?: boolean;
  message?: string | null;
};
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

/** `searchResultsAvailable`: the Yontrack 6 search API is available (`Capabilities.searchResults`). */
export function registerSearchTools(server: McpServer, searchResultsAvailable: boolean) {
  const search = (token: string, type: string | undefined, size: number) =>
    searchResultsAvailable
      ? searchResults(token, type, size)
      : type
        ? searchType(token, type, size)
        : searchAllTypes(token, size);

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
      return {
        content: [{ type: "text", text: JSON.stringify(await search(token, type, size), null, 2) }],
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
      return {
        content: [{ type: "text", text: JSON.stringify(await search(token, "scm-commit", size), null, 2) }],
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
      return {
        content: [{ type: "text", text: JSON.stringify(await search(token, "scm-issue", size), null, 2) }],
      };
    }
  );
}
