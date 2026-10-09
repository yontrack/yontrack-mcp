import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestClient } from "../test/helpers.js";
import { registerAgentContextTools } from "./agent-context.js";
import type { Capabilities } from "../capabilities.js";

vi.mock("../client.js", () => ({
  gqlClient: { request: vi.fn() },
}));

vi.mock("../config.js", () => ({
  config: {
    YONTRACK_URL: "https://yontrack.example.com",
    YONTRACK_TOKEN: "test-token",
    YONTRACK_UI_URL: "https://ui.example.com",
  },
  mutationsEnabled: false,
  oauthConfig: null,
}));

const { gqlClient } = await import("../client.js");
const { config } = await import("../config.js");
const mockRequest = gqlClient.request as ReturnType<typeof vi.fn>;

const V6: Capabilities = { agentTools: true, agentPolicy: true };

function connect(capabilities: Capabilities = V6) {
  return createTestClient((server) => registerAgentContextTools(server, capabilities));
}

async function call(name: string, args: Record<string, unknown>) {
  const client = await connect();
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as { type: string; text: string }[])[0].text;
  return { isError: result.isError, text, json: () => JSON.parse(text) };
}

beforeEach(() => {
  mockRequest.mockReset();
  config.YONTRACK_UI_URL = "https://ui.example.com";
});

const BUILD = { id: "42", name: "1.2.3", displayName: "v1.2.3" };

describe("build_readiness", () => {
  it("lists what is missing for a promotion level", async () => {
    mockRequest
      .mockResolvedValueOnce({
        builds: [{ ...BUILD, branch: { promotionLevels: [{ id: "7", name: "GOLD" }] } }],
      })
      .mockResolvedValueOnce({
        builds: [{
          readiness: {
            ready: false,
            missing: [
              { kind: "VALIDATION", name: "unit-tests", message: "unit-tests has not passed" },
              { kind: "MANUAL", name: "GOLD", message: "requires a manual approval" },
            ],
          },
        }],
      });

    const { isError, json } = await call("build_readiness", {
      project: "app", branch: "main", build: "1.2.3", promotionLevel: "GOLD",
    });

    expect(isError).toBeFalsy();
    expect(json()).toEqual({
      build: { name: "1.2.3", displayName: "v1.2.3", link: "https://ui.example.com/build/42" },
      target: { kind: "promotionLevel", name: "GOLD", link: "https://ui.example.com/promotionLevel/7" },
      ready: false,
      missing: [
        { kind: "VALIDATION", name: "unit-tests", message: "unit-tests has not passed" },
        { kind: "MANUAL", name: "GOLD", message: "requires a manual approval" },
      ],
    });
    expect(mockRequest).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ id: 42, promotionLevel: "GOLD" })
    );
  });

  it("is ready for a slot with nothing missing", async () => {
    mockRequest
      .mockResolvedValueOnce({
        builds: [{ ...BUILD, slots: [{ id: "s-1", qualifier: "eu", environment: { name: "production" }, lastDeployedPipeline: null }] }],
      })
      .mockResolvedValueOnce({ builds: [{ readiness: { ready: true, missing: [] } }] });

    const { json } = await call("build_readiness", {
      project: "app", branch: "main", build: "1.2.3", environment: "production", qualifier: "eu",
    });

    expect(json()).toMatchObject({
      target: { kind: "slot", name: "production/eu", link: "https://ui.example.com/extension/environments/slot/s-1" },
      ready: true,
      missing: [],
    });
    expect(mockRequest).toHaveBeenNthCalledWith(1, expect.any(String), expect.objectContaining({ environment: "production", qualifier: "eu" }));
    expect(mockRequest).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ slotId: "s-1", promotionLevel: null }));
  });

  it("targets the default slot when no qualifier is given", async () => {
    mockRequest
      .mockResolvedValueOnce({
        builds: [{ ...BUILD, slots: [{ id: "s-0", qualifier: "", environment: { name: "staging" }, lastDeployedPipeline: null }] }],
      })
      .mockResolvedValueOnce({ builds: [{ readiness: { ready: true, missing: [] } }] });

    const { json } = await call("build_readiness", {
      project: "app", branch: "main", build: "1.2.3", environment: "staging",
    });

    expect(json().target.name).toBe("staging");
    expect(mockRequest).toHaveBeenNthCalledWith(1, expect.any(String), expect.objectContaining({ qualifier: "" }));
  });

  it("requires exactly one of promotionLevel or environment", async () => {
    const both = await call("build_readiness", {
      project: "app", branch: "main", build: "1.2.3", promotionLevel: "GOLD", environment: "production",
    });
    const none = await call("build_readiness", { project: "app", branch: "main", build: "1.2.3" });

    expect(both.isError).toBe(true);
    expect(none.isError).toBe(true);
    expect(both.text).toContain("Exactly one of 'promotionLevel' or 'environment'");
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("names the build when it does not exist", async () => {
    mockRequest.mockResolvedValueOnce({ builds: [] });

    const { isError, text } = await call("build_readiness", {
      project: "app", branch: "main", build: "9.9.9", promotionLevel: "GOLD",
    });

    expect(isError).toBe(true);
    expect(text).toContain("Build '9.9.9' not found");
  });

  it("names the promotion level when it does not exist on the branch", async () => {
    mockRequest.mockResolvedValueOnce({ builds: [{ ...BUILD, branch: { promotionLevels: [{ id: "7", name: "GOLD" }] } }] });

    const { isError, text } = await call("build_readiness", {
      project: "app", branch: "main", build: "1.2.3", promotionLevel: "PLATINUM",
    });

    expect(isError).toBe(true);
    expect(text).toContain("Promotion level 'PLATINUM' not found");
  });

  it("names the slot when the project has none in the environment", async () => {
    mockRequest.mockResolvedValueOnce({ builds: [{ ...BUILD, slots: [] }] });

    const { isError, text } = await call("build_readiness", {
      project: "app", branch: "main", build: "1.2.3", environment: "production",
    });

    expect(isError).toBe(true);
    expect(text).toContain("No slot for project 'app' in environment 'production'");
  });

  it("leaves out UI links when YONTRACK_UI_URL is not set", async () => {
    config.YONTRACK_UI_URL = undefined;
    mockRequest
      .mockResolvedValueOnce({ builds: [{ ...BUILD, branch: { promotionLevels: [{ id: "7", name: "GOLD" }] } }] })
      .mockResolvedValueOnce({ builds: [{ readiness: { ready: true, missing: [] } }] });

    const { json } = await call("build_readiness", {
      project: "app", branch: "main", build: "1.2.3", promotionLevel: "GOLD",
    });

    expect(json().build).toEqual({ name: "1.2.3", displayName: "v1.2.3" });
    expect(json().target).toEqual({ kind: "promotionLevel", name: "GOLD" });
  });
});

const DEPLOYED = { id: "40", name: "1.2.1", displayName: "v1.2.1" };

function slotResolution(lastDeployedPipeline: unknown) {
  return {
    builds: [{
      ...BUILD,
      slots: [{ id: "s-1", qualifier: "", environment: { name: "production" }, lastDeployedPipeline }],
    }],
  };
}

function changeLog(commitCount: number) {
  return {
    scmChangeLog: {
      commits: Array.from({ length: commitCount }, (_, i) => ({
        commit: {
          shortId: `c${i}`,
          message: `Change ${i}\n\nLonger body`,
          author: "alice",
          timestamp: "2026-10-01T10:00:00",
          link: `https://git.example.com/c${i}`,
          assistants: i === 0
            ? [{ name: "Claude Code", markers: ["CO_AUTHOR", "SESSION_TRAILER"], sessionLink: "https://claude.ai/code/x" }]
            : [],
        },
      })),
      issues: {
        issues: [{ displayKey: "#12", summary: "Fix login", status: { name: "closed" }, url: "https://git.example.com/issues/12" }],
      },
      linkChanges: [{
        project: { name: "lib" },
        qualifier: "",
        from: { name: "2.0.0", displayName: "2.0.0" },
        to: { name: "2.1.0", displayName: "2.1.0" },
      }],
    },
  };
}

describe("changes_since_deployed", () => {
  it("lists the changes between what is deployed in a slot and the candidate", async () => {
    mockRequest
      .mockResolvedValueOnce(slotResolution({ id: "p-9", number: 9, build: DEPLOYED }))
      .mockResolvedValueOnce(changeLog(1));

    const { isError, json } = await call("changes_since_deployed", {
      project: "app", branch: "main", build: "1.2.3", environment: "production",
    });

    expect(isError).toBeFalsy();
    expect(json()).toEqual({
      baseline: {
        name: "1.2.1", displayName: "v1.2.1", link: "https://ui.example.com/build/40",
        via: "slot", target: "production",
        pipeline: { number: 9, link: "https://ui.example.com/extension/environments/pipeline/p-9" },
      },
      candidate: { name: "1.2.3", displayName: "v1.2.3", link: "https://ui.example.com/build/42" },
      commits: [{
        shortId: "c0",
        message: "Change 0",
        author: "alice",
        timestamp: "2026-10-01T10:00:00",
        link: "https://git.example.com/c0",
        assistants: [{ name: "Claude Code", markers: ["CO_AUTHOR", "SESSION_TRAILER"], sessionLink: "https://claude.ai/code/x" }],
      }],
      issues: [{ displayKey: "#12", summary: "Fix login", status: "closed", url: "https://git.example.com/issues/12" }],
      linkChanges: [{ project: "lib", qualifier: "", from: "2.0.0", to: "2.1.0" }],
      truncated: false,
      totalCommits: 1,
    });
    expect(mockRequest).toHaveBeenLastCalledWith(expect.any(String), { from: 40, to: 42 });
  });

  it("answers with no baseline when nothing is deployed in the slot yet", async () => {
    mockRequest.mockResolvedValueOnce(slotResolution(null));

    const { isError, json } = await call("changes_since_deployed", {
      project: "app", branch: "main", build: "1.2.3", environment: "production",
    });

    expect(isError).toBeFalsy();
    expect(json()).toMatchObject({
      baseline: null,
      reason: "Nothing has been deployed yet in production",
      candidate: { name: "1.2.3" },
    });
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("uses the last build at a promotion level on the same branch as baseline", async () => {
    mockRequest
      .mockResolvedValueOnce({ builds: [{ ...BUILD, branch: { promotionLevels: [{ id: "7", name: "GOLD" }] } }] })
      .mockResolvedValueOnce({ builds: [DEPLOYED] })
      .mockResolvedValueOnce(changeLog(2));

    const { json } = await call("changes_since_deployed", {
      project: "app", branch: "main", build: "1.2.3", promotionLevel: "GOLD",
    });

    expect(json().baseline).toEqual({
      name: "1.2.1", displayName: "v1.2.1", link: "https://ui.example.com/build/40", via: "promotionLevel", target: "GOLD",
    });
    expect(json().totalCommits).toBe(2);
    expect(mockRequest).toHaveBeenNthCalledWith(2, expect.any(String), { project: "app", branch: "main", promotionLevel: "GOLD" });
  });

  it("answers with no baseline when no build of the branch is at the level yet", async () => {
    mockRequest
      .mockResolvedValueOnce({ builds: [{ ...BUILD, branch: { promotionLevels: [{ id: "7", name: "GOLD" }] } }] })
      .mockResolvedValueOnce({ builds: [] });

    const { json } = await call("changes_since_deployed", {
      project: "app", branch: "main", build: "1.2.3", promotionLevel: "GOLD",
    });

    expect(json()).toMatchObject({ baseline: null, reason: "No build of branch 'main' has been promoted to GOLD yet" });
  });

  it("returns an empty change log when the candidate is what is deployed", async () => {
    mockRequest.mockResolvedValueOnce(slotResolution({ id: "p-9", number: 9, build: BUILD }));

    const { json } = await call("changes_since_deployed", {
      project: "app", branch: "main", build: "1.2.3", environment: "production",
    });

    expect(json()).toMatchObject({ commits: [], issues: [], linkChanges: [], truncated: false, totalCommits: 0 });
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("truncates the commits to maxCommits and says so", async () => {
    mockRequest
      .mockResolvedValueOnce(slotResolution({ id: "p-9", number: 9, build: DEPLOYED }))
      .mockResolvedValueOnce(changeLog(5));

    const { json } = await call("changes_since_deployed", {
      project: "app", branch: "main", build: "1.2.3", environment: "production", maxCommits: 3,
    });

    expect(json().commits.map((c: { shortId: string }) => c.shortId)).toEqual(["c0", "c1", "c2"]);
    expect(json().truncated).toBe(true);
    expect(json().totalCommits).toBe(5);
  });

  it("says so when the project has no SCM change log", async () => {
    mockRequest
      .mockResolvedValueOnce(slotResolution({ id: "p-9", number: 9, build: DEPLOYED }))
      .mockResolvedValueOnce({ scmChangeLog: null });

    const { isError, json } = await call("changes_since_deployed", {
      project: "app", branch: "main", build: "1.2.3", environment: "production",
    });

    expect(isError).toBeFalsy();
    expect(json()).toMatchObject({ commits: [], reason: "No SCM change log is available for this project" });
  });
});

describe("deployments", () => {
  const environments = {
    environments: [
      {
        name: "production",
        order: 20,
        slots: [{
          id: "s-p",
          qualifier: "",
          lastDeployedPipeline: { id: "p-9", number: 9, end: "2026-10-01T12:00:00", build: DEPLOYED },
          currentPipeline: { id: "p-10", number: 10, status: "RUNNING", build: BUILD },
        }],
      },
      { name: "sandbox", order: 0, slots: [] },
      {
        name: "staging",
        order: 10,
        slots: [{
          id: "s-s",
          qualifier: "",
          lastDeployedPipeline: { id: "p-5", number: 5, end: "2026-10-02T08:00:00", build: BUILD },
          currentPipeline: { id: "p-5", number: 5, status: "DONE", build: BUILD },
        }],
      },
    ],
  };

  it("tells what is deployed where for a project, in environment order", async () => {
    mockRequest.mockResolvedValueOnce(environments);

    const { isError, json } = await call("deployments", { project: "app" });

    expect(isError).toBeFalsy();
    expect(json()).toEqual({
      project: "app",
      environments: [
        {
          name: "staging",
          order: 10,
          slots: [{
            qualifier: "",
            link: "https://ui.example.com/extension/environments/slot/s-s",
            deployed: {
              name: "1.2.3", displayName: "v1.2.3", link: "https://ui.example.com/build/42",
              pipeline: { number: 5, finishedAt: "2026-10-02T08:00:00", link: "https://ui.example.com/extension/environments/pipeline/p-5" },
            },
          }],
        },
        {
          name: "production",
          order: 20,
          slots: [{
            qualifier: "",
            link: "https://ui.example.com/extension/environments/slot/s-p",
            deployed: {
              name: "1.2.1", displayName: "v1.2.1", link: "https://ui.example.com/build/40",
              pipeline: { number: 9, finishedAt: "2026-10-01T12:00:00", link: "https://ui.example.com/extension/environments/pipeline/p-9" },
            },
            inProgress: {
              name: "1.2.3", displayName: "v1.2.3", link: "https://ui.example.com/build/42",
              status: "RUNNING",
              pipeline: { number: 10, link: "https://ui.example.com/extension/environments/pipeline/p-10" },
            },
          }],
        },
      ],
    });
    expect(mockRequest).toHaveBeenCalledWith(expect.any(String), { project: "app" });
  });

  it("reports a slot where nothing is deployed yet", async () => {
    mockRequest.mockResolvedValueOnce({
      environments: [{ name: "production", order: 1, slots: [{ id: "s-p", qualifier: "eu", lastDeployedPipeline: null, currentPipeline: null }] }],
    });

    const { json } = await call("deployments", { project: "app" });

    expect(json().environments[0].slots).toEqual([
      { qualifier: "eu", link: "https://ui.example.com/extension/environments/slot/s-p", deployed: null },
    ]);
  });

  it("keeps only the requested environment", async () => {
    mockRequest.mockResolvedValueOnce(environments);

    const { json } = await call("deployments", { project: "app", environment: "production" });

    expect(json().environments.map((e: { name: string }) => e.name)).toEqual(["production"]);
  });

  it("names the environment when the project has no slot in it", async () => {
    mockRequest.mockResolvedValueOnce(environments);

    const { isError, text } = await call("deployments", { project: "app", environment: "qa" });

    expect(isError).toBe(true);
    expect(text).toContain("No slot for project 'app' in environment 'qa'");
  });
});

describe("dependency_builds_at_level", () => {
  const builds = {
    builds: [
      {
        id: "30", name: "2.0.0", displayName: "2.0.0", branch: { name: "main" }, creation: { time: "2026-09-01T10:00:00" },
        promotionRuns: [{ creation: { time: "2026-09-02T10:00:00" } }],
      },
      {
        id: "31", name: "2.1.0", displayName: "2.1.0", branch: { name: "main" }, creation: { time: "2026-09-10T10:00:00" },
        promotionRuns: [{ creation: { time: "2026-09-11T10:00:00" } }, { creation: { time: "2026-09-12T10:00:00" } }],
      },
    ],
  };

  it("lists the builds of a branch at a promotion level, newest first", async () => {
    mockRequest.mockResolvedValueOnce(builds);

    const { isError, json } = await call("dependency_builds_at_level", {
      project: "lib", promotionLevel: "GOLD", branch: "main",
    });

    expect(isError).toBeFalsy();
    expect(json()).toEqual({
      project: "lib",
      promotionLevel: "GOLD",
      builds: [
        {
          name: "2.1.0", displayName: "2.1.0", link: "https://ui.example.com/build/31", branch: "main",
          creationTime: "2026-09-10T10:00:00", promotedAt: "2026-09-12T10:00:00",
        },
        {
          name: "2.0.0", displayName: "2.0.0", link: "https://ui.example.com/build/30", branch: "main",
          creationTime: "2026-09-01T10:00:00", promotedAt: "2026-09-02T10:00:00",
        },
      ],
    });
    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining("buildBranchFilter"),
      { project: "lib", branch: "main", promotionLevel: "GOLD", count: 10 }
    );
  });

  it("searches the whole project when no branch is given", async () => {
    mockRequest.mockResolvedValueOnce(builds);

    await call("dependency_builds_at_level", { project: "lib", promotionLevel: "GOLD", count: 5 });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining("buildProjectFilter"),
      { project: "lib", promotionLevel: "GOLD", count: 5 }
    );
  });

  it("leaves out builds which matched the search without being promoted to the level itself", async () => {
    mockRequest.mockResolvedValueOnce({
      builds: [
        ...builds.builds,
        { id: "32", name: "2.2.0", displayName: "2.2.0", branch: { name: "main" }, creation: { time: "2026-09-20T10:00:00" }, promotionRuns: [] },
      ],
    });

    const { json } = await call("dependency_builds_at_level", { project: "lib", promotionLevel: "GOLD" });

    expect(json().builds.map((b: { name: string }) => b.name)).toEqual(["2.1.0", "2.0.0"]);
  });

  it("returns no builds when none is at the level", async () => {
    mockRequest.mockResolvedValueOnce({ builds: [] });

    const { isError, json } = await call("dependency_builds_at_level", { project: "lib", promotionLevel: "GOLD" });

    expect(isError).toBeFalsy();
    expect(json().builds).toEqual([]);
  });
});

describe("agent_policy", () => {
  it("tells an agent what it may do on a project", async () => {
    mockRequest.mockResolvedValueOnce({
      user: {
        agentPolicy: {
          owner: "Alice Example",
          canRecordEvidence: true,
          promotionLevels: [{ id: 7, branch: "main", name: "BRONZE" }],
          slots: [{ id: "s-s", environment: "staging", qualifier: "", manualApproval: false }],
        },
      },
    });

    const { isError, json } = await call("agent_policy", { project: "app", branch: "main" });

    expect(isError).toBeFalsy();
    expect(json()).toEqual({
      agent: true,
      owner: "Alice Example",
      canRecordEvidence: true,
      promotionLevels: [{ branch: "main", name: "BRONZE" }],
      slots: [{ environment: "staging", qualifier: "", manualApproval: false }],
    });
    expect(mockRequest).toHaveBeenCalledWith(expect.any(String), { project: "app", branch: "main" });
  });

  it("tells a human token that it is not an agent", async () => {
    mockRequest.mockResolvedValueOnce({ user: { agentPolicy: null } });

    const { isError, json } = await call("agent_policy", { project: "app" });

    expect(isError).toBeFalsy();
    expect(json()).toEqual({ agent: false });
  });
});

describe("registration", () => {
  const AGENT_TOOLS = ["build_readiness", "changes_since_deployed", "deployments", "dependency_builds_at_level"];

  async function toolNames(capabilities: Capabilities) {
    // Another tool is always present, as on the real server, so that tools/list is available
    const client = await createTestClient((server) => {
      server.tool("list_projects", "Other tool", async () => ({ content: [] }));
      registerAgentContextTools(server, capabilities);
    });
    const { tools } = await client.listTools();
    return tools.map((t) => t.name).filter((name) => name !== "list_projects");
  }

  it("registers all agent-context tools on Yontrack 6", async () => {
    expect(await toolNames(V6)).toEqual(expect.arrayContaining([...AGENT_TOOLS, "agent_policy"]));
  });

  it("registers no agent-context tool on Yontrack 5", async () => {
    expect(await toolNames({ agentTools: false, agentPolicy: false })).toEqual([]);
  });

  it("registers agent_policy on its own probe, independently of readiness", async () => {
    expect(await toolNames({ agentTools: false, agentPolicy: true })).toEqual(["agent_policy"]);
  });

  it("leaves out agent_policy when the instance has readiness but no agent policy", async () => {
    const names = await toolNames({ agentTools: true, agentPolicy: false });
    expect(names).toEqual(expect.arrayContaining(AGENT_TOOLS));
    expect(names).not.toContain("agent_policy");
  });
});
