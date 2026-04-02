import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestClient } from "../test/helpers.js";
import { registerBranchTools } from "./branches.js";

vi.mock("../client.js", () => ({
  gqlClient: { request: vi.fn() },
}));

const { gqlClient } = await import("../client.js");
const mockRequest = gqlClient.request as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockRequest.mockReset();
});

describe("list_branches", () => {
  it("returns branches for a project", async () => {
    const branches = [
      { id: 1, name: "main", displayName: "main", description: null, disabled: false, project: { id: 1, name: "myproject" } },
    ];
    mockRequest.mockResolvedValueOnce({ branches });

    const client = await createTestClient(registerBranchTools);
    const result = await client.callTool({
      name: "list_branches",
      arguments: { project: "myproject" },
    });

    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(branches);
  });

  it("returns empty array when no branches match", async () => {
    mockRequest.mockResolvedValueOnce({ branches: [] });

    const client = await createTestClient(registerBranchTools);
    const result = await client.callTool({
      name: "list_branches",
      arguments: { project: "myproject", name: "nonexistent" },
    });

    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual([]);
  });

  it("passes the name filter to the GraphQL client", async () => {
    mockRequest.mockResolvedValueOnce({ branches: [] });

    const client = await createTestClient(registerBranchTools);
    await client.callTool({
      name: "list_branches",
      arguments: { project: "myproject", name: "feature" },
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.any(String),
      { project: "myproject", name: "feature" }
    );
  });
});

describe("create_branch", () => {
  it("returns the created branch", async () => {
    const branch = { id: 10, name: "feature-x", displayName: "feature-x", description: "My feature", disabled: false };
    mockRequest.mockResolvedValueOnce({ createBranch: { branch, userErrors: [] } });

    const client = await createTestClient(registerBranchTools);
    const result = await client.callTool({
      name: "create_branch",
      arguments: { project: "myproject", name: "feature-x", description: "My feature" },
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(branch);
  });

  it("returns an error when userErrors is non-empty", async () => {
    mockRequest.mockResolvedValueOnce({
      createBranch: { branch: null, userErrors: [{ message: "Branch already exists" }] },
    });

    const client = await createTestClient(registerBranchTools);
    const result = await client.callTool({
      name: "create_branch",
      arguments: { project: "myproject", name: "main" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain("Branch already exists");
  });

  it("is not registered when mutations are disabled", async () => {
    const client = await createTestClient(registerBranchTools, false);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).not.toContain("create_branch");
  });

  it("is registered when mutations are enabled", async () => {
    const client = await createTestClient(registerBranchTools, true);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("create_branch");
  });
});
