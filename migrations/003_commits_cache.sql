CREATE TABLE commits_cache (
  project text        NOT NULL,
  sha     text        NOT NULL,
  author  text,
  message text        NOT NULL,
  ts      timestamptz NOT NULL,
  PRIMARY KEY (project, sha)
);
CREATE INDEX commits_cache_project_ts_idx ON commits_cache (project, ts DESC);
