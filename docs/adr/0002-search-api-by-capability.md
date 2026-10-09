# The search API is chosen by a schema probe, independently of `YONTRACK_AGENT_TOOLS`

Yontrack 6 deprecates `search(token, type)` and its `pageItems` / `pageInfo` ("Will be removed in 7.0") in favour of `search(query, types, size, offset, perType)` returning `SearchResults { items, total, facets, capped, message }`. Yontrack 5 only has the former, and requires `type`, so the `search` tool there runs one search per result type and merges them by accuracy. On Yontrack 6, the search tools (`search`, `search_commits`, `search_issues`) send a single `search(query, types)` request, with `types` only when a type is given.

Support is detected as in ADR 0001, by **probing the schema** for `__type(name: "SearchResults")` (Yontrack 5 has `SearchResultPaginated` instead), in the same probe query, as `Capabilities.searchResults`. Unlike the agent-context tools, **`YONTRACK_AGENT_TOOLS` does not override it**: that variable is about exposing tools, while the search API is a matter of compatibility, which only the instance can answer. Forcing the agent tools on against a Yontrack 5 must not break the search, and turning them off on a Yontrack 6 has no reason to keep a deprecated API. The probe therefore always runs, also when `YONTRACK_AGENT_TOOLS` is `true` or `false`. On a probe error, the search falls back to the Yontrack 5 API, which Yontrack 6 still accepts until 7.0.

The output shape is kept: `items` and `total` are returned as `pageItems` and `pageInfo { totalSize }`. Yontrack 6 adds `capped` (the total is a lower bound) and `message` (e.g. the index is being built), which explain an empty or partial result to the agent.

## Considered options

- Gate the search on `Capabilities.agentTools`: the override would then select an API the instance may not have.
- A separate override variable for the search: nothing to configure that the probe cannot answer.
- Return the Yontrack 6 shape (`items`, `total`) as is: breaks agents and prompts relying on `pageItems` for no gain.
