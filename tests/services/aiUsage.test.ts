import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import { aiUsageSummary, recordAiUsage } from "../../src/server/services/aiUsage.js";

const DATABASE_URL = process.env["DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("aiUsage", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await client.query("TRUNCATE ai_usage");
  });

  afterAll(async () => {
    await client.end();
  });

  it("recordAiUsage writes a row with the supplied fields", async () => {
    await recordAiUsage({
      project: "pg-inspector",
      model: "gpt-4.1-mini",
      promptTokens: 1234,
      completionTokens: 56,
      estCostCents: 0.0123,
    });

    const { rows } = await client.query<{
      project: string;
      model: string;
      prompt_tokens: number;
      completion_tokens: number;
      est_cost_cents: string;
    }>("SELECT project, model, prompt_tokens, completion_tokens, est_cost_cents FROM ai_usage");

    expect(rows).toHaveLength(1);
    expect(rows[0]!.project).toBe("pg-inspector");
    expect(rows[0]!.model).toBe("gpt-4.1-mini");
    expect(rows[0]!.prompt_tokens).toBe(1234);
    expect(rows[0]!.completion_tokens).toBe(56);
    expect(Number(rows[0]!.est_cost_cents)).toBeCloseTo(0.0123);
  });

  it("aiUsageSummary returns zeros when nothing is recorded", async () => {
    const s = await aiUsageSummary();
    expect(s.callsToday).toBe(0);
    expect(s.tokensToday).toBe(0);
    expect(s.costTodayCents).toBe(0);
    expect(s.callsThisWeek).toBe(0);
    expect(s.modelInUse).toBeNull();
  });

  it("aiUsageSummary aggregates today + this-week counts and picks the dominant model", async () => {
    // Today: 3 gpt-4.1-mini calls (total 600 tokens, $0.04 cents) + 1 gpt-4o call.
    // 8 days ago: 2 calls (should not count in either bucket).
    await client.query(
      `INSERT INTO ai_usage (project, ts, model, prompt_tokens, completion_tokens, est_cost_cents) VALUES
       ('pg-inspector', now(),                 'gpt-4.1-mini', 100, 100, 0.02),
       ('pg-inspector', now() - interval '1h', 'gpt-4.1-mini', 100, 100, 0.02),
       ('focusroom',    now() - interval '3h', 'gpt-4.1-mini', 100,   0, 0.005),
       ('focusroom',    now() - interval '5h', 'gpt-4o',       200, 100, 0.10),
       ('focusroom',    now() - interval '8 days', 'gpt-4.1-mini', 50, 50, 0.005)`,
    );

    const s = await aiUsageSummary();
    expect(s.callsToday).toBe(4);
    // 200 + 200 + 100 + 300 = 800 tokens across the 4 rows today.
    expect(s.tokensToday).toBe(800);
    expect(s.costTodayCents).toBeCloseTo(0.145, 3);
    expect(s.callsThisWeek).toBe(4);
    // gpt-4.1-mini fires 3 times in the last week; gpt-4o fires 1.
    expect(s.modelInUse).toBe("gpt-4.1-mini");
  });
});
