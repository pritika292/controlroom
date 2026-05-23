import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import crypto from "node:crypto";
import request from "supertest";
import { createApp } from "../../src/server/app.js";

const DATABASE_URL = process.env["DATABASE_URL"];
const WEBHOOK_SECRET = process.env["GITHUB_WEBHOOK_SECRET"] ?? "";
const describeIfDb = DATABASE_URL && WEBHOOK_SECRET.length >= 32 ? describe : describe.skip;

function sign(body: string): string {
  return "sha256=" + crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
}

function workflowRunPayload(overrides: Record<string, unknown> = {}): string {
  const base = {
    action: "completed",
    workflow_run: {
      id: 42,
      name: "deploy",
      head_sha: "deadbeef00000000000000000000000000000001",
      status: "completed",
      conclusion: "success",
      html_url: "https://github.com/pritika292/shortlive/actions/runs/42",
      run_started_at: "2026-05-23T08:00:00Z",
      updated_at: "2026-05-23T08:02:15Z",
      actor: { login: "pritika292" },
      ...((overrides.workflow_run as Record<string, unknown>) ?? {}),
    },
    repository: { full_name: "pritika292/shortlive" },
  };
  return JSON.stringify(base);
}

describeIfDb("POST /webhooks/github", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await client.query("TRUNCATE deploys");
  });

  afterAll(async () => {
    await client.end();
  });

  it("rejects requests with a missing signature", async () => {
    const app = createApp();
    const body = workflowRunPayload();
    const res = await request(app)
      .post("/webhooks/github")
      .set("Content-Type", "application/json")
      .set("X-GitHub-Event", "workflow_run")
      .send(body);
    expect(res.status).toBe(401);
  });

  it("rejects requests with a wrong signature", async () => {
    const app = createApp();
    const body = workflowRunPayload();
    const res = await request(app)
      .post("/webhooks/github")
      .set("Content-Type", "application/json")
      .set("X-GitHub-Event", "workflow_run")
      .set("X-Hub-Signature-256", "sha256=" + "0".repeat(64))
      .send(body);
    expect(res.status).toBe(401);
  });

  it("acks ping events without writing to deploys", async () => {
    const app = createApp();
    const body = JSON.stringify({ zen: "anti-fragility" });
    const res = await request(app)
      .post("/webhooks/github")
      .set("Content-Type", "application/json")
      .set("X-GitHub-Event", "ping")
      .set("X-Hub-Signature-256", sign(body))
      .send(body);
    expect(res.status).toBe(200);

    const { rows } = await client.query("SELECT count(*) AS n FROM deploys");
    expect(Number(rows[0]!.n)).toBe(0);
  });

  it("ignores non-deploy workflow_run events", async () => {
    const app = createApp();
    const body = workflowRunPayload({ workflow_run: { name: "ci" } });
    const res = await request(app)
      .post("/webhooks/github")
      .set("Content-Type", "application/json")
      .set("X-GitHub-Event", "workflow_run")
      .set("X-Hub-Signature-256", sign(body))
      .send(body);
    expect(res.status).toBe(200);

    const { rows } = await client.query("SELECT count(*) AS n FROM deploys");
    expect(Number(rows[0]!.n)).toBe(0);
  });

  it("ignores workflow_run events for unknown projects", async () => {
    const app = createApp();
    const body = JSON.stringify({
      ...JSON.parse(workflowRunPayload()),
      repository: { full_name: "pritika292/notarealproject" },
    });
    const res = await request(app)
      .post("/webhooks/github")
      .set("Content-Type", "application/json")
      .set("X-GitHub-Event", "workflow_run")
      .set("X-Hub-Signature-256", sign(body))
      .send(body);
    expect(res.status).toBe(200);

    const { rows } = await client.query("SELECT count(*) AS n FROM deploys");
    expect(Number(rows[0]!.n)).toBe(0);
  });

  it("upserts a successful deploy from a valid workflow_run event", async () => {
    const app = createApp();
    const body = workflowRunPayload();
    const res = await request(app)
      .post("/webhooks/github")
      .set("Content-Type", "application/json")
      .set("X-GitHub-Event", "workflow_run")
      .set("X-Hub-Signature-256", sign(body))
      .send(body);
    expect(res.status).toBe(200);

    const { rows } = await client.query("SELECT project, sha, actor, status, run_url FROM deploys");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.project).toBe("shortlive");
    expect(rows[0]!.actor).toBe("pritika292");
    expect(rows[0]!.status).toBe("success");
    expect(rows[0]!.run_url).toContain("/actions/runs/42");
  });

  it("upserts subsequent events for the same sha (in_progress -> success)", async () => {
    const app = createApp();

    const inProgressBody = workflowRunPayload({
      workflow_run: { status: "in_progress", conclusion: null },
    });
    const r1 = await request(app)
      .post("/webhooks/github")
      .set("Content-Type", "application/json")
      .set("X-GitHub-Event", "workflow_run")
      .set("X-Hub-Signature-256", sign(inProgressBody))
      .send(inProgressBody);
    expect(r1.status).toBe(200);

    const successBody = workflowRunPayload();
    const r2 = await request(app)
      .post("/webhooks/github")
      .set("Content-Type", "application/json")
      .set("X-GitHub-Event", "workflow_run")
      .set("X-Hub-Signature-256", sign(successBody))
      .send(successBody);
    expect(r2.status).toBe(200);

    const { rows } = await client.query("SELECT status FROM deploys");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("success");
  });
});
