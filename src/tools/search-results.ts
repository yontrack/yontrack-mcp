import { gqlClient } from "../client.js";
import type { SearchPage, SearchResult } from "./search.js";

// Yontrack 6 only: `query` and `types` replace the deprecated `token` and `type`,
// and one request covers every type, best results first (see docs/adr/0002-search-api-by-capability.md)
const SEARCH_RESULTS = `
  query SearchResults($query: String!, $types: [String!], $size: Int) {
    search(query: $query, types: $types, size: $size) {
      items {
        type { id name description }
        title
        description
        accuracy
        data
      }
      total
      capped
      message
    }
  }
`;

type SearchResultsResponse = {
  search: { items: SearchResult[]; total: number; capped: boolean; message: string | null };
};

/** Searches the given type, or all of them, mapped to the Yontrack 5 page shape. */
export async function searchResults(query: string, type: string | undefined, size: number): Promise<SearchPage> {
  const { search } = await gqlClient.request<SearchResultsResponse>(SEARCH_RESULTS, {
    query,
    size,
    ...(type && { types: [type] }),
  });
  return {
    pageItems: search.items,
    pageInfo: { totalSize: search.total },
    capped: search.capped,
    message: search.message,
  };
}
