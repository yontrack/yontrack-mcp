import { z } from "zod";

const ConfigSchema = z.object({
  YONTRACK_URL: z.string().url(),
  YONTRACK_TOKEN: z.string().min(1),
});

export type Config = z.infer<typeof ConfigSchema>;

let _config: Config;

try {
  _config = ConfigSchema.parse(process.env);
} catch (err) {
  process.stderr.write(
    "Missing required environment variables: YONTRACK_URL and YONTRACK_TOKEN\n"
  );
  process.exit(1);
}

export const config = _config;
