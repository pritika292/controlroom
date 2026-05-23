import type { RequestHandler } from "express";

// Return 405 on any non-GET request whose path is not /webhooks/github.
// HEAD and OPTIONS are skipped to remain RFC-compliant.
// Mount AFTER helmet but BEFORE any routes.
export const getOnly: RequestHandler = (req, res, next) => {
  const method = req.method.toUpperCase();
  if (method === "HEAD" || method === "OPTIONS" || method === "GET") {
    next();
    return;
  }
  if (req.path === "/webhooks/github") {
    next();
    return;
  }
  res.status(405).json({ error: "Method Not Allowed" });
};
