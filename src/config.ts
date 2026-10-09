import { z } from "zod";

const ConfigSchema = z.object({
  YONTRACK_URL: z.string().url(),
  YONTRACK_TOKEN: z.string().min(1),
  YONTRACK_MUTATIONS_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  YONTRACK_AGENT_TOOLS: z.enum(["auto", "true", "false"]).optional().default("auto"),
  YONTRACK_UI_URL: z
    .preprocess((v) => (v === "" ? undefined : v), z.string().url().optional())
    .transform((v) => v?.replace(/\/+$/, "")),
  YONTRACK_AGENT_SESSION: z.string().optional(),
  YONTRACK_AGENT_SESSION_LINK: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

let _config: Config;

try {
  _config = ConfigSchema.parse(process.env);
} catch (err) {
  const details =
    err instanceof z.ZodError
      ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
      : String(err);
  process.stderr.write(
    `Invalid or missing environment variables (YONTRACK_URL and YONTRACK_TOKEN are required): ${details}\n`
  );
  process.exit(1);
}

export const config = _config;
export const mutationsEnabled = _config.YONTRACK_MUTATIONS_ENABLED;

// OAuth2 is enabled when both SERVER_URL and AUTH_PASSWORD are provided
const serverUrl = process.env.YONTRACK_MCP_SERVER_URL;
const authPassword = process.env.YONTRACK_MCP_AUTH_PASSWORD;
export const oauthConfig =
  serverUrl && authPassword ? { serverUrl, authPassword } : null;
