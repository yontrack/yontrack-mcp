import { AsyncLocalStorage } from "node:async_hooks";
import { config } from "./config.js";

/** Header names, identical on the incoming MCP request and on the outgoing Yontrack request. */
export const AGENT_SESSION_HEADER = "X-Yontrack-Agent-Session";
export const AGENT_SESSION_LINK_HEADER = "X-Yontrack-Agent-Session-Link";

export interface AgentSession {
  session?: string;
  link?: string;
}

const storage = new AsyncLocalStorage<AgentSession>();

/** Runs `fn` with the agent session carried by the incoming MCP request. */
export function runWithAgentSession<T>(session: AgentSession, fn: () => T): T {
  return storage.run(session, fn);
}

/** Reads the agent session headers of an incoming HTTP request (Node lower-cases header names). */
export function agentSessionFromHeaders(
  headers: Record<string, string | string[] | undefined>
): AgentSession {
  const read = (name: string) => {
    const value = headers[name.toLowerCase()];
    return (Array.isArray(value) ? value[0] : value) || undefined;
  };
  return { session: read(AGENT_SESSION_HEADER), link: read(AGENT_SESSION_LINK_HEADER) };
}

/**
 * Headers identifying the agent session, never invented:
 * the incoming MCP request's session headers when it carries any, the environment otherwise.
 * The session and its link are taken as a pair so that they always belong together.
 * Yontrack validates them and ignores them for non-agent tokens.
 */
export function agentSessionHeaders(): Record<string, string> {
  const fromRequest = storage.getStore();
  const { session, link } =
    fromRequest && (fromRequest.session || fromRequest.link)
      ? fromRequest
      : { session: config.YONTRACK_AGENT_SESSION, link: config.YONTRACK_AGENT_SESSION_LINK };
  return {
    ...(session && { [AGENT_SESSION_HEADER]: session }),
    ...(link && { [AGENT_SESSION_LINK_HEADER]: link }),
  };
}
