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

describe("search", () => {
  it("returns search results", async () => {
    const search = {
      pageItems: [
        { type: { id: "project", name: "Project", description: null }, title: "myproject", description: null, accuracy: 1.0 },
      ],
      pageInfo: { totalSize: 1 },
    };
    mockRequest.mockResolvedValueOnce({ search });

    const client = await createTestClient(registerSearchTools);
    const result = await client.callTool({
      name: "search",
      arguments: { token: "myproject" },
    });

    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(search);
  });

  it("returns empty results when nothing matches", async () => {
    const search = { pageItems: [], pageInfo: { totalSize: 0 } };
    mockRequest.mockResolvedValueOnce({ search });

    const client = await createTestClient(registerSearchTools);
    const result = await client.callTool({
      name: "search",
      arguments: { token: "zzznomatch" },
    });

    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(search);
  });

  it("passes type and size filters to the GraphQL client", async () => {
    mockRequest.mockResolvedValueOnce({ search: { pageItems: [], pageInfo: { totalSize: 0 } } });

    const client = await createTestClient(registerSearchTools);
    await client.callTool({
      name: "search",
      arguments: { token: "foo", type: "build", size: 5 },
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.any(String),
      { token: "foo", type: "build", size: 5 }
    );
  });
});
