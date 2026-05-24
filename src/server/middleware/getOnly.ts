import type { RequestHandler } from "express";

// Return 405 on any non-GET request whose path isn't in the explicit
// POST allow-list. HEAD and OPTIONS are skipped to remain RFC-compliant.
// Mount AFTER helmet but BEFORE any routes.
//
// Currently allowed POST paths:
// - /webhooks/github     (deploy + workflow_run notifications)
// - /api/visit/<slug>    (#87 visit beacon from each portfolio site)
// - /api/ai-usage/<slug> (per-chat-completion usage from AI-using projects)
const POST_ALLOWLIST_REGEX = [
  /^\/webhooks\/github$/,
  /^\/api\/visit\/[A-Za-z0-9_-]{1,40}$/,
  /^\/api\/ai-usage\/[A-Za-z0-9_-]{1,40}$/,
];

export const getOnly: RequestHandler = (req, res, next) => {
  const method = req.method.toUpperCase();
  if (method === "HEAD" || method === "OPTIONS" || method === "GET") {
    next();
    return;
  }
  if (POST_ALLOWLIST_REGEX.some((re) => re.test(req.path))) {
    next();
    return;
  }
  res.status(405).json({ error: "Method Not Allowed" });
};
