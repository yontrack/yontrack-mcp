import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestClient } from "../test/helpers.js";

// Mock fs before the module is imported — readFileSync runs at load time
vi.mock("node:fs", () => ({
  readFileSync: vi.fn().mockReturnValue("type Query { hello: String }"),
}));

vi.mock("../client.js", () => ({
  gqlClient: { request: vi.fn() },
}));

// Import after mocks are hoisted
const { gqlClient } = await import("../client.js");
const mockRequest = gqlClient.request as ReturnType<typeof vi.fn>;

const { registerGraphQLTools } = await import("./graphql.js");

beforeEach(() => {
  mockRequest.mockReset();
});

describe("yontrack://schema resource", () => {
  it("returns the schema content", async () => {
    const client = await createTestClient(registerGraphQLTools);
    const result = await client.readResource({ uri: "yontrack://schema" });

    expect(result.contents).toHaveLength(1);
    const content = result.contents[0] as { uri: string; text: string };
    expect(content.uri).toBe("yontrack://schema");
    expect(content.text).toBe("type Query { hello: String }");
  });
});

describe("graphql_query tool", () => {
  it("executes a query and returns JSON result", async () => {
    const responseData = { branches: [{ id: 1, name: "main" }] };
    mockRequest.mockResolvedValueOnce(responseData);

    const client = await createTestClient(registerGraphQLTools);
    const result = await client.callTool({
      name: "graphql_query",
      arguments: {
        query: "query { branches(project: \"myproject\", name: \"main\") { id name } }",
      },
    });

    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(responseData);
  });

  it("passes variables to the GraphQL client", async () => {
    mockRequest.mockResolvedValueOnce({ builds: [] });

    const client = await createTestClient(registerGraphQLTools);
    await client.callTool({
      name: "graphql_query",
      arguments: {
        query: "query ListBuilds($project: String!) { builds(project: $project) { id } }",
        variables: { project: "myproject" },
      },
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.any(String),
      { project: "myproject" }
    );
  });

  it("uses empty object when variables are omitted", async () => {
    mockRequest.mockResolvedValueOnce({ hello: "world" });

    const client = await createTestClient(registerGraphQLTools);
    await client.callTool({
      name: "graphql_query",
      arguments: { query: "query { hello }" },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.any(String), {});
  });

  it("rejects mutation queries when mutations are disabled", async () => {
    const client = await createTestClient(registerGraphQLTools, false);
    const result = await client.callTool({
      name: "graphql_query",
      arguments: { query: "mutation CreateBuild { createBuild(input: {}) { build { id } } }" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toMatch(/mutations are disabled/i);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("allows mutation queries when mutations are enabled", async () => {
    mockRequest.mockResolvedValueOnce({ createBuild: { build: { id: 1 } } });

    const client = await createTestClient(registerGraphQLTools, true);
    const result = await client.callTool({
      name: "graphql_query",
      arguments: { query: "mutation CreateBuild { createBuild(input: {}) { build { id } } }" },
    });

    expect(result.isError).toBeFalsy();
  });
});
