import { getPool } from "../db/pool.js";

// Per-call usage stored by the AI-using projects (pg-inspector, focusroom).
// Cost is computed by the caller because pricing varies per model and per
// deployment region; controlroom just stores what it's given.
export interface RecordAiUsageInput {
  project: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  estCostCents: number;
}

export async function recordAiUsage(input: RecordAiUsageInput): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO ai_usage (project, model, prompt_tokens, completion_tokens, est_cost_cents)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.project, input.model, input.promptTokens, input.completionTokens, input.estCostCents],
  );
}

export interface AiUsageSummary {
  callsToday: number;
  tokensToday: number;
  costTodayCents: number;
  callsThisWeek: number;
  // Most-used model in the last 7 days; null if no usage recorded yet.
  modelInUse: string | null;
}

// Aggregations for the dashboard tiles. "Today" = UTC midnight onward;
// "this week" = the last 7 days.
export async function aiUsageSummary(): Promise<AiUsageSummary> {
  const pool = getPool();
  const [todayRow, weekRow, modelRow] = await Promise.all([
    pool.query<{ calls: string; tokens: string; cost: string | null }>(
      `SELECT
         count(*)::text                                                    AS calls,
         coalesce(sum(prompt_tokens + completion_tokens), 0)::text          AS tokens,
         coalesce(sum(est_cost_cents), 0)::text                             AS cost
       FROM ai_usage
       WHERE ts >= date_trunc('day', NOW())`,
    ),
    pool.query<{ calls: string }>(
      `SELECT count(*)::text AS calls
       FROM ai_usage
       WHERE ts >= NOW() - interval '7 days'`,
    ),
    pool.query<{ model: string }>(
      `SELECT model
       FROM ai_usage
       WHERE ts >= NOW() - interval '7 days'
       GROUP BY model
       ORDER BY count(*) DESC
       LIMIT 1`,
    ),
  ]);

  return {
    callsToday: Number(todayRow.rows[0]?.calls ?? 0),
    tokensToday: Number(todayRow.rows[0]?.tokens ?? 0),
    costTodayCents: Number(todayRow.rows[0]?.cost ?? 0),
    callsThisWeek: Number(weekRow.rows[0]?.calls ?? 0),
    modelInUse: modelRow.rows[0]?.model ?? null,
  };
}
