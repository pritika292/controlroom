import { describe, it, expect } from "vitest";
import { parseConfig, redact } from "../src/server/config.js";

// Valid dev environment (NODE_ENV=test bypasses prod guards)
const VALID_DEV_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: "development",
  PORT: "3012",
  DATABASE_URL: "postgres://user:pass@localhost:5432/controlroom",
  REDIS_URL: "redis://localhost:6379/0",
  GITHUB_PAT: "replace-me",
  GITHUB_WEBHOOK_SECRET: "replace-me",
  LOG_LEVEL: "info",
};

// Valid production environment satisfying all prod guards
const VALID_PROD_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  PORT: "3012",
  DATABASE_URL: "postgres://user:strongpass@prod-db:5432/controlroom",
  REDIS_URL: "redis://pritika-redis:6379/12",
  GITHUB_PAT: "github_pat_" + "A".repeat(40),
  GITHUB_WEBHOOK_SECRET: "a".repeat(32),
  LOG_LEVEL: "info",
};

describe("schema parsing", () => {
  it("parses a valid dev env", () => {
    const cfg = parseConfig(VALID_DEV_ENV);
    expect(cfg.NODE_ENV).toBe("development");
    expect(cfg.PORT).toBe(3012);
    expect(cfg.LOG_LEVEL).toBe("info");
    expect(Object.isFrozen(cfg)).toBe(true);
  });

  it("rejects missing GITHUB_PAT", () => {
    const env = { ...VALID_DEV_ENV, GITHUB_PAT: undefined };
    expect(() => parseConfig(env)).toThrow(/GITHUB_PAT/);
  });

  it("rejects invalid REDIS_URL (no protocol)", () => {
    const env = { ...VALID_DEV_ENV, REDIS_URL: "foo" };
    expect(() => parseConfig(env)).toThrow(/REDIS_URL/);
  });
});

describe("prod guards", () => {
  it("rejects placeholder PAT in production", () => {
    const env = { ...VALID_PROD_ENV, GITHUB_PAT: "replace-me" };
    expect(() => parseConfig(env)).toThrow(/GITHUB_PAT/);
  });

  it("rejects short webhook secret in production", () => {
    const env = { ...VALID_PROD_ENV, GITHUB_WEBHOOK_SECRET: "short" };
    expect(() => parseConfig(env)).toThrow(/GITHUB_WEBHOOK_SECRET/);
  });

  it("rejects REDIS_URL not ending in /12 in production", () => {
    const env = { ...VALID_PROD_ENV, REDIS_URL: "redis://host:6379/1" };
    expect(() => parseConfig(env)).toThrow(/REDIS_URL/);
  });

  it("rejects localhost DATABASE_URL in production", () => {
    const env = { ...VALID_PROD_ENV, DATABASE_URL: "postgres://localhost:5432/foo" };
    expect(() => parseConfig(env)).toThrow(/DATABASE_URL/);
  });

  it("accepts a valid prod env", () => {
    const cfg = parseConfig(VALID_PROD_ENV);
    expect(cfg.NODE_ENV).toBe("production");
    expect(cfg.REDIS_URL).toBe("redis://pritika-redis:6379/12");
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
