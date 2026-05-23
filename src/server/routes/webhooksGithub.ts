import { Router, type Request, type Response } from "express";
import express from "express";
import crypto from "node:crypto";
import { config } from "../config.js";
import { getPool } from "../db/pool.js";
import { getProject } from "../projects.js";

export const webhooksGithubRouter = Router();

// GitHub workflow_run event subset we care about.
interface WorkflowRunPayload {
  action: "requested" | "in_progress" | "completed";
  workflow_run: {
    id: number;
    name: string;
    head_sha: string;
    status: string;
    conclusion: string | null;
    html_url: string;
    run_started_at: string;
    updated_at: string;
    actor: { login: string } | null;
  };
  repository: { full_name: string };
}

function verifySignature(secret: string, body: Buffer, header: string | undefined): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const provided = header.slice("sha256=".length);
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  // timingSafeEqual throws if lengths differ; guard before calling.
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
}

function mapStatus(
  raw: WorkflowRunPayload["workflow_run"],
): "queued" | "in_progress" | "success" | "failure" | "cancelled" {
  if (raw.status === "queued") return "queued";
  if (raw.status === "in_progress") return "in_progress";
  if (raw.conclusion === "success") return "success";
  if (raw.conclusion === "cancelled") return "cancelled";
  return "failure";
}

webhooksGithubRouter.post(
  "/webhooks/github",
  express.raw({ type: "application/json", limit: "1mb" }),
  async (req: Request, res: Response) => {
    if (config.GITHUB_WEBHOOK_SECRET === "") {
      res.status(503).json({ error: "webhook secret not configured" });
      return;
    }

    const rawBody = req.body as Buffer;
    const sig = req.header("X-Hub-Signature-256");
    if (!verifySignature(config.GITHUB_WEBHOOK_SECRET, rawBody, sig)) {
      res.status(401).json({ error: "bad signature" });
      return;
    }

    const event = req.header("X-GitHub-Event");
    if (event !== "workflow_run") {
      // ping, push, anything else — acknowledge but do nothing
      res.status(200).json({ ok: true, ignored: event ?? "unknown" });
      return;
    }

    let payload: WorkflowRunPayload;
    try {
      payload = JSON.parse(rawBody.toString("utf8")) as WorkflowRunPayload;
    } catch {
      res.status(400).json({ error: "invalid json" });
      return;
    }

    // Only deploy-named workflows feed the deploy timeline. Other workflows
    // (ci, codeql) generate noise we don't want in the public board.
    if (payload.workflow_run.name !== "deploy") {
      res.status(200).json({ ok: true, ignored: "non-deploy workflow" });
      return;
    }

    // Map repo full_name (e.g. pritika292/shortlive) to our slug.
    const repoSlug = payload.repository.full_name.split("/")[1] ?? "";
    const project = getProject(repoSlug);
    if (!project) {
      res.status(200).json({ ok: true, ignored: "unknown project" });
      return;
    }

    const run = payload.workflow_run;
    const status = mapStatus(run);
    const finishedAt = run.status === "completed" ? new Date(run.updated_at).toISOString() : null;

    const pool = getPool();
    await pool.query(
      `INSERT INTO deploys (project, sha, actor, started_at, finished_at, status, run_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (project, sha) DO UPDATE SET
         actor = EXCLUDED.actor,
         started_at = EXCLUDED.started_at,
         finished_at = EXCLUDED.finished_at,
         status = EXCLUDED.status,
         run_url = EXCLUDED.run_url`,
      [
        project.slug,
        run.head_sha,
        run.actor?.login ?? null,
        new Date(run.run_started_at).toISOString(),
        finishedAt,
        status,
        run.html_url,
      ],
    );

    res.status(200).json({ ok: true });
  },
);
