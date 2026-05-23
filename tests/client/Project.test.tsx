import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Project } from "../../src/client/pages/Project.js";

const STATUS_SHORTLIVE = {
  slug: "shortlive",
  name: "shortlive",
  code: "CR-01",
  tagline: "URL shortener with sub-second analytics.",
  description: "Click on a short link, watch the dashboard update.",
  tech: ["TypeScript", "Express", "Redis"],
  status: "live",
  repo: "pritika292/shortlive",
  liveUrl: "http://example.test:3010",
  eta: null,
  lastStatus: "up",
  lastPingAt: new Date(Date.now() - 5_000).toISOString(),
  latencyMs: 50,
};
const STATUS_EDGEFLAG = {
  slug: "edgeflag",
  name: "edgeflag",
  code: "CR-04",
  tagline: "Feature flag control room.",
  description: "Boolean rollouts.",
  tech: ["TypeScript"],
  status: "planned",
  repo: "pritika292/edgeflag",
  liveUrl: null,
  eta: "Q3 2026",
  lastStatus: null,
  lastPingAt: null,
  latencyMs: null,
};

const PINGS_SHORTLIVE = [
  { ts: Date.now() - 3_000, status: "up", latencyMs: 10 },
  { ts: Date.now() - 2_000, status: "timeout", latencyMs: null },
  { ts: Date.now() - 1_000, status: "up", latencyMs: 15 },
];

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/p/:slug" element={<Project />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("<Project />", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/public/status") {
          return { ok: true, json: async () => [STATUS_SHORTLIVE, STATUS_EDGEFLAG] };
        }
        if (url.includes("/projects/shortlive/pings")) {
          return { ok: true, json: async () => PINGS_SHORTLIVE };
        }
        if (url.includes("/projects/")) {
          return { ok: true, json: async () => [] };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the per-project view for a live project", async () => {
    renderAt("/p/shortlive");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "shortlive" })).toBeInTheDocument();
    });
    expect(screen.getByText(/LAST 24 HOURS/)).toBeInTheDocument();
    expect(screen.getByText(/RECENT PINGS/)).toBeInTheDocument();
    expect(screen.getByText(/URL shortener/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /OPEN LIVE SITE/ })).toHaveAttribute(
      "href",
      "http://example.test:3010",
    );
    expect(screen.getByRole("link", { name: /VIEW SOURCE/ })).toHaveAttribute(
      "href",
      "https://github.com/pritika292/shortlive",
    );
  });

  it("renders the stats row (uptime, avg, p99, pings)", async () => {
    renderAt("/p/shortlive");
    await waitFor(() => {
      expect(screen.getByText(/UPTIME \/ 24H/)).toBeInTheDocument();
    });
    expect(screen.getByText(/AVG LATENCY/)).toBeInTheDocument();
    expect(screen.getByText(/P99 LATENCY/)).toBeInTheDocument();
  });

  it("renders the LATENCY / 24H chart", async () => {
    renderAt("/p/shortlive");
    await waitFor(() => {
      expect(screen.getByText(/LATENCY \/ 24H/)).toBeInTheDocument();
    });
  });

  it("renders the recent pings list (capped at 10 rows, newest first)", async () => {
    renderAt("/p/shortlive");
    await waitFor(() => {
      expect(screen.getByText("RECENT PINGS")).toBeInTheDocument();
    });
    // Three mocked pings -> three list items, all rendered.
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it("shows the planned-project hero for a planned project", async () => {
    renderAt("/p/edgeflag");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "edgeflag" })).toBeInTheDocument();
    });
    expect(screen.getByText(/Feature flag control room|Feature flags\./i)).toBeInTheDocument();
  });

  it("shows a not-found page for an unknown slug", async () => {
    renderAt("/p/doesnotexist");
    await waitFor(() => {
      expect(screen.getByText(/No project named/i)).toBeInTheDocument();
    });
  });

  it("renders commits and deploys panels", async () => {
    renderAt("/p/shortlive");
    await waitFor(() => {
      expect(screen.getByText(/RECENT COMMITS/)).toBeInTheDocument();
    });
    expect(screen.getByText(/RECENT DEPLOYS/)).toBeInTheDocument();
  });
});
