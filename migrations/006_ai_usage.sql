-- AI-call usage stream. Every AI-using project in the family posts one
-- row per chat completion to /api/ai-usage/:slug. Controlroom aggregates
-- counts + tokens + estimated cost for the public dashboard tiles.

CREATE TABLE ai_usage (
  id                bigserial    PRIMARY KEY,
  project           text         NOT NULL,
  ts                timestamptz  NOT NULL DEFAULT NOW(),
  model             text         NOT NULL,
  prompt_tokens     integer      NOT NULL,
  completion_tokens integer      NOT NULL,
  est_cost_cents    numeric(10, 4)
);

CREATE INDEX ai_usage_ts_idx         ON ai_usage (ts DESC);
CREATE INDEX ai_usage_project_ts_idx ON ai_usage (project, ts DESC);
