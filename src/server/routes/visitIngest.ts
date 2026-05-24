import { Router } from "express";
import { getProject } from "../projects.js";
import { recordVisit } from "../services/visits.js";

export const visitIngestRouter = Router();

// Fire-and-forget visit beacon from each portfolio site's landing page (#87).
// The slug is whitelist-checked against the project registry so an attacker
// can't insert arbitrary project labels into the table.
//
// The handler always returns 204 — beacons are best-effort and a DB hiccup
// shouldn't surface as a noisy error on the client (the site uses
// `navigator.sendBeacon`, which ignores response bodies anyway, but a 5xx
// would still show up in browser devtools and skew anyone's mental model
// of "the portfolio is healthy").
visitIngestRouter.post("/api/visit/:slug", async (req, res) => {
  const { slug } = req.params;
  const project = getProject(slug);
  if (!project) {
    res.status(404).json({ error: "project not found" });
    return;
  }

  // `app.set('trust proxy', 1)` in app.ts means req.ip is the real client
  // IP from X-Forwarded-For (set by Caddy), not the loopback address.
  const ip = req.ip ?? "0.0.0.0";
  const userAgent = req.get("user-agent") ?? undefined;

  try {
    await recordVisit({ project: slug, ip, userAgent });
  } catch (err) {
    // Log and swallow — see header comment.
    console.error("[visit ingest] failed for", slug, err);
  }

  res.status(204).end();
});
