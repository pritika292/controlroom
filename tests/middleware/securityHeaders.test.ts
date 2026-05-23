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

  it("never sets HSTS (controlroom is HTTP-only until TLS lands)", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.headers["strict-transport-security"]).toBeUndefined();
  });

  it("sets a Content-Security-Policy header", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.headers["content-security-policy"]).toBeDefined();
    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
  });

  it("does not include upgrade-insecure-requests in CSP", async () => {
    // helmet adds this directive by default; on an HTTP-only site it forces
    // the browser to upgrade asset requests to HTTPS and the page goes white.
    // Regression test for the white-screen bug.
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.headers["content-security-policy"]).not.toContain("upgrade-insecure-requests");
  });
});
