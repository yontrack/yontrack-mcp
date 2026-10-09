import { gqlClient } from "./client.js";
import { config } from "./config.js";

/**
 * Features of the connected Yontrack instance which gate the agent-context tools
 * and select the search API.
 * They are detected by probing the schema, not by reading the version string:
 * a 6.0 pre-release may report 6.x without having these types (see ADR 0001).
 */
export interface Capabilities {
  /** `Build.readiness` is available (Yontrack 6): agent-context tools and the V6 schema resource */
  agentTools: boolean;
  /** `User.agentPolicy` is available: the `agent_policy` tool */
  agentPolicy: boolean;
  /**
   * `search(query, types)` returning `SearchResults` is available (Yontrack 6): one request for all types.
   * Always probed, whatever `YONTRACK_AGENT_TOOLS` says (see ADR 0002).
   */
  searchResults: boolean;
}

export type AgentToolsMode = "auto" | "true" | "false";

const PROBE = `
  query ProbeCapabilities {
    readiness: __type(name: "Readiness") { name }
    agentPolicy: __type(name: "AgentPolicy") { name }
    searchResults: __type(name: "SearchResults") { name }
  }
`;

type Probed = { agentTools: boolean; agentPolicy: boolean };

const OVERRIDES: Record<AgentToolsMode, Probed | undefined> = {
  auto: undefined,
  true: { agentTools: true, agentPolicy: true },
  false: { agentTools: false, agentPolicy: false },
};

/**
 * A definite answer is cached for the life of the probe. A probe error is not
 * cached: the tools are hidden, the search falls back to the Yontrack 5 API
 * (still accepted by Yontrack 6) for that call, and the next call probes again.
 * `YONTRACK_AGENT_TOOLS` overrides the agent-context tools only.
 */
export function createCapabilityProbe(mode: AgentToolsMode) {
  const override = OVERRIDES[mode];
  let cached: Capabilities | undefined;

  async function get(): Promise<Capabilities> {
    if (cached) return cached;
    try {
      const data = await gqlClient.request<{
        readiness: { name: string } | null;
        agentPolicy: { name: string } | null;
        searchResults: { name: string } | null;
      }>(PROBE);
      cached = {
        agentTools: data.readiness != null,
        agentPolicy: data.agentPolicy != null,
        ...override,
        searchResults: data.searchResults != null,
      };
      return cached;
    } catch (err) {
      process.stderr.write(
        `Could not probe Yontrack capabilities${override ? "" : ", hiding agent-context tools for now"}: ${err instanceof Error ? err.message : String(err)}\n`
      );
      return { agentTools: false, agentPolicy: false, ...override, searchResults: false };
    }
  }

  return { get };
}

const probe = createCapabilityProbe(config.YONTRACK_AGENT_TOOLS);

export const getCapabilities = probe.get;
