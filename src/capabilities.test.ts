import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCapabilityProbe } from "./capabilities.js";

vi.mock("./client.js", () => ({
  gqlClient: { request: vi.fn() },
}));

const { gqlClient } = await import("./client.js");
const mockRequest = gqlClient.request as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockRequest.mockReset();
});

describe("capability probe (auto)", () => {
  it("detects Yontrack 6 when both Readiness and AgentPolicy exist", async () => {
    mockRequest.mockResolvedValueOnce({
      readiness: { name: "Readiness" },
      agentPolicy: { name: "AgentPolicy" },
      searchResults: { name: "SearchResults" },
    });

    const probe = createCapabilityProbe("auto");

    expect(await probe.get()).toEqual({ agentTools: true, agentPolicy: true, searchResults: true });
  });

  it("detects Yontrack 5 when neither type exists", async () => {
    mockRequest.mockResolvedValueOnce({ readiness: null, agentPolicy: null, searchResults: null });

    const probe = createCapabilityProbe("auto");

    expect(await probe.get()).toEqual({ agentTools: false, agentPolicy: false, searchResults: false });
  });

  it("enables agent tools without agent_policy when only Readiness exists", async () => {
    mockRequest.mockResolvedValueOnce({
      readiness: { name: "Readiness" },
      agentPolicy: null,
      searchResults: { name: "SearchResults" },
    });

    const probe = createCapabilityProbe("auto");

    expect(await probe.get()).toEqual({ agentTools: true, agentPolicy: false, searchResults: true });
  });

  it("caches a definite answer for the life of the probe", async () => {
    mockRequest.mockResolvedValueOnce({ readiness: null, agentPolicy: null, searchResults: null });

    const probe = createCapabilityProbe("auto");
    await probe.get();
    await probe.get();

    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("hides the tools and falls back to the v5 search on a probe error, and probes again next time", async () => {
    mockRequest
      .mockRejectedValueOnce(new Error("connection refused"))
      .mockResolvedValueOnce({
        readiness: { name: "Readiness" },
        agentPolicy: { name: "AgentPolicy" },
        searchResults: { name: "SearchResults" },
      });

    const probe = createCapabilityProbe("auto");

    expect(await probe.get()).toEqual({ agentTools: false, agentPolicy: false, searchResults: false });
    expect(await probe.get()).toEqual({ agentTools: true, agentPolicy: true, searchResults: true });
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });
});

describe("capability probe (override)", () => {
  it("forces the tools on when set to true, still probing the search API", async () => {
    mockRequest.mockResolvedValueOnce({ readiness: null, agentPolicy: null, searchResults: null });

    const probe = createCapabilityProbe("true");

    expect(await probe.get()).toEqual({ agentTools: true, agentPolicy: true, searchResults: false });
  });

  it("forces the tools off when set to false, still probing the search API", async () => {
    mockRequest.mockResolvedValueOnce({
      readiness: { name: "Readiness" },
      agentPolicy: { name: "AgentPolicy" },
      searchResults: { name: "SearchResults" },
    });

    const probe = createCapabilityProbe("false");

    expect(await probe.get()).toEqual({ agentTools: false, agentPolicy: false, searchResults: true });
  });

  it("keeps the override on a probe error, with the v5 search", async () => {
    mockRequest.mockRejectedValueOnce(new Error("connection refused"));

    const probe = createCapabilityProbe("true");

    expect(await probe.get()).toEqual({ agentTools: true, agentPolicy: true, searchResults: false });
  });
});
