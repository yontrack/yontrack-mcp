import { GraphQLClient } from "graphql-request";
import { config } from "./config.js";
import { agentSessionHeaders } from "./session.js";

/** Headers for every request to Yontrack, computed per request to carry the current agent session. */
export function yontrackHeaders(): Record<string, string> {
  return { "X-Ontrack-Token": config.YONTRACK_TOKEN, ...agentSessionHeaders() };
}

export const gqlClient = new GraphQLClient(`${config.YONTRACK_URL}/graphql`, {
  headers: yontrackHeaders,
});
