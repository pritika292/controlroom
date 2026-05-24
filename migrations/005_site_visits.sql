-- Visit-counts pipeline for the family of portfolio sites (#87).
-- Each project sends a fire-and-forget beacon on landing-page mount;
-- controlroom owns the table, the rollup, and the read surfaces.

CREATE TABLE site_visits (
  id        bigserial    PRIMARY KEY,
  project   text         NOT NULL,
  ts        timestamptz  NOT NULL DEFAULT NOW(),
  -- sha256(ip + per-day-rotating-salt). Daily rotation = same visitor
  -- shows up as a "new" visitor each day, which matches the intuition
  -- behind "X visits this week" without storing a stable identifier.
  ip_hash   text,
  -- coarse classification: 'desktop' / 'mobile' / 'bot'. Bots are filtered
  -- out of every public aggregation but kept in the table for debugging.
  ua_kind   text
);

CREATE INDEX site_visits_project_ts_idx ON site_visits (project, ts DESC);
CREATE INDEX site_visits_ts_idx         ON site_visits (ts DESC);
