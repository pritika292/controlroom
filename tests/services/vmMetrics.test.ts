import { describe, expect, it } from "vitest";
import { vmMetrics } from "../../src/server/services/vmMetrics.js";

describe("vmMetrics", () => {
  it("returns available=false with a reason when Azure config is missing", async () => {
    // tests/setup.server.ts leaves AZURE_VM_RESOURCE_ID + AZURE_SUBSCRIPTION_ID
    // unset, so this path is exercised by default. Live readings require the
    // VM Managed Identity and are covered by post-deploy verification.
    const m = await vmMetrics();
    expect(m.available).toBe(false);
    expect(m.cpuPercent).toBeNull();
    expect(m.memUsedPercent).toBeNull();
    expect(m.reason).toMatch(/AZURE_VM_RESOURCE_ID|AZURE_SUBSCRIPTION_ID/);
  });
});
