import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/server/app.js";

describe("getOnly middleware", () => {
  it("POST / returns 405", async () => {
    const app = createApp();
    const res = await request(app).post("/");
    expect(res.status).toBe(405);
  });

  it("POST /webhooks/github does not return 405", async () => {
    const app = createApp();
    const res = await request(app).post("/webhooks/github");
    // No handler is registered yet, so it will 404 or Express will return
    // something, but it must NOT be 405 (getOnly should pass it through).
    expect(res.status).not.toBe(405);
  });

  it("GET / returns 200 or a non-405 status", async () => {
    const app = createApp();
    const res = await request(app).get("/");
    expect(res.status).not.toBe(405);
  });

  it("DELETE /health returns 405", async () => {
    const app = createApp();
    const res = await request(app).delete("/health");
    expect(res.status).toBe(405);
  });

  it("HEAD /health is not blocked (RFC-compliant)", async () => {
    const app = createApp();
    const res = await request(app).head("/health");
    expect(res.status).not.toBe(405);
  });

  it("POST /api/visit/<slug> passes through the allow-list", async () => {
    const app = createApp();
    const res = await request(app).post("/api/visit/shortlive");
    // The visit ingest handler returns 204 for a live slug; the important
    // thing is that getOnly doesn't intercept with 405.
    expect(res.status).not.toBe(405);
  });

  it("POST /api/visit/<too-long-slug> is rejected by the regex", async () => {
    const app = createApp();
    const res = await request(app).post(`/api/visit/${"a".repeat(50)}`);
    expect(res.status).toBe(405);
  });
});
