import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Home } from "../../src/client/pages/Home.js";

const STATUS_BODY = [
  {
    slug: "shortlive",
    name: "shortlive",
    code: "CR-01",
    tagline: "URL shortener.",
    description: "Live click analytics.",
    tech: ["TypeScript"],
    status: "live",
    repo: "pritika292/shortlive",
    liveUrl: "http://example.test:3010",
    eta: null,
    lastStatus: "up",
    lastPingAt: new Date(Date.now() - 1_000).toISOString(),
    latencyMs: 50,
  },
  {
    slug: "edgeflag",
    name: "edgeflag",
    code: "CR-04",
    tagline: "Feature flags.",
    description: "Boolean rollouts.",
    tech: ["TypeScript"],
    status: "planned",
    repo: "pritika292/edgeflag",
    liveUrl: null,
    eta: "Q3 2026",
    lastStatus: null,
    lastPingAt: null,
    latencyMs: null,
  },
];

function renderHome(): void {
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

describe("<Home />", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/public/status") {
          return { ok: true, json: async () => STATUS_BODY };
        }
        if (url === "/api/public/infra") {
          return {
            ok: true,
            json: async () => ({
              vm: {
                available: false,
                cpuPercent: null,
                memUsedPercent: null,
                region: null,
                sampledAt: null,
                reason: "unavailable in test",
                uptimeSeconds: 1,
              },
              postgres: { up: true, latencyMs: 1 },
              redis: { up: true, latencyMs: 1 },
              containers: [],
              cost: { monthlyUsd: 30, note: "test" },
            }),
          };
        }
        if (url.startsWith("/api/public/deploys/frequency")) {
          return {
            ok: true,
            json: async () => ({
              days: 14,
              total: 0,
              buckets: Array.from({ length: 14 }, (_, i) => ({
                date: `2026-05-${String(10 + i).padStart(2, "0")}`,
                count: 0,
              })),
            }),
          };
        }
        if (url === "/api/public/infra-extras") {
          return {
            ok: true,
            json: async () => ({
              visitsThisWeek: 0,
              deploysThisWeek: 0,
              openIssues: 0,
              pgConnections: { used: 0, max: 100 },
              redisKeys: 0,
              largestTable: null,
              lastDeploy: null,
              uptime7dPct: null,
            }),
          };
        }
        return { ok: true, json: async () => [] };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the page title and tagline", () => {
    renderHome();
    expect(screen.getByRole("heading", { name: "STATUS BOARD" })).toBeInTheDocument();
    expect(screen.getByText(/Five projects/i)).toBeInTheDocument();
  });

  it("renders a card per LIVE project plus one UPCOMING card after fetch resolves", async () => {
    renderHome();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "shortlive" })).toBeInTheDocument();
    });
    // edgeflag is planned -- it should NOT have its own card
    expect(screen.queryByRole("heading", { name: "edgeflag" })).toBeNull();
    // but should appear inside the UPCOMING card's list
    expect(screen.getByText("UPCOMING")).toBeInTheDocument();
    expect(screen.getByText("edgeflag")).toBeInTheDocument();
  });

  it("shows an error message when the status fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    renderHome();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/offline/);
    });
  });
});
