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

async function search(args: Record<string, unknown>) {
  const client = await createTestClient(registerSearchTools);
  const result = await client.callTool({ name: "search", arguments: args });
  return JSON.parse((result.content as { type: string; text: string }[])[0].text);
}

describe("search", () => {
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
});
