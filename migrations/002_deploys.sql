CREATE TABLE deploys (
  project      text        NOT NULL,
  sha          text        NOT NULL,
  actor        text,
  started_at   timestamptz NOT NULL,
  finished_at  timestamptz,
  status       text        NOT NULL CHECK (status IN ('queued','in_progress','success','failure','cancelled')),
  run_url      text,
  PRIMARY KEY (project, sha)
);
CREATE INDEX deploys_project_started_idx ON deploys (project, started_at DESC);
