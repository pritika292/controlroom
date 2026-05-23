import { afterEach, describe, expect, it } from "vitest";
import { closeRedis, getRedis } from "../../src/server/services/redis.js";

describe("redis singleton", () => {
  afterEach(async () => {
    // Reset the module singleton so each test starts clean.
    await closeRedis();
  });

  it("returns the same instance on repeated calls", () => {
    const a = getRedis();
    const b = getRedis();
    expect(a).toBe(b);
  });

  it("creates a new client after closeRedis()", async () => {
    const first = getRedis();
    await closeRedis();
    const second = getRedis();
    expect(second).not.toBe(first);
  });
});
