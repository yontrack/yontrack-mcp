import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestClient } from "../test/helpers.js";
import { registerPromotionLevelTools } from "./promotion-levels.js";

vi.mock("../client.js", () => ({
  gqlClient: { request: vi.fn() },
}));

vi.mock("../utils.js", () => ({
  resolveBranchId: vi.fn().mockResolvedValue(42),
}));

vi.mock("../config.js", () => ({
  config: { YONTRACK_URL: "https://yontrack.example.com", YONTRACK_TOKEN: "test-token" },
  mutationsEnabled: false,
  oauthConfig: null,
}));

const { gqlClient } = await import("../client.js");
const mockRequest = gqlClient.request as ReturnType<typeof vi.fn>;
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockRequest.mockReset();
  mockFetch.mockReset();
});

describe("list_promotion_levels", () => {
  it("returns promotion levels for a branch", async () => {
    const levels = [
      { id: 1, name: "BRONZE", description: "Bronze level" },
      { id: 2, name: "SILVER", description: "Silver level" },
    ];
    mockRequest.mockResolvedValueOnce({ branches: [{ promotionLevels: levels }] });

    const client = await createTestClient(registerPromotionLevelTools);
    const result = await client.callTool({
      name: "list_promotion_levels",
      arguments: { project: "myproject", branch: "main" },
    });

    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(levels);
  });

  it("returns empty array when branch not found", async () => {
    mockRequest.mockResolvedValueOnce({ branches: [] });

    const client = await createTestClient(registerPromotionLevelTools);
    const result = await client.callTool({
      name: "list_promotion_levels",
      arguments: { project: "myproject", branch: "missing" },
    });

    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual([]);
  });
});

describe("get_promotion_level_image", () => {
  it("returns base64-encoded PNG image when available", async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    const expectedBase64 = Buffer.from(pngBytes).toString("base64");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(pngBytes.buffer),
    });

    const client = await createTestClient(registerPromotionLevelTools);
    const result = await client.callTool({
      name: "get_promotion_level_image",
      arguments: { promotionLevelId: 1 },
    });

    expect(result.isError).toBeFalsy();
    const item = (result.content as { type: string; data: string; mimeType: string }[])[0];
    expect(item.type).toBe("image");
    expect(item.mimeType).toBe("image/png");
    expect(item.data).toBe(expectedBase64);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://yontrack.example.com/rest/structure/promotionLevels/1/image",
      { headers: { "X-Ontrack-Token": "test-token" } }
    );
  });

  it("returns error when image is not found", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const client = await createTestClient(registerPromotionLevelTools);
    const result = await client.callTool({
      name: "get_promotion_level_image",
      arguments: { promotionLevelId: 99 },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain("99");
    expect(text).toContain("404");
  });
});

describe("create_promotion_level", () => {
  it("returns the created promotion level", async () => {
    const level = { id: 3, name: "GOLD", description: "Gold level", branch: { id: 42, name: "main" } };
    mockRequest.mockResolvedValueOnce({ createPromotionLevelById: { promotionLevel: level, userErrors: [] } });

    const client = await createTestClient(registerPromotionLevelTools);
    const result = await client.callTool({
      name: "create_promotion_level",
      arguments: { project: "myproject", branch: "main", name: "GOLD", description: "Gold level" },
    });

    expect(result.isError).toBeFalsy();
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(JSON.parse(text)).toEqual(level);
  });

  it("returns an error when userErrors is non-empty", async () => {
    mockRequest.mockResolvedValueOnce({
      createPromotionLevelById: { promotionLevel: null, userErrors: [{ message: "Promotion level already exists" }] },
    });

    const client = await createTestClient(registerPromotionLevelTools);
    const result = await client.callTool({
      name: "create_promotion_level",
      arguments: { project: "myproject", branch: "main", name: "BRONZE" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toContain("Promotion level already exists");
  });

  it("is not registered when mutations are disabled", async () => {
    const client = await createTestClient(registerPromotionLevelTools, false);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).not.toContain("create_promotion_level");
  });

  it("is registered when mutations are enabled", async () => {
    const client = await createTestClient(registerPromotionLevelTools, true);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("create_promotion_level");
  });
});
