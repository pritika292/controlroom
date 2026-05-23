import express, { type Express } from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { securityHeaders } from "./middleware/securityHeaders.js";
import { getOnly } from "./middleware/getOnly.js";
import { sseRouter } from "./routes/sseStream.js";
import { publicStatusRouter } from "./routes/publicStatus.js";
import { projectPingsRouter } from "./routes/projectPings.js";

const CLIENT_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../client");

// Paths that should serve the SPA's index.html.
const SPA_PATHS = ["/", "/about"];

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");

  app.use(securityHeaders);
  app.use(getOnly);

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // SSE hub — must come before the SPA fallback so /api/stream isn't swallowed.
  app.use(sseRouter);

  // Public status + per-project ping routes.
  app.use(publicStatusRouter);
  app.use(projectPingsRouter);

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
  }

  return app;
}
