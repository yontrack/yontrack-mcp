import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();

async function loadClient(env: Record<string, string | undefined> = {}) {
  vi.resetModules();
  delete process.env.YONTRACK_AGENT_SESSION;
  delete process.env.YONTRACK_AGENT_SESSION_LINK;
  Object.assign(process.env, env);
  const client = await import("./client.js");
  const session = await import("./session.js");
  return { ...client, ...session };
}

function sentHeaders(): Headers {
  const init = fetchMock.mock.calls[0][1] as RequestInit;
  return new Headers(init.headers);
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () =>
    new Response(JSON.stringify({ data: { ok: true } }), {
      headers: { "Content-Type": "application/json" },
    })
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.YONTRACK_AGENT_SESSION;
  delete process.env.YONTRACK_AGENT_SESSION_LINK;
});

describe("agent session headers", () => {
  it("sends no session headers when none is configured", async () => {
    const { gqlClient } = await loadClient();

    await gqlClient.request("{ ok }");

    const headers = sentHeaders();
    expect(headers.get("X-Ontrack-Token")).toBe("test-token");
    expect(headers.has("X-Yontrack-Agent-Session")).toBe(false);
    expect(headers.has("X-Yontrack-Agent-Session-Link")).toBe(false);
  });

  it("sends the session configured in the environment", async () => {
    const { gqlClient } = await loadClient({
      YONTRACK_AGENT_SESSION: "env-session",
      YONTRACK_AGENT_SESSION_LINK: "https://claude.ai/code/env-session",
    });

    await gqlClient.request("{ ok }");

    const headers = sentHeaders();
    expect(headers.get("X-Yontrack-Agent-Session")).toBe("env-session");
    expect(headers.get("X-Yontrack-Agent-Session-Link")).toBe("https://claude.ai/code/env-session");
  });

  it("prefers the session of the incoming MCP request over the environment", async () => {
    const { gqlClient, runWithAgentSession } = await loadClient({
      YONTRACK_AGENT_SESSION: "env-session",
      YONTRACK_AGENT_SESSION_LINK: "https://claude.ai/code/env-session",
    });

    await runWithAgentSession({ session: "req-session" }, () => gqlClient.request("{ ok }"));

    const headers = sentHeaders();
    expect(headers.get("X-Yontrack-Agent-Session")).toBe("req-session");
    // The environment link belongs to the environment session: never mixed with the request one
    expect(headers.has("X-Yontrack-Agent-Session-Link")).toBe(false);
  });

  it("forwards a request link without a session as is", async () => {
    const { gqlClient, runWithAgentSession } = await loadClient();

    await runWithAgentSession({ link: "https://claude.ai/code/abc" }, () => gqlClient.request("{ ok }"));

    const headers = sentHeaders();
    expect(headers.has("X-Yontrack-Agent-Session")).toBe(false);
    expect(headers.get("X-Yontrack-Agent-Session-Link")).toBe("https://claude.ai/code/abc");
  });

  it("falls back to the environment when the request carries no session headers", async () => {
    const { gqlClient, runWithAgentSession } = await loadClient({ YONTRACK_AGENT_SESSION: "env-session" });

    await runWithAgentSession({}, () => gqlClient.request("{ ok }"));

    expect(sentHeaders().get("X-Yontrack-Agent-Session")).toBe("env-session");
  });
});
