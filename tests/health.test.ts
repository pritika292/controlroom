import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/server/app.js";

describe("GET /health", () => {
  it("returns 200 and { ok: true }", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
