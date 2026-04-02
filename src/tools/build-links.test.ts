import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestClient } from "../test/helpers.js";
import { registerBuildLinkTools } from "./build-links.js";

vi.mock("../client.js", () => ({
  gqlClient: { request: vi.fn() },
}));

const { gqlClient } = await import("../client.js");
const mockRequest = gqlClient.request as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockRequest.mockReset();
});

describe("get_build_links", () => {
  it("returns using and usedBy links for a build", async () => {
    const links = {
      usingQualified: {
        pageItems: [{ qualifier: null, build: { id: 2, name: "dep-1.0.0", branch: { id: 5, name: "main", project: { id: 3, name: "dep" } } } }],
        pageInfo: { totalSize: 1 },
      },
      usedByQualified: { pageItems: [], pageInfo: { totalSize: 0 } },
    };
    mockRequest.mockResolvedValueOnce({ builds: [links] });

    const client = await createTestClient(registerBuildLinkTools);
    const result = await client.callTool({
      name: "get_build_links",
      arguments: { project: "myproject", branch: "main", build: "1.0.1" },
    });

    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(links);
  });

  it("returns nulls when build not found", async () => {
    mockRequest.mockResolvedValueOnce({ builds: [] });

    const client = await createTestClient(registerBuildLinkTools);
    const result = await client.callTool({
      name: "get_build_links",
      arguments: { project: "myproject", branch: "main", build: "missing" },
    });

    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual({ usingQualified: null, usedByQualified: null });
  });
});

describe("set_build_links", () => {
  it("returns success message when links are set", async () => {
    mockRequest.mockResolvedValueOnce({ linksBuild: { userErrors: [] } });

    const client = await createTestClient(registerBuildLinkTools);
    const result = await client.callTool({
      name: "set_build_links",
      arguments: {
        fromProject: "myproject",
        fromBuild: "1.0.1",
        links: [{ project: "dep", build: "dep-1.0.0" }],
      },
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain("updated successfully");
  });

  it("returns an error when userErrors is non-empty", async () => {
    mockRequest.mockResolvedValueOnce({
      linksBuild: { userErrors: [{ message: "Build not found" }] },
    });

    const client = await createTestClient(registerBuildLinkTools);
    const result = await client.callTool({
      name: "set_build_links",
      arguments: {
        fromProject: "myproject",
        fromBuild: "9.9.9",
        links: [{ project: "dep", build: "dep-1.0.0" }],
      },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain("Build not found");
  });

  it("is not registered when mutations are disabled", async () => {
    const client = await createTestClient(registerBuildLinkTools, false);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).not.toContain("set_build_links");
  });

  it("is registered when mutations are enabled", async () => {
    const client = await createTestClient(registerBuildLinkTools, true);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("set_build_links");
  });
});
