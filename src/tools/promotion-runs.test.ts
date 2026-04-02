import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestClient } from "../test/helpers.js";
import { registerPromotionRunTools } from "./promotion-runs.js";

vi.mock("../client.js", () => ({
  gqlClient: { request: vi.fn() },
}));

const { gqlClient } = await import("../client.js");
const mockRequest = gqlClient.request as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockRequest.mockReset();
});

describe("get_promotion_runs", () => {
  it("returns promotion runs for a build", async () => {
    const runs = [
      { id: 1, description: null, creation: { user: "alice", time: "2024-01-01T00:00:00Z" }, promotionLevel: { id: 1, name: "BRONZE" } },
    ];
    mockRequest.mockResolvedValueOnce({ builds: [{ promotionRuns: runs }] });

    const client = await createTestClient(registerPromotionRunTools);
    const result = await client.callTool({
      name: "get_promotion_runs",
      arguments: { project: "myproject", branch: "main", build: "1.0.1" },
    });

    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(runs);
  });

  it("returns empty array when build not found", async () => {
    mockRequest.mockResolvedValueOnce({ builds: [] });

    const client = await createTestClient(registerPromotionRunTools);
    const result = await client.callTool({
      name: "get_promotion_runs",
      arguments: { project: "myproject", branch: "main", build: "missing" },
    });

    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual([]);
  });

  it("passes the promotion filter to the GraphQL client", async () => {
    mockRequest.mockResolvedValueOnce({ builds: [{ promotionRuns: [] }] });

    const client = await createTestClient(registerPromotionRunTools);
    await client.callTool({
      name: "get_promotion_runs",
      arguments: { project: "myproject", branch: "main", build: "1.0.1", promotion: "GOLD" },
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ promotion: "GOLD" })
    );
  });
});

describe("promote_build", () => {
  it("returns the created promotion run", async () => {
    const run = { id: 5, description: null, creation: { user: "alice", time: "2024-01-01T00:00:00Z" }, promotionLevel: { id: 1, name: "BRONZE" } };
    mockRequest.mockResolvedValueOnce({ createPromotionRun: { promotionRun: run, userErrors: [] } });

    const client = await createTestClient(registerPromotionRunTools);
    const result = await client.callTool({
      name: "promote_build",
      arguments: { project: "myproject", branch: "main", build: "1.0.1", promotion: "BRONZE" },
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(run);
  });

  it("returns an error when userErrors is non-empty", async () => {
    mockRequest.mockResolvedValueOnce({
      createPromotionRun: { promotionRun: null, userErrors: [{ message: "Build not found" }] },
    });

    const client = await createTestClient(registerPromotionRunTools);
    const result = await client.callTool({
      name: "promote_build",
      arguments: { project: "myproject", branch: "main", build: "9.9.9", promotion: "BRONZE" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain("Build not found");
  });

  it("is not registered when mutations are disabled", async () => {
    const client = await createTestClient(registerPromotionRunTools, false);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).not.toContain("promote_build");
  });

  it("is registered when mutations are enabled", async () => {
    const client = await createTestClient(registerPromotionRunTools, true);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("promote_build");
  });
});
