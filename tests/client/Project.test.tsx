import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Project } from "../../src/client/pages/Project.js";

const STATUS_SHORTLIVE = {
  slug: "shortlive",
  name: "shortlive",
  status: "live",
  lastStatus: "up",
  lastPingAt: new Date(Date.now() - 5_000).toISOString(),
  latencyMs: 50,
};
const STATUS_EDGEFLAG = {
  slug: "edgeflag",
  name: "edgeflag",
  status: "planned",
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
    expect(screen.getByText(/Last 24 hours/i)).toBeInTheDocument();
    expect(screen.getByText(/Recent pings/i)).toBeInTheDocument();
  });

  it("renders a recent-pings table with one row per ping", async () => {
    renderAt("/p/shortlive");
    await waitFor(() => {
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
    // 1 header row + 3 data rows
    expect(screen.getAllByRole("row")).toHaveLength(4);
  });

  it("shows the planned-project hero for a planned project", async () => {
    renderAt("/p/edgeflag");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "edgeflag" })).toBeInTheDocument();
    });
    expect(screen.getByText(/not live yet/i)).toBeInTheDocument();
  });

  it("shows a not-found page for an unknown slug", async () => {
    renderAt("/p/doesnotexist");
    await waitFor(() => {
      expect(screen.getByText(/No project named/i)).toBeInTheDocument();
    });
  });

  it("includes Tier 4 placeholder cards for commits and deploys", async () => {
    renderAt("/p/shortlive");
    await waitFor(() => {
      expect(screen.getByText(/Recent commits/)).toBeInTheDocument();
    });
    expect(screen.getByText(/issue #19/)).toBeInTheDocument();
    expect(screen.getByText(/Recent deploys/)).toBeInTheDocument();
    expect(screen.getByText(/issue #21/)).toBeInTheDocument();
  });
});
