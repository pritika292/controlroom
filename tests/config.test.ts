import { describe, it, expect } from "vitest";
import { parseConfig, redact } from "../src/server/config.js";

// Valid dev environment — GITHUB_PAT and GITHUB_WEBHOOK_SECRET are optional everywhere
const VALID_DEV_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: "development",
  PORT: "3012",
  DATABASE_URL: "postgres://user:pass@localhost:5432/controlroom",
  REDIS_URL: "redis://localhost:6379/0",
  LOG_LEVEL: "info",
};

// Minimal valid production environment — GitHub secrets absent (Tier 0-3 baseline)
const VALID_PROD_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  PORT: "3012",
  DATABASE_URL: "postgres://user:strongpass@prod-db:5432/controlroom",
  REDIS_URL: "redis://pritika-redis:6379/12",
  LOG_LEVEL: "info",
};

// Valid production environment with GitHub secrets present
const VALID_PROD_ENV_WITH_GITHUB: NodeJS.ProcessEnv = {
  ...VALID_PROD_ENV,
  GITHUB_PAT: "github_pat_" + "A".repeat(40),
  GITHUB_WEBHOOK_SECRET: "a".repeat(32),
};

describe("schema parsing", () => {
  it("parses a valid dev env", () => {
    const cfg = parseConfig(VALID_DEV_ENV);
    expect(cfg.NODE_ENV).toBe("development");
    expect(cfg.PORT).toBe(3012);
    expect(cfg.LOG_LEVEL).toBe("info");
    expect(Object.isFrozen(cfg)).toBe(true);
  });

  it("accepts missing GITHUB_PAT (defaults to empty string)", () => {
    const env = { ...VALID_DEV_ENV, GITHUB_PAT: undefined };
    const cfg = parseConfig(env);
    expect(cfg.GITHUB_PAT).toBe("");
  });

  it("rejects invalid REDIS_URL (no protocol)", () => {
    const env = { ...VALID_DEV_ENV, REDIS_URL: "foo" };
    expect(() => parseConfig(env)).toThrow(/REDIS_URL/);
  });
});

describe("prod guards", () => {
  describe("Tier 0-3: empty GitHub secrets are tolerated in production", () => {
    it("boots in production with no GITHUB_PAT and no GITHUB_WEBHOOK_SECRET", () => {
      expect(() => parseConfig(VALID_PROD_ENV)).not.toThrow();
    });

    it("boots in production with explicit empty GITHUB_PAT and GITHUB_WEBHOOK_SECRET", () => {
      const env = { ...VALID_PROD_ENV, GITHUB_PAT: "", GITHUB_WEBHOOK_SECRET: "" };
      expect(() => parseConfig(env)).not.toThrow();
    });
  });

  describe("non-empty GitHub secrets are validated when present", () => {
    it("rejects a non-empty GITHUB_PAT that does not match the github_pat_... format", () => {
      const env = { ...VALID_PROD_ENV, GITHUB_PAT: "ghp_invalid_old_format_token" };
      expect(() => parseConfig(env)).toThrow(/GITHUB_PAT/);
    });

    it("rejects a non-empty GITHUB_PAT that is a placeholder value", () => {
      const env = { ...VALID_PROD_ENV, GITHUB_PAT: "replace-me" };
      expect(() => parseConfig(env)).toThrow(/GITHUB_PAT/);
    });

    it("rejects a non-empty GITHUB_WEBHOOK_SECRET shorter than 32 chars", () => {
      const env = { ...VALID_PROD_ENV, GITHUB_WEBHOOK_SECRET: "short" };
      expect(() => parseConfig(env)).toThrow(/GITHUB_WEBHOOK_SECRET/);
    });

    it("rejects a non-empty GITHUB_WEBHOOK_SECRET that is a placeholder value", () => {
      const env = { ...VALID_PROD_ENV, GITHUB_WEBHOOK_SECRET: "replace-me" };
      expect(() => parseConfig(env)).toThrow(/GITHUB_WEBHOOK_SECRET/);
    });

    it("accepts a valid prod env with real GitHub secrets", () => {
      const cfg = parseConfig(VALID_PROD_ENV_WITH_GITHUB);
      expect(cfg.NODE_ENV).toBe("production");
      expect(cfg.GITHUB_PAT).toMatch(/^github_pat_/);
      expect(Object.isFrozen(cfg)).toBe(true);
    });
  });

  it("rejects REDIS_URL not ending in /12 in production", () => {
    const env = { ...VALID_PROD_ENV, REDIS_URL: "redis://host:6379/1" };
    expect(() => parseConfig(env)).toThrow(/REDIS_URL/);
  });

  it("rejects localhost DATABASE_URL in production", () => {
    const env = { ...VALID_PROD_ENV, DATABASE_URL: "postgres://localhost:5432/foo" };
    expect(() => parseConfig(env)).toThrow(/DATABASE_URL/);
  });

  it("accepts a minimal prod env without GitHub secrets", () => {
    const cfg = parseConfig(VALID_PROD_ENV);
    expect(cfg.NODE_ENV).toBe("production");
    expect(cfg.REDIS_URL).toBe("redis://pritika-redis:6379/12");
    expect(cfg.GITHUB_PAT).toBe("");
    expect(cfg.GITHUB_WEBHOOK_SECRET).toBe("");
    expect(Object.isFrozen(cfg)).toBe(true);
  });
});

describe("redact()", () => {
  it("redacts top-level secret keys", () => {
    const result = redact({ GITHUB_PAT: "abc", port: 3012 });
    expect(result).toEqual({ GITHUB_PAT: "***", port: 3012 });
  });

  it("redacts nested secret keys", () => {
    const result = redact({ creds: { API_KEY: "x" } });
    expect(result).toEqual({ creds: { API_KEY: "***" } });
  });

  it("redacts inside arrays", () => {
    const result = redact({ tokens: [{ TOKEN: "x" }] });
    expect(result).toEqual({ tokens: [{ TOKEN: "***" }] });
  });

  it("leaves non-secret keys untouched", () => {
    const result = redact({ name: "foo" });
    expect(result).toEqual({ name: "foo" });
  });
});
