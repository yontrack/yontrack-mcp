import { gqlClient } from "./client.js";
import { config } from "./config.js";

/**
 * Features of the connected Yontrack instance which gate the agent-context tools.
 * They are detected by probing the schema, not by reading the version string:
 * a 6.0 pre-release may report 6.x without having these types (see ADR 0001).
 */
export interface Capabilities {
  /** `Build.readiness` is available (Yontrack 6): agent-context tools and the V6 schema resource */
  agentTools: boolean;
  /** `User.agentPolicy` is available: the `agent_policy` tool */
  agentPolicy: boolean;
}

export type AgentToolsMode = "auto" | "true" | "false";

const PROBE = `
  query ProbeCapabilities {
    readiness: __type(name: "Readiness") { name }
    agentPolicy: __type(name: "AgentPolicy") { name }
  }
`;

const NONE: Capabilities = { agentTools: false, agentPolicy: false };
const ALL: Capabilities = { agentTools: true, agentPolicy: true };

/**
 * A definite answer is cached for the life of the probe. A probe error is not
 * cached: the tools are hidden for that call and the next call probes again.
 */
export function createCapabilityProbe(mode: AgentToolsMode) {
  let cached: Capabilities | undefined;

  async function get(): Promise<Capabilities> {
    if (mode === "true") return ALL;
    if (mode === "false") return NONE;
    if (cached) return cached;
    try {
      const data = await gqlClient.request<{
        readiness: { name: string } | null;
        agentPolicy: { name: string } | null;
      }>(PROBE);
      cached = {
        agentTools: data.readiness != null,
        agentPolicy: data.agentPolicy != null,
      };
      return cached;
    } catch (err) {
      process.stderr.write(
        `Could not probe Yontrack capabilities, hiding agent-context tools for now: ${err instanceof Error ? err.message : String(err)}\n`
      );
      return NONE;
    }
  }

  return { get };
}

const probe = createCapabilityProbe(config.YONTRACK_AGENT_TOOLS);

export const getCapabilities = probe.get;
