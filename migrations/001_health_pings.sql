CREATE TABLE health_pings (
  project    text        NOT NULL,
  ts         timestamptz NOT NULL DEFAULT now(),
  status     text        NOT NULL CHECK (status IN ('up', 'down', 'timeout', 'error')),
  latency_ms integer,
  PRIMARY KEY (project, ts)
);
CREATE INDEX health_pings_project_ts_idx ON health_pings (project, ts DESC);
