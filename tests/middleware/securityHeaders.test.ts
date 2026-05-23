import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/server/app.js";

describe("securityHeaders middleware", () => {
  it("sets X-Frame-Options: DENY on GET /health", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.headers["x-frame-options"]).toBe("DENY");
  });

  it("sets X-Content-Type-Options: nosniff on GET /health", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("does not set HSTS header in test/dev environment", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    // NODE_ENV=test (set in setup.server.ts) so HSTS must be absent.
    expect(res.headers["strict-transport-security"]).toBeUndefined();
  });

  it("sets a Content-Security-Policy header", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.headers["content-security-policy"]).toBeDefined();
    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
  });
});
