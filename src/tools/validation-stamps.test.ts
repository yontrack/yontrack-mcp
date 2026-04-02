import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestClient } from "../test/helpers.js";
import { registerValidationStampTools } from "./validation-stamps.js";

vi.mock("../client.js", () => ({
  gqlClient: { request: vi.fn() },
}));

vi.mock("../utils.js", () => ({
  resolveBranchId: vi.fn().mockResolvedValue(42),
}));

const { gqlClient } = await import("../client.js");
const mockRequest = gqlClient.request as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockRequest.mockReset();
});

describe("list_validation_stamps", () => {
  it("returns validation stamps for a branch", async () => {
    const stamps = [
      { id: 1, name: "CI", description: "Continuous integration" },
    ];
    mockRequest.mockResolvedValueOnce({ branches: [{ validationStamps: stamps }] });

    const client = await createTestClient(registerValidationStampTools);
    const result = await client.callTool({
      name: "list_validation_stamps",
      arguments: { project: "myproject", branch: "main" },
    });

    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(stamps);
  });

  it("returns empty array when branch not found", async () => {
    mockRequest.mockResolvedValueOnce({ branches: [] });

    const client = await createTestClient(registerValidationStampTools);
    const result = await client.callTool({
      name: "list_validation_stamps",
      arguments: { project: "myproject", branch: "missing" },
    });

    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual([]);
  });
});

describe("create_validation_stamp", () => {
  it("returns the created validation stamp", async () => {
    const stamp = { id: 5, name: "SECURITY", description: "Security scan" };
    mockRequest.mockResolvedValueOnce({ createValidationStampById: { validationStamp: stamp, userErrors: [] } });

    const client = await createTestClient(registerValidationStampTools);
    const result = await client.callTool({
      name: "create_validation_stamp",
      arguments: { project: "myproject", branch: "main", name: "SECURITY", description: "Security scan" },
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(stamp);
  });

  it("returns an error when userErrors is non-empty", async () => {
    mockRequest.mockResolvedValueOnce({
      createValidationStampById: { validationStamp: null, userErrors: [{ message: "Stamp already exists" }] },
    });

    const client = await createTestClient(registerValidationStampTools);
    const result = await client.callTool({
      name: "create_validation_stamp",
      arguments: { project: "myproject", branch: "main", name: "CI" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain("Stamp already exists");
  });

  it("is not registered when mutations are disabled", async () => {
    const client = await createTestClient(registerValidationStampTools, false);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).not.toContain("create_validation_stamp");
  });

  it("is registered when mutations are enabled", async () => {
    const client = await createTestClient(registerValidationStampTools, true);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("create_validation_stamp");
  });
});
