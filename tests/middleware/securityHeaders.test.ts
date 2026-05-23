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

  it("sets HSTS with the conservative 1-hour max-age", async () => {
    // Short max-age is intentional: if Caddy or the cert pipeline breaks,
    // browsers fall back to HTTP within an hour instead of being locked
    // out for a year. Bump to 31536000 after ~24h of cert-pipeline
    // stability is observed.
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["strict-transport-security"]).toMatch(/max-age=3600/);
    expect(res.headers["strict-transport-security"]).toContain("includeSubDomains");
  });

  it("sets a Content-Security-Policy header that upgrades insecure requests", async () => {
    // upgrade-insecure-requests is helmet's default. Now that Caddy
    // terminates TLS for everything at *.pritika.studio, asset requests
    // should always be HTTPS -- this directive helps browsers do that
    // automatically and is no longer a white-screen hazard.
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.headers["content-security-policy"]).toBeDefined();
    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(res.headers["content-security-policy"]).toContain("upgrade-insecure-requests");
  });
});
