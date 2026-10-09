import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSchema, parse, validate, type GraphQLSchema } from "graphql";

// Validates every GraphQL document sent by the server against the schema snapshots,
// so that a field the Yontrack server does not expose fails here rather than at runtime.

const root = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));

const schemas: Record<string, GraphQLSchema> = {
  v5: buildSchema(readFileSync(root("yontrack-v5.graphql"), "utf-8")),
  v6: buildSchema(readFileSync(root("yontrack-v6.graphql"), "utf-8")),
};

// Yontrack 6 only: never sent to a v5 server (see docs/adr/0001 and 0002)
const V6_ONLY = new Set([
  "src/tools/agent-context.ts",
  "src/tools/agent-context-support.ts",
  "src/tools/search-results.ts",
]);

// Known invalid documents, as "version file NAME": these must be fixed, then removed from here
const KNOWN_INVALID = new Set<string>([]);

const sourceFiles = [
  "src/capabilities.ts",
  "src/utils.ts",
  ...readdirSync(root("src/tools"))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => `src/tools/${f}`),
];

/** `const NAME = \`...\`` constants holding a query or mutation, with `${OTHER}` constants inlined. */
function documentsOf(file: string): Array<{ name: string; text: string }> {
  const source = readFileSync(root(file), "utf-8");
  const constants = new Map<string, string>();
  for (const [, name, text] of source.matchAll(/const (\w+) = `([^`]*)`;/g)) constants.set(name, text);
  const inline = (text: string): string =>
    text.replace(/\$\{(\w+)\}/g, (match, name) => (constants.has(name) ? inline(constants.get(name)!) : match));
  return [...constants]
    .map(([name, text]) => ({ name, text: inline(text) }))
    .filter(({ text }) => /^\s*(query|mutation)\b/.test(text));
}

const cases = sourceFiles.flatMap((file) =>
  documentsOf(file).flatMap(({ name, text }) =>
    (V6_ONLY.has(file) ? ["v6"] : ["v5", "v6"]).map((version) => ({
      file, name, text, version, known: KNOWN_INVALID.has(`${version} ${file} ${name}`),
    }))
  )
);

describe("GraphQL documents", () => {
  it("finds the documents to validate", () => {
    const names = cases.map((c) => c.name);
    expect(names).toContain("CREATE_VALIDATION_RUN");
    expect(names).toContain("PROMOTE_BUILD");
    expect(names).toContain("READINESS");
    expect(names).toContain("SEARCH_RESULTS");
  });

  it.each(cases.filter((c) => !c.known))("$file $name is valid against the $version schema", ({ text, version }) => {
    const errors = validate(schemas[version], parse(text)).map((e) => e.message);
    expect(errors).toEqual([]);
  });

  it.each(cases.filter((c) => c.known))("$file $name is still a known issue against the $version schema", ({ text, version }) => {
    expect(validate(schemas[version], parse(text))).not.toEqual([]);
  });
});
