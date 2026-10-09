# Agent-context tools are Yontrack 6 only, gated by a schema probe

The agent-context tools (`build_readiness`, `changes_since_deployed`, `deployments`, `dependency_builds_at_level`, `agent_policy`, yontrack/yontrack-mcp#1) are only registered when the connected Yontrack supports them, even though three of them could be answered by Yontrack 5 GraphQL. One code path, one test matrix and no degraded Yontrack 5 output shape were preferred over serving Yontrack 5 users, who are not the audience of the agentic SDLC initiative. The existing tools stay compatible with Yontrack 5.

Support is detected by **probing the schema** (`__type(name: "Readiness")`, `__type(name: "AgentPolicy")`), not by reading `info { version }`: the `6.0-alpha.0` pre-release reports 6.x without having readiness. A definite answer is cached for the life of the process; a probe error is not cached (the tools are hidden for that request and the next one probes again; in `stdio` mode the server is built once at startup, so a failed probe lasts until a restart). `YONTRACK_AGENT_TOOLS=true|false` overrides the probe. The same probe selects the schema served by `yontrack://schema` (`yontrack-v5.graphql` or `yontrack-v6.graphql`).

The agent session headers (`X-Yontrack-Agent-Session[-Link]`) are **not** gated: Yontrack 5 ignores them and Yontrack 6 ignores them for non-agent tokens, so they are sent whenever a session is known — from the incoming MCP request first (a shared HTTP deployment serves many agents), else from `YONTRACK_AGENT_SESSION[_LINK]`. The session and its link are taken as a pair from one source, never mixed, so that a link always belongs to its session.

## Considered options

- Register unconditionally and let Yontrack 5 fail, or fail with a clear error per call: agents would see tools they cannot use.
- Gate per tool, keeping `deployments` and `dependency_builds_at_level` on Yontrack 5: twice the tests and a Yontrack 5 output shape for agents to cope with.
- Make the whole server Yontrack 6 only: needlessly breaks existing Yontrack 5 users.
