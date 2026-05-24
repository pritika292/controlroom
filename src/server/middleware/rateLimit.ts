import rateLimit from "express-rate-limit";

// Public read-only endpoints (status, pings, commits, deploys, issues,
// stats, infra, incidents) are Redis-cached (30s TTL) and hit by every
// browser opening the dashboard. The cache shields the DB from bursts but
// we still want a per-IP backstop so a hostile client can't pin the cache
// in a hot loop.
//
// 240 req/min/IP = 4 req/sec sustained — well above what an honest tab
// burst needs even when SSE reconnects rapidly.
export const publicReadLimiter = rateLimit({
  windowMs: 60_000,
  limit: 240,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  // Skip during tests: integration suites fire dozens of requests in tight
  // loops and would otherwise trip the limiter.
  skip: () => process.env["NODE_ENV"] === "test",
});

// Webhook-specific limiter: HMAC verification is cheap but we still want
// a hard ceiling. GitHub itself never bursts; this protects against a
// leaked URL or a client misconfigured to retry-storm.
export const webhookLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => process.env["NODE_ENV"] === "test",
});
