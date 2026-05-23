// Set required env vars before any module under test is loaded.
// This prevents the config singleton from calling process.exit(1)
// when Vitest imports src/server/config.ts in the server test pool.
// Only set defaults when the env var is not already provided (e.g. by CI).
process.env["NODE_ENV"] ??= "test";
process.env["DATABASE_URL"] ??= "postgres://controlroom:devpass@localhost:5432/controlroom";
process.env["REDIS_URL"] ??= "redis://localhost:6379/0";
process.env["GITHUB_PAT"] ??= "github_pat_" + "A".repeat(40);
process.env["GITHUB_WEBHOOK_SECRET"] ??= "a".repeat(32);
process.env["LOG_LEVEL"] ??= "info";
