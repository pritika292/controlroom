import express, { type Express } from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { securityHeaders } from "./middleware/securityHeaders.js";
import { getOnly } from "./middleware/getOnly.js";
import { publicReadLimiter, visitIngestLimiter, webhookLimiter } from "./middleware/rateLimit.js";
import { sseRouter } from "./routes/sseStream.js";
import { publicStatusRouter } from "./routes/publicStatus.js";
import { projectPingsRouter } from "./routes/projectPings.js";
import { projectCommitsRouter } from "./routes/projectCommits.js";
import { projectDeploysRouter } from "./routes/projectDeploys.js";
import { publicStatsRouter } from "./routes/publicStats.js";
import { publicInfraRouter } from "./routes/publicInfra.js";
import { publicInfraExtrasRouter } from "./routes/publicInfraExtras.js";
import { publicIncidentsRouter } from "./routes/publicIncidents.js";
import { publicDeployFrequencyRouter } from "./routes/publicDeployFrequency.js";
import { publicIssuesRouter } from "./routes/publicIssues.js";
import { publicVisitsRouter } from "./routes/publicVisits.js";
import { visitIngestRouter } from "./routes/visitIngest.js";
import { webhooksGithubRouter } from "./routes/webhooksGithub.js";

const CLIENT_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../client");

// Paths that should serve the SPA's index.html.
const SPA_PATHS = ["/", "/about"];

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  // Caddy proxies us; trust one hop so express-rate-limit (and any future
  // IP-derived logic) sees the real client IP from X-Forwarded-For instead
  // of the loopback address.
  app.set("trust proxy", 1);

  app.use(securityHeaders);
  app.use(getOnly);

  // GitHub webhook reads a raw body for HMAC verification, so mount it
  // before express.json() consumes the stream. Rate-limited separately
  // from the public read endpoints.
  app.use("/webhooks", webhookLimiter);
  app.use(webhooksGithubRouter);

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // Visit beacon (#87). Mounted before /api/public so its own (looser)
  // limiter applies instead of publicReadLimiter. The POST is on the
  // getOnly allow-list (POST_ALLOWLIST_REGEX).
  app.use("/api/visit", visitIngestLimiter);
  app.use(visitIngestRouter);

  // SSE hub — must come before the SPA fallback so /api/stream isn't swallowed.
  // Not rate-limited (long-lived connection, not request-shaped).
  app.use(sseRouter);

  // Per-IP rate limit on every public read endpoint. Redis caches them at
  // 30s so this is a backstop against hot-loop scrapers, not a primary
  // throttle.
  app.use("/api/public", publicReadLimiter);

  // Public status + per-project ping/commit/deploy routes.
  app.use(publicStatusRouter);
  app.use(projectPingsRouter);
  app.use(projectCommitsRouter);
  app.use(projectDeploysRouter);
  app.use(publicStatsRouter);
  app.use(publicInfraRouter);
  app.use(publicInfraExtrasRouter);
  app.use(publicIncidentsRouter);
  app.use(publicDeployFrequencyRouter);
  app.use(publicIssuesRouter);
  app.use(publicVisitsRouter);

  // Serve the built SPA when it exists (production / post-build).
  const indexHtml = path.join(CLIENT_DIST, "index.html");
  const hasClient = existsSync(indexHtml);
  if (hasClient) {
    app.use(
      "/assets",
      express.static(path.join(CLIENT_DIST, "assets"), { immutable: true, maxAge: "1y" }),
    );
    for (const p of SPA_PATHS) {
      app.get(p, (_req, res) => {
        res.sendFile(indexHtml);
      });
    }
    // /p/<slug> is the per-project detail page; route slug is alphanum
    // plus dashes, 1-32 chars. Anything else falls through to a 404.
    app.get(/^\/p\/[0-9A-Za-z-]{1,32}\/?$/, (_req, res) => {
      res.sendFile(indexHtml);
    });
  }

  return app;
}
