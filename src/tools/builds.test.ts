import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestClient } from "../test/helpers.js";
import { registerBuildTools } from "./builds.js";

vi.mock("../client.js", () => ({
  gqlClient: { request: vi.fn() },
}));

// Import after mock is hoisted
const { gqlClient } = await import("../client.js");
const mockRequest = gqlClient.request as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockRequest.mockReset();
});

describe("list_builds", () => {
  it("returns builds for a branch", async () => {
    const builds = [
      { id: 1, name: "1.0.1", displayName: "1.0.1", description: null, creation: { user: "alice", time: "2024-01-01T00:00:00Z" } },
    ];
    mockRequest.mockResolvedValueOnce({ branches: [{ builds }] });

    const client = await createTestClient(registerBuildTools);
    const result = await client.callTool({
      name: "list_builds",
      arguments: { project: "myproject", branch: "main" },
    });

    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(builds);
  });

  it("returns empty array when branch not found", async () => {
    mockRequest.mockResolvedValueOnce({ branches: [] });

    const client = await createTestClient(registerBuildTools);
    const result = await client.callTool({
      name: "list_builds",
      arguments: { project: "myproject", branch: "missing" },
    });

    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual([]);
  });
});

describe("find_build", () => {
  it("returns the matching build", async () => {
    const build = { id: 42, name: "1.0.2", displayName: "1.0.2", description: null };
    mockRequest.mockResolvedValueOnce({ builds: [build] });

    const client = await createTestClient(registerBuildTools);
    const result = await client.callTool({
      name: "find_build",
      arguments: { project: "myproject", branch: "main", name: "1.0.2" },
    });

    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(build);
  });

  it("returns null when no build matches", async () => {
    mockRequest.mockResolvedValueOnce({ builds: [] });

    const client = await createTestClient(registerBuildTools);
    const result = await client.callTool({
      name: "find_build",
      arguments: { project: "myproject", branch: "main", name: "9.9.9" },
    });

    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toBeNull();
  });
});

describe("create_build", () => {
  it("returns the created build", async () => {
    const build = { id: 10, name: "2.0.0", displayName: "2.0.0" };
    mockRequest.mockResolvedValueOnce({ createBuild: { build, userErrors: [] } });

    const client = await createTestClient(registerBuildTools);
    const result = await client.callTool({
      name: "create_build",
      arguments: { project: "myproject", branch: "main", name: "2.0.0" },
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(build);
  });

  it("returns an error when userErrors is non-empty", async () => {
    mockRequest.mockResolvedValueOnce({
      createBuild: { build: null, userErrors: [{ message: "Branch not found" }] },
    });

    const client = await createTestClient(registerBuildTools);
    const result = await client.callTool({
      name: "create_build",
      arguments: { project: "myproject", branch: "ghost", name: "2.0.0" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain("Branch not found");
  });
});

describe("get_build_duration", () => {
  it("calculates duration in seconds from build creation to promotion", async () => {
    mockRequest.mockResolvedValueOnce({
      builds: [{
        creation: { time: "2024-01-01T10:00:00Z" },
        promotionRuns: [{ creation: { time: "2024-01-01T10:05:30Z" } }],
      }],
    });

    const client = await createTestClient(registerBuildTools);
    const result = await client.callTool({
      name: "get_build_duration",
      arguments: { project: "myproject", branch: "main", build: "1.0.1" },
    });

    const text = (result.content as { type: string; text: string }[])[0].text;
    const data = JSON.parse(text);
    expect(data.durationSeconds).toBe(330); // 5m30s
    expect(data.promoted).toBeUndefined();  // only present when not promoted
    expect(data.promotedAt).toBe("2024-01-01T10:05:30Z");
  });

  it("reports not promoted when no promotion run exists", async () => {
    mockRequest.mockResolvedValueOnce({
      builds: [{
        creation: { time: "2024-01-01T10:00:00Z" },
        promotionRuns: [],
      }],
    });

    const client = await createTestClient(registerBuildTools);
    const result = await client.callTool({
      name: "get_build_duration",
      arguments: { project: "myproject", branch: "main", build: "1.0.1" },
    });

    const text = (result.content as { type: string; text: string }[])[0].text;
    const data = JSON.parse(text);
    expect(data.promoted).toBe(false);
    expect(data.durationSeconds).toBeNull();
  });

  it("returns an error when build not found", async () => {
    mockRequest.mockResolvedValueOnce({ builds: [] });

    const client = await createTestClient(registerBuildTools);
    const result = await client.callTool({
      name: "get_build_duration",
      arguments: { project: "myproject", branch: "main", build: "9.9.9" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain("Build not found");
  });

  it("uses BRONZE as default promotion level", async () => {
    mockRequest.mockResolvedValueOnce({
      builds: [{ creation: { time: "2024-01-01T10:00:00Z" }, promotionRuns: [] }],
    });

    const client = await createTestClient(registerBuildTools);
    await client.callTool({
      name: "get_build_duration",
      arguments: { project: "myproject", branch: "main", build: "1.0.1" },
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ promotion: "BRONZE" })
    );
  });
});
