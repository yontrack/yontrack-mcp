import { gqlClient } from "./client.js";

const GET_BRANCH_ID = `
  query GetBranchId($project: String!, $name: String!) {
    branches(project: $project, name: $name) {
      id
    }
  }
`;

export async function resolveBranchId(project: string, branch: string): Promise<number> {
  const data = await gqlClient.request<{ branches: Array<{ id: number }> }>(
    GET_BRANCH_ID,
    { project, name: branch }
  );
  const found = data.branches?.[0];
  if (!found) {
    throw new Error(`Branch '${branch}' not found in project '${project}'`);
  }
  return found.id;
}
