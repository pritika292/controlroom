import { z } from "zod";

// Prod-only guards: crash on boot rather than ship with placeholder values
// or wrong Redis DB. Cross-project Redis-DB collisions in our shared
// pritika-redis are silent and miserable to debug.

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3012),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required").startsWith("postgres://", {
    message: "DATABASE_URL must start with postgres://",
  }),
  REDIS_URL: z.string().min(1, "REDIS_URL is required").startsWith("redis://", {
    message: "REDIS_URL must start with redis://",
  }),
  GITHUB_PAT: z.string().min(1, "GITHUB_PAT is required"),
  GITHUB_WEBHOOK_SECRET: z.string().min(1, "GITHUB_WEBHOOK_SECRET is required"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof ConfigSchema>;

const PLACEHOLDER_VALUES = ["replace-me", "changeme"];
const GITHUB_PAT_REGEX = /^(github_pat_[A-Za-z0-9_]{40,}|ghp_[A-Za-z0-9]{36})$/;

export function redact(value: unknown): unknown {
  const KEY_PATTERN = /(?:PAT|SECRET|TOKEN|KEY|PASSWORD)$/i;
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        KEY_PATTERN.test(k) ? "***" : redact(v),
      ]),
    );
  }
  return value;
}

export function parseConfig(env: NodeJS.ProcessEnv): Config {
  const result = ConfigSchema.safeParse(env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid config:\n${issues}`);
  }

  const data = result.data;

  if (data.NODE_ENV === "production") {
    const violations: string[] = [];

    if (
      !GITHUB_PAT_REGEX.test(data.GITHUB_PAT) ||
      PLACEHOLDER_VALUES.includes(data.GITHUB_PAT) ||
      data.GITHUB_PAT.length < 30
    ) {
      violations.push(
        "  - GITHUB_PAT: must match GitHub PAT format and not be a placeholder in production",
      );
    }

    if (
      data.GITHUB_WEBHOOK_SECRET.length < 32 ||
      PLACEHOLDER_VALUES.includes(data.GITHUB_WEBHOOK_SECRET)
    ) {
      violations.push(
        "  - GITHUB_WEBHOOK_SECRET: must be at least 32 chars and not a placeholder in production",
      );
    }

    if (!data.REDIS_URL.endsWith("/12")) {
      violations.push(
        "  - REDIS_URL: must end with /12 in production (controlroom uses Redis DB 12)",
      );
    }

    if (data.DATABASE_URL.includes("localhost") || data.DATABASE_URL.includes("devpass")) {
      violations.push(
        "  - DATABASE_URL: must not contain localhost or devpass in production",
      );
    }

    if (violations.length > 0) {
      throw new Error(`Invalid config:\n${violations.join("\n")}`);
    }
  }

  return Object.freeze(data);
}

function loadConfig(): Config {
  try {
    return parseConfig(process.env);
  } catch (err) {
    process.stderr.write((err as Error).message + "\n");
    process.exit(1);
  }
}

// Singleton: parsed and frozen at module load.
// Tests import parseConfig and redact directly; never this singleton.
export const config: Config = loadConfig();
