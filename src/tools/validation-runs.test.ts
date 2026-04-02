import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestClient } from "../test/helpers.js";
import { registerValidationRunTools } from "./validation-runs.js";

vi.mock("../client.js", () => ({
  gqlClient: { request: vi.fn() },
}));

const { gqlClient } = await import("../client.js");
const mockRequest = gqlClient.request as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockRequest.mockReset();
});

describe("get_validation_runs", () => {
  it("returns validation runs for a build", async () => {
    const runs = [
      { id: 1, runOrder: 1, description: null, lastStatus: { statusID: { id: "PASSED", name: "Passed" }, description: null }, creation: { user: "alice", time: "2024-01-01T00:00:00Z" }, validationStamp: { id: 1, name: "CI" } },
    ];
    mockRequest.mockResolvedValueOnce({ builds: [{ validationRuns: runs }] });

    const client = await createTestClient(registerValidationRunTools);
    const result = await client.callTool({
      name: "get_validation_runs",
      arguments: { project: "myproject", branch: "main", build: "1.0.1" },
    });

    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(runs);
  });

  it("returns empty array when build not found", async () => {
    mockRequest.mockResolvedValueOnce({ builds: [] });

    const client = await createTestClient(registerValidationRunTools);
    const result = await client.callTool({
      name: "get_validation_runs",
      arguments: { project: "myproject", branch: "main", build: "missing" },
    });

    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual([]);
  });

  it("passes the validationStamp filter to the GraphQL client", async () => {
    mockRequest.mockResolvedValueOnce({ builds: [{ validationRuns: [] }] });

    const client = await createTestClient(registerValidationRunTools);
    await client.callTool({
      name: "get_validation_runs",
      arguments: { project: "myproject", branch: "main", build: "1.0.1", validationStamp: "CI" },
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ validationStamp: "CI" })
    );
  });
});

describe("create_validation_run", () => {
  it("returns the created validation run", async () => {
    const run = { id: 10, runOrder: 1, lastStatus: { statusID: { id: "PASSED", name: "Passed" } } };
    mockRequest.mockResolvedValueOnce({ createValidationRun: { validationRun: run, userErrors: [] } });

    const client = await createTestClient(registerValidationRunTools);
    const result = await client.callTool({
      name: "create_validation_run",
      arguments: { project: "myproject", branch: "main", build: "1.0.1", validationStamp: "CI", status: "PASSED" },
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(run);
  });

  it("returns an error when userErrors is non-empty", async () => {
    mockRequest.mockResolvedValueOnce({
      createValidationRun: { validationRun: null, userErrors: [{ message: "Validation stamp not found" }] },
    });

    const client = await createTestClient(registerValidationRunTools);
    const result = await client.callTool({
      name: "create_validation_run",
      arguments: { project: "myproject", branch: "main", build: "1.0.1", validationStamp: "MISSING", status: "FAILED" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain("Validation stamp not found");
  });

  it("is not registered when mutations are disabled", async () => {
    const client = await createTestClient(registerValidationRunTools, false);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).not.toContain("create_validation_run");
  });

  it("is registered when mutations are enabled", async () => {
    const client = await createTestClient(registerValidationRunTools, true);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("create_validation_run");
  });
});
