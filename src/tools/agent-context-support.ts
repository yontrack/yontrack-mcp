import { gqlClient } from "../client.js";
import { config } from "../config.js";

/** Link to a page of the Yontrack UI, or `undefined` when `YONTRACK_UI_URL` is not set. */
export function uiLink(path: string): string | undefined {
  return config.YONTRACK_UI_URL ? `${config.YONTRACK_UI_URL}/${path}` : undefined;
}

export const slotLink = (slotId: string) => uiLink(`extension/environments/slot/${slotId}`);
export const pipelineLink = (pipelineId: string) => uiLink(`extension/environments/pipeline/${pipelineId}`);

export interface BuildRef {
  id: string;
  name: string;
  displayName: string;
}

export function compactBuild(build: BuildRef) {
  return { name: build.name, displayName: build.displayName, link: uiLink(`build/${build.id}`) };
}

export interface PipelineRef {
  id: string;
  number: number | null;
  build: BuildRef;
}

export interface SlotRef {
  id: string;
  qualifier: string;
  environment: { name: string };
  lastDeployedPipeline: PipelineRef | null;
}

/** Display name of a slot: `environment` or `environment/qualifier`. */
export function slotName(slot: { qualifier: string; environment: { name: string } }) {
  return slot.qualifier ? `${slot.environment.name}/${slot.qualifier}` : slot.environment.name;
}

/** A target is exactly one of a promotion level (on the build's branch) or a slot (environment + qualifier). */
export type TargetInput =
  | { promotionLevel: string; environment?: undefined; qualifier?: undefined }
  | { promotionLevel?: undefined; environment: string; qualifier?: string };

export type ResolvedTarget =
  | { kind: "promotionLevel"; id: string; name: string; link: string | undefined }
  | { kind: "slot"; id: string; name: string; link: string | undefined; slot: SlotRef };

export class NotFoundError extends Error {}

const RESOLVE_BUILD = `
  query ResolveBuild(
    $project: String!, $branch: String!, $build: String!,
    $withLevels: Boolean!, $withSlot: Boolean!, $environment: String, $qualifier: String
  ) {
    builds(project: $project, branch: $branch, name: $build) {
      id
      name
      displayName
      branch @include(if: $withLevels) { promotionLevels { id name } }
      slots(environment: $environment, qualifier: $qualifier) @include(if: $withSlot) {
        id
        qualifier
        environment { name }
        lastDeployedPipeline { id number build { id name displayName } }
      }
    }
  }
`;

/**
 * Resolves a build by names and, when given, its target (promotion level or slot).
 * Throws a `NotFoundError` naming the missing entity.
 */
export async function resolveBuild(
  project: string,
  branch: string,
  build: string,
  target?: TargetInput
): Promise<{ build: BuildRef; target?: ResolvedTarget }> {
  const withLevels = target?.promotionLevel !== undefined;
  const withSlot = target?.environment !== undefined;
  const data = await gqlClient.request<{
    builds: Array<BuildRef & {
      branch?: { promotionLevels: Array<{ id: string; name: string }> };
      slots?: SlotRef[];
    }>;
  }>(RESOLVE_BUILD, {
    project, branch, build, withLevels, withSlot,
    environment: target?.environment ?? null,
    qualifier: withSlot ? (target?.qualifier ?? "") : null,
  });

  const found = data.builds?.[0];
  if (!found) {
    throw new NotFoundError(`Build '${build}' not found on branch '${branch}' of project '${project}'`);
  }
  const buildRef = { id: found.id, name: found.name, displayName: found.displayName };

  if (withLevels) {
    const level = found.branch?.promotionLevels.find((l) => l.name === target!.promotionLevel);
    if (!level) {
      throw new NotFoundError(`Promotion level '${target!.promotionLevel}' not found on branch '${branch}' of project '${project}'`);
    }
    return {
      build: buildRef,
      target: { kind: "promotionLevel", id: level.id, name: level.name, link: uiLink(`promotionLevel/${level.id}`) },
    };
  }

  if (withSlot) {
    const slot = found.slots?.[0];
    if (!slot) {
      const qualifier = target!.qualifier ? ` with qualifier '${target!.qualifier}'` : "";
      throw new NotFoundError(`No slot for project '${project}' in environment '${target!.environment}'${qualifier}`);
    }
    return {
      build: buildRef,
      target: { kind: "slot", id: slot.id, name: slotName(slot), link: slotLink(slot.id), slot },
    };
  }

  return { build: buildRef };
}

/** Reads the exactly-one-of target from tool arguments. */
export function targetOf(args: { promotionLevel?: string; environment?: string; qualifier?: string }): TargetInput | string {
  const hasLevel = args.promotionLevel !== undefined;
  const hasEnvironment = args.environment !== undefined;
  if (hasLevel === hasEnvironment) {
    return "Exactly one of 'promotionLevel' or 'environment' must be given";
  }
  if (!hasEnvironment && args.qualifier !== undefined) {
    return "'qualifier' can only be used together with 'environment'";
  }
  return hasLevel
    ? { promotionLevel: args.promotionLevel! }
    : { environment: args.environment!, qualifier: args.qualifier };
}

export function errorResult(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

export function jsonResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

/** Turns a `NotFoundError` into an error result; other errors propagate. */
export async function withNotFound<T>(fn: () => Promise<T>): Promise<T | ReturnType<typeof errorResult>> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof NotFoundError) return errorResult(err.message);
    throw err;
  }
}
