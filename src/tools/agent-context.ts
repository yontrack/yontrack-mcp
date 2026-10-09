import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gqlClient } from "../client.js";
import type { Capabilities } from "../capabilities.js";
import {
  BuildRef,
  compactBuild,
  errorResult,
  jsonResult,
  resolveBuild,
  pipelineLink,
  slotLink,
  targetOf,
  withNotFound,
} from "./agent-context-support.js";

const READINESS = `
  query BuildReadiness($id: Int!, $promotionLevel: String, $slotId: String) {
    builds(id: $id) {
      readiness(promotionLevel: $promotionLevel, slotId: $slotId) {
        ready
        missing { kind name message }
      }
    }
  }
`;

const LAST_BUILD_AT_LEVEL = `
  query LastBuildAtLevel($project: String!, $branch: String!, $promotionLevel: String!) {
    builds(project: $project, branch: $branch, buildBranchFilter: { withPromotionLevel: $promotionLevel, count: 1 }) {
      id
      name
      displayName
    }
  }
`;

const CHANGE_LOG = `
  query ChangeLog($from: Int!, $to: Int!) {
    scmChangeLog(from: $from, to: $to) {
      commits {
        commit {
          shortId
          message
          author
          timestamp
          link
          assistants { name markers sessionLink }
        }
      }
      issues { issues { displayKey summary status { name } url } }
      linkChanges {
        project { name }
        qualifier
        from { name displayName }
        to { name displayName }
      }
    }
  }
`;

const DEPLOYMENTS = `
  query Deployments($project: String!) {
    environments(filter: { projects: [$project] }) {
      name
      order
      slots(projects: [$project]) {
        id
        qualifier
        lastDeployedPipeline { id number end build { id name displayName } }
        currentPipeline { id number status build { id name displayName } }
      }
    }
  }
`;

interface DeploymentsData {
  environments: Array<{
    name: string;
    order: number | null;
    slots: Array<{
      id: string;
      qualifier: string;
      lastDeployedPipeline: { id: string; number: number | null; end: string | null; build: BuildRef } | null;
      currentPipeline: { id: string; number: number | null; status: string; build: BuildRef } | null;
    }>;
  }>;
}

const BUILD_AT_LEVEL_FIELDS = `
  id
  name
  displayName
  branch { name }
  creation { time }
  promotionRuns(promotion: $promotionLevel) { creation { time } }
`;

const BRANCH_BUILDS_AT_LEVEL = `
  query BranchBuildsAtLevel($project: String!, $branch: String!, $promotionLevel: String!, $count: Int!) {
    builds(project: $project, branch: $branch, buildBranchFilter: { withPromotionLevel: $promotionLevel, count: $count }) {
      ${BUILD_AT_LEVEL_FIELDS}
    }
  }
`;

// buildBranchFilter requires a branch: across the project, the build search form is used instead
const PROJECT_BUILDS_AT_LEVEL = `
  query ProjectBuildsAtLevel($project: String!, $promotionLevel: String!, $count: Int!) {
    builds(project: $project, buildProjectFilter: { promotionName: $promotionLevel, maximumCount: $count }) {
      ${BUILD_AT_LEVEL_FIELDS}
    }
  }
`;

interface BuildAtLevel extends BuildRef {
  branch: { name: string };
  creation: { time: string | null } | null;
  promotionRuns: Array<{ creation: { time: string | null } | null }>;
}

const AGENT_POLICY = `
  query AgentPolicy($project: String!, $branch: String) {
    user {
      agentPolicy(project: $project) {
        owner
        canRecordEvidence
        promotionLevels(branch: $branch) { branch name }
        slots { environment qualifier manualApproval }
      }
    }
  }
`;

interface AgentPolicyData {
  user: {
    agentPolicy: {
      owner: string;
      canRecordEvidence: boolean;
      promotionLevels: Array<{ branch: string; name: string }>;
      slots: Array<{ environment: string; qualifier: string; manualApproval: boolean }>;
    } | null;
  } | null;
}

interface ChangeLogData {
  scmChangeLog: {
    commits: Array<{
      commit: {
        shortId: string;
        message: string;
        author: string;
        timestamp: string;
        link: string;
        assistants: Array<{ name: string; markers: string[]; sessionLink: string | null }>;
      };
    }>;
    issues: { issues: Array<{ displayKey: string | null; summary: string | null; status: { name: string | null } | null; url: string | null }> } | null;
    linkChanges: Array<{
      project: { name: string };
      qualifier: string;
      from: { name: string; displayName: string } | null;
      to: { name: string; displayName: string } | null;
    }>;
  } | null;
}

const buildArgs = {
  project: z.string().describe("Project name"),
  branch: z.string().describe("Branch name"),
  build: z.string().describe("Build name"),
};

const targetArgs = {
  promotionLevel: z.string().optional().describe("Promotion level name on the build's branch. Exactly one of promotionLevel or environment."),
  environment: z.string().optional().describe("Environment name, targeting the project's slot in it. Exactly one of promotionLevel or environment."),
  qualifier: z.string().optional().describe("Slot qualifier, with environment only (defaults to the default slot)"),
};

/**
 * Agent-context tools: read-only answers composed from the Yontrack 6 GraphQL API.
 * Only registered when the connected Yontrack supports them (see ADR 0001).
 */
export function registerAgentContextTools(server: McpServer, capabilities: Capabilities) {
  if (capabilities.agentTools) registerReadinessTools(server);

  if (capabilities.agentPolicy) server.tool(
    "agent_policy",
    "What may the agent behind the current token do on a project? The owner of the agent, whether it can record evidence (builds, validations, links), the promotion levels it may promote to and the slots it may deploy to. Returns { agent: false } for a human token.",
    {
      project: z.string().describe("Project name"),
      branch: z.string().optional().describe("Only the promotion levels of this branch"),
    },
    async ({ project, branch }) => {
      const data = await gqlClient.request<AgentPolicyData>(AGENT_POLICY, { project, branch: branch ?? null });
      const policy = data.user?.agentPolicy;
      if (!policy) return jsonResult({ agent: false });
      return jsonResult({
        agent: true,
        owner: policy.owner,
        canRecordEvidence: policy.canRecordEvidence,
        promotionLevels: policy.promotionLevels.map(({ branch, name }) => ({ branch, name })),
        slots: policy.slots.map(({ environment, qualifier, manualApproval }) => ({ environment, qualifier, manualApproval })),
      });
    }
  );
}

/** Tools built on `Build.readiness` and the other Yontrack 6 queries. */
function registerReadinessTools(server: McpServer) {
  server.tool(
    "build_readiness",
    "Is a build ready for a promotion level or a deployment slot, and what is missing? Lists every missing item (validation, promotion, check, admission rule, manual approval, agent policy). Read-only: promotes or deploys nothing.",
    { ...buildArgs, ...targetArgs },
    async (args) => {
      const target = targetOf(args);
      if (typeof target === "string") return errorResult(target);
      return withNotFound(async () => {
        const resolved = await resolveBuild(args.project, args.branch, args.build, target);
        const resolvedTarget = resolved.target!;
        const data = await gqlClient.request<{
          builds: Array<{ readiness: { ready: boolean; missing: Array<{ kind: string; name: string; message: string }> } }>;
        }>(READINESS, {
          id: Number(resolved.build.id),
          promotionLevel: resolvedTarget.kind === "promotionLevel" ? resolvedTarget.name : null,
          slotId: resolvedTarget.kind === "slot" ? resolvedTarget.id : null,
        });
        const readiness = data.builds?.[0]?.readiness;
        if (!readiness) return errorResult(`Build '${args.build}' not found on branch '${args.branch}' of project '${args.project}'`);
        return jsonResult({
          build: compactBuild(resolved.build),
          target: { kind: resolvedTarget.kind, name: resolvedTarget.name, link: resolvedTarget.link },
          ready: readiness.ready,
          missing: readiness.missing.map(({ kind, name, message }) => ({ kind, name, message })),
        });
      });
    }
  );

  server.tool(
    "changes_since_deployed",
    "What changed between what is deployed in a slot (or the newest build of the same branch promoted to a level) and a candidate build? Returns the commits (with the assistants which helped write them), the issues and the dependency changes.",
    {
      ...buildArgs,
      ...targetArgs,
      maxCommits: z.number().int().positive().optional().default(50).describe("Maximum number of commits to return"),
    },
    async (args) => {
      const target = targetOf(args);
      if (typeof target === "string") return errorResult(target);
      return withNotFound(async () => {
        const { build: candidate, target: resolvedTarget } = await resolveBuild(args.project, args.branch, args.build, target);

        let baselineBuild: BuildRef | undefined;
        let pipeline: { number: number | null; link: string | undefined } | undefined;
        if (resolvedTarget!.kind === "slot") {
          const deployed = resolvedTarget!.slot.lastDeployedPipeline;
          if (deployed) {
            baselineBuild = deployed.build;
            pipeline = { number: deployed.number, link: pipelineLink(deployed.id) };
          }
        } else {
          const data = await gqlClient.request<{ builds: BuildRef[] }>(LAST_BUILD_AT_LEVEL, {
            project: args.project, branch: args.branch, promotionLevel: resolvedTarget!.name,
          });
          baselineBuild = data.builds?.[0];
        }

        const result = { candidate: compactBuild(candidate) };
        if (!baselineBuild) {
          return jsonResult({
            baseline: null,
            reason: resolvedTarget!.kind === "slot"
              ? `Nothing has been deployed yet in ${resolvedTarget!.name}`
              : `No build of branch '${args.branch}' has been promoted to ${resolvedTarget!.name} yet`,
            ...result,
          });
        }

        const baseline = {
          ...compactBuild(baselineBuild),
          via: resolvedTarget!.kind,
          target: resolvedTarget!.name,
          ...(pipeline && { pipeline }),
        };
        const empty = { commits: [], issues: [], linkChanges: [], truncated: false, totalCommits: 0 };
        if (baselineBuild.id === candidate.id) {
          return jsonResult({ baseline, ...result, ...empty });
        }

        const data = await gqlClient.request<ChangeLogData>(CHANGE_LOG, {
          from: Number(baselineBuild.id),
          to: Number(candidate.id),
        });
        const changeLog = data.scmChangeLog;
        if (!changeLog) {
          return jsonResult({ baseline, ...result, ...empty, reason: "No SCM change log is available for this project" });
        }

        const commits = changeLog.commits.map(({ commit }) => ({
          shortId: commit.shortId,
          message: commit.message.split("\n")[0],
          author: commit.author,
          timestamp: commit.timestamp,
          link: commit.link,
          assistants: commit.assistants,
        }));
        return jsonResult({
          baseline,
          ...result,
          commits: commits.slice(0, args.maxCommits),
          issues: (changeLog.issues?.issues ?? []).map((issue) => ({
            displayKey: issue.displayKey,
            summary: issue.summary,
            status: issue.status?.name ?? null,
            url: issue.url,
          })),
          linkChanges: changeLog.linkChanges.map((change) => ({
            project: change.project.name,
            qualifier: change.qualifier,
            from: change.from?.displayName ?? null,
            to: change.to?.displayName ?? null,
          })),
          truncated: commits.length > args.maxCommits,
          totalCommits: commits.length,
        });
      });
    }
  );

  server.tool(
    "deployments",
    "What is deployed where for a project? For each environment (in order) and each slot of the project: the last deployed build, and the pipeline in progress when there is one.",
    {
      project: z.string().describe("Project name"),
      environment: z.string().optional().describe("Only this environment"),
    },
    async ({ project, environment }) => {
      const data = await gqlClient.request<DeploymentsData>(DEPLOYMENTS, { project });
      const environments = data.environments
        .filter((env) => env.slots.length > 0)
        .filter((env) => environment === undefined || env.name === environment)
        .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
      if (environment !== undefined && environments.length === 0) {
        return errorResult(`No slot for project '${project}' in environment '${environment}'`);
      }
      return jsonResult({
        project,
        environments: environments.map((env) => ({
          name: env.name,
          order: env.order,
          slots: env.slots.map((slot) => {
            const deployed = slot.lastDeployedPipeline;
            const current = slot.currentPipeline;
            return {
              qualifier: slot.qualifier,
              link: slotLink(slot.id),
              deployed: deployed
                ? {
                    ...compactBuild(deployed.build),
                    pipeline: { number: deployed.number, finishedAt: deployed.end, link: pipelineLink(deployed.id) },
                  }
                : null,
              ...(current && current.id !== deployed?.id && {
                inProgress: {
                  ...compactBuild(current.build),
                  status: current.status,
                  pipeline: { number: current.number, link: pipelineLink(current.id) },
                },
              }),
            };
          }),
        })),
      });
    }
  );

  server.tool(
    "dependency_builds_at_level",
    "Which builds of a (dependency) project are at a given promotion level? Newest first, on one branch or across the whole project.",
    {
      project: z.string().describe("Project name"),
      promotionLevel: z.string().describe("Promotion level name"),
      branch: z.string().optional().describe("Only builds of this branch (whole project when omitted)"),
      count: z.number().int().positive().optional().default(10).describe("Maximum number of builds to return"),
    },
    async ({ project, promotionLevel, branch, count }) => {
      const data = branch !== undefined
        ? await gqlClient.request<{ builds: BuildAtLevel[] | null }>(BRANCH_BUILDS_AT_LEVEL, { project, branch, promotionLevel, count })
        : await gqlClient.request<{ builds: BuildAtLevel[] | null }>(PROJECT_BUILDS_AT_LEVEL, { project, promotionLevel, count });
      const builds = [...(data.builds ?? [])]
        // the project search matches builds having "at least" the promotion: keep those promoted to the level itself
        .filter((build) => build.promotionRuns.length > 0)
        .sort((a, b) => Number(b.id) - Number(a.id))
        .map((build) => ({
          ...compactBuild(build),
          branch: build.branch.name,
          creationTime: build.creation?.time ?? null,
          // the latest promotion to the level, which may differ from the build creation order
          promotedAt: build.promotionRuns
            .map((run) => run.creation?.time)
            .filter((time): time is string => !!time)
            .sort()
            .at(-1) ?? null,
        }));
      return jsonResult({ project, promotionLevel, builds });
    }
  );
}
