import { GraphQLClient } from "graphql-request";
import { config } from "./config.js";

export const gqlClient = new GraphQLClient(`${config.YONTRACK_URL}/graphql`, {
  headers: { "X-Ontrack-Token": config.YONTRACK_TOKEN },
});
