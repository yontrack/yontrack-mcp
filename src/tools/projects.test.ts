import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestClient } from "../test/helpers.js";
import { registerProjectTools } from "./projects.js";

vi.mock("../client.js", () => ({
  gqlClient: { request: vi.fn() },
}));

const { gqlClient } = await import("../client.js");
const mockRequest = gqlClient.request as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockRequest.mockReset();
});

describe("list_projects", () => {
  it("returns all projects", async () => {
    const projects = [
      { id: 1, name: "myproject", description: "A project", disabled: false },
    ];
    mockRequest.mockResolvedValueOnce({ projects });

    const client = await createTestClient(registerProjectTools);
    const result = await client.callTool({ name: "list_projects", arguments: {} });

    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(projects);
  });

  it("returns empty array when no projects match", async () => {
    mockRequest.mockResolvedValueOnce({ projects: [] });

    const client = await createTestClient(registerProjectTools);
    const result = await client.callTool({
      name: "list_projects",
      arguments: { name: "nonexistent" },
    });

    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual([]);
  });

  it("passes the name filter to the GraphQL client", async () => {
    mockRequest.mockResolvedValueOnce({ projects: [] });

    const client = await createTestClient(registerProjectTools);
    await client.callTool({ name: "list_projects", arguments: { name: "foo" } });

    expect(mockRequest).toHaveBeenCalledWith(expect.any(String), { name: "foo" });
  });
});

describe("create_project", () => {
  it("returns the created project", async () => {
    const project = { id: 1, name: "newproject", description: "New", disabled: false };
    mockRequest.mockResolvedValueOnce({ createProject: { project, userErrors: [] } });

    const client = await createTestClient(registerProjectTools);
    const result = await client.callTool({
      name: "create_project",
      arguments: { name: "newproject", description: "New" },
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(project);
  });

  it("returns an error when userErrors is non-empty", async () => {
    mockRequest.mockResolvedValueOnce({
      createProject: { project: null, userErrors: [{ message: "Project already exists" }] },
    });

    const client = await createTestClient(registerProjectTools);
    const result = await client.callTool({
      name: "create_project",
      arguments: { name: "existing" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain("Project already exists");
  });

  it("is not registered when mutations are disabled", async () => {
    const client = await createTestClient(registerProjectTools, false);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).not.toContain("create_project");
  });

  it("is registered when mutations are enabled", async () => {
    const client = await createTestClient(registerProjectTools, true);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("create_project");
  });
});
