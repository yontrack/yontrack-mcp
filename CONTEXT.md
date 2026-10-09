# yontrack-mcp

An MCP server giving AI agents read (and optionally write) access to a Yontrack instance through its GraphQL API.

## Language

**Agent-context tools**:
The read-only tools answering what an agent needs before promoting or deploying: readiness, changes since deployed, deployments, dependency builds at a level, agent policy. Yontrack 6 only.
_Avoid_: V6 tools, agentic tools

**Capabilities**:
What the connected Yontrack instance supports, detected by probing its schema (not its version string). Gates the agent-context tools and selects the search API.
_Avoid_: version, feature flags

**Readiness**:
Whether a build may be promoted to a level or deployed to a slot, with every missing item and its kind (validation, promotion, check, admission rule, manual, agent policy).

**Slot**:
Where a project is deployed in an environment, named by the environment and an optional qualifier (`""` is the default slot).

**Baseline**:
The build a candidate is compared to: the last build deployed in a slot, or the last build at a promotion level on the candidate's branch.
_Avoid_: reference build, previous build

**Candidate**:
The build an agent considers promoting or deploying.

**Agent account**:
A Yontrack account of kind `AGENT`, owned by a person. Its token is an ordinary API token; there is no separate agent token setting.

**Agent session**:
One working session of an agent, identified by an opaque ID and an optional link, sent to Yontrack as the `X-Yontrack-Agent-Session[-Link]` headers. Taken from the incoming MCP request, or else from the environment; never invented.

**Agent policy**:
What an agent account may do on a project: record evidence, the promotion levels it may promote to, the slots it may deploy to.

## Relationships

- **Readiness** is asked for a **Candidate** against a promotion level or a **Slot**
- **Changes since deployed** go from a **Baseline** to a **Candidate**
- An **Agent session** only has an effect with the token of an **Agent account**
- **Capabilities** decide whether the **Agent-context tools** are listed at all, and which search API the search tools use

## Flagged ambiguities

- "Agent token" in the Yontrack issues means the token of an **Agent account**, not a distinct kind of token.
