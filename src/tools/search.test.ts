import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestClient } from "../test/helpers.js";
import { registerSearchTools } from "./search.js";

vi.mock("../client.js", () => ({
  gqlClient: { request: vi.fn() },
}));

const { gqlClient } = await import("../client.js");
const mockRequest = gqlClient.request as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockRequest.mockReset();
});

const result = (id: string, title: string, accuracy: number) => ({
  type: { id, name: id, description: null },
  title,
  description: null,
  accuracy,
  data: null,
});

async function call(name: string, args: Record<string, unknown>, searchResults: boolean) {
  const client = await createTestClient((server) => registerSearchTools(server, searchResults));
  const result = await client.callTool({ name, arguments: args });
  return JSON.parse((result.content as { type: string; text: string }[])[0].text);
}

const search = (args: Record<string, unknown>) => call("search", args, false);
const searchV6 = (args: Record<string, unknown>) => call("search", args, true);

describe("search (Yontrack 5 API)", () => {
  it("searches the given type only", async () => {
    const page = { pageItems: [result("build", "1.0.0", 1.0)], pageInfo: { totalSize: 1 } };
    mockRequest.mockResolvedValueOnce({ search: page });

    expect(await search({ token: "foo", type: "build", size: 5 })).toEqual(page);
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledWith(expect.any(String), { token: "foo", type: "build", size: 5 });
  });

  it("searches every type when none is given, best results first", async () => {
    mockRequest
      .mockResolvedValueOnce({ searchResultTypes: [{ id: "project" }, { id: "build" }] })
      .mockResolvedValueOnce({
        search: { pageItems: [result("project", "p1", 0.5), result("project", "p2", 0.1)], pageInfo: { totalSize: 2 } },
      })
      .mockResolvedValueOnce({
        search: { pageItems: [result("build", "b1", 0.9)], pageInfo: { totalSize: 7 } },
      });

    expect(await search({ token: "foo", size: 2 })).toEqual({
      pageItems: [result("build", "b1", 0.9), result("project", "p1", 0.5)],
      pageInfo: { totalSize: 9 },
    });
    expect(mockRequest).toHaveBeenCalledWith(expect.stringContaining("searchResultTypes"));
    expect(mockRequest).toHaveBeenCalledWith(expect.any(String), { token: "foo", type: "project", size: 2 });
    expect(mockRequest).toHaveBeenCalledWith(expect.any(String), { token: "foo", type: "build", size: 2 });
  });

  it("returns empty results when nothing matches", async () => {
    mockRequest
      .mockResolvedValueOnce({ searchResultTypes: [{ id: "project" }] })
      .mockResolvedValueOnce({ search: { pageItems: [], pageInfo: { totalSize: 0 } } });

    expect(await search({ token: "zzznomatch" })).toEqual({ pageItems: [], pageInfo: { totalSize: 0 } });
  });

  it("searches commits through their type", async () => {
    const page = { pageItems: [result("scm-commit", "abc123", 1.0)], pageInfo: { totalSize: 1 } };
    mockRequest.mockResolvedValueOnce({ search: page });

    expect(await call("search_commits", { token: "fix" }, false)).toEqual(page);
    expect(mockRequest).toHaveBeenCalledWith(expect.stringContaining("token: $token"), {
      token: "fix",
      type: "scm-commit",
      size: 10,
    });
  });
});

describe("search (Yontrack 6 API)", () => {
  const results = (items: ReturnType<typeof result>[], total: number, message: string | null = null) => ({
    search: { items, total, capped: false, message },
  });

  it("searches all types in a single request, keeping the output shape", async () => {
    mockRequest.mockResolvedValueOnce(results([result("build", "b1", 0.9), result("project", "p1", 0.5)], 9));

    expect(await searchV6({ token: "foo", size: 2 })).toEqual({
      pageItems: [result("build", "b1", 0.9), result("project", "p1", 0.5)],
      pageInfo: { totalSize: 9 },
      capped: false,
      message: null,
    });
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest.mock.calls[0][0]).toContain("search(query: $query, types: $types, size: $size)");
    expect(mockRequest.mock.calls[0][1]).toStrictEqual({ query: "foo", size: 2 });
  });

  it("restricts the search to the given type", async () => {
    mockRequest.mockResolvedValueOnce(results([result("build", "1.0.0", 1.0)], 1));

    await searchV6({ token: "foo", type: "build", size: 5 });

    expect(mockRequest).toHaveBeenCalledWith(expect.any(String), { query: "foo", types: ["build"], size: 5 });
  });

  it("passes on the capped flag and the message of the search", async () => {
    mockRequest.mockResolvedValueOnce({
      search: { items: [], total: 1000, capped: true, message: "The search index is being built" },
    });

    expect(await searchV6({ token: "foo" })).toMatchObject({
      pageInfo: { totalSize: 1000 },
      capped: true,
      message: "The search index is being built",
    });
  });

  it.each([
    ["search_commits", "scm-commit"],
    ["search_issues", "scm-issue"],
  ])("%s searches the %s type", async (tool, type) => {
    mockRequest.mockResolvedValueOnce(results([], 0));

    await call(tool, { token: "fix" }, true);

    expect(mockRequest).toHaveBeenCalledWith(expect.stringContaining("query: $query"), {
      query: "fix",
      types: [type],
      size: 10,
    });
  });
});
