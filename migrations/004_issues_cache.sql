CREATE TABLE issues_cache (
  project    text        NOT NULL,
  number     integer     NOT NULL,
  title      text        NOT NULL,
  state      text        NOT NULL CHECK (state IN ('open', 'closed')),
  opened_at  timestamptz NOT NULL,
  closed_at  timestamptz,
  html_url   text        NOT NULL,
  PRIMARY KEY (project, number)
);
CREATE INDEX issues_cache_state_opened_idx ON issues_cache (state, opened_at DESC);
CREATE INDEX issues_cache_project_opened_idx ON issues_cache (project, opened_at DESC);
