import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./server.js";
import type { Capabilities } from "./capabilities.js";

async function connect(capabilities: Capabilities) {
  const server = createServer(undefined, capabilities);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

describe("createServer", () => {
  it("exposes the agent-context tools and mentions them on Yontrack 6", async () => {
    const client = await connect({ agentTools: true, agentPolicy: true, searchResults: true });

    const names = (await client.listTools()).tools.map((t) => t.name);

    expect(names).toEqual(expect.arrayContaining(["list_projects", "build_readiness", "agent_policy"]));
    expect(client.getInstructions()).toContain("build_readiness");
    expect(client.getInstructions()).toContain("agent_policy");
  });

  it("hides the agent-context tools and does not mention them on Yontrack 5", async () => {
    const client = await connect({ agentTools: false, agentPolicy: false, searchResults: false });

    const names = (await client.listTools()).tools.map((t) => t.name);

    expect(names).toContain("list_projects");
    expect(names).not.toContain("build_readiness");
    expect(client.getInstructions()).not.toContain("build_readiness");
  });
});
