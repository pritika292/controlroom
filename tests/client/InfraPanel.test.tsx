import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { InfraPanel } from "../../src/client/components/InfraPanel.js";

const INFRA_BODY = {
  vm: {
    available: true,
    cpuPercent: 12.4,
    memUsedPercent: 38.1,
    region: "northcentralus",
    sampledAt: new Date().toISOString(),
    reason: null,
    uptimeSeconds: 12 * 3600 + 34 * 60, // 12h 34m
  },
  postgres: { up: true, latencyMs: 3 },
  redis: { up: true, latencyMs: 1 },
  containers: [
    { code: "CTL", name: "controlroom", role: "app", up: true },
    { code: "DB", name: "pritika-postgres", role: "shared", up: true },
    { code: "CACHE", name: "pritika-redis", role: "shared", up: true },
    { code: "CR-01", name: "shortlive", role: "project", up: true },
    { code: "UPCOMING", name: "10 planned", role: "planned", up: false },
  ],
  cost: { monthlyUsd: 30, note: "estimate at on-demand prices" },
};

const INFRA_EXTRAS_BODY = {
  visitsThisWeek: 17,
  deploysThisWeek: 5,
  openIssues: 3,
  pgConnections: { used: 4, max: 100 },
  redisKeys: 12,
  lastDeploy: { slug: "shortlive", whenMs: Date.now() - 10_000, status: "success" },
  uptime7dPct: 99.5,
  ai: {
    callsToday: 12,
    tokensToday: 45000,
    costTodayCents: 4.2,
    callsThisWeek: 84,
    modelInUse: "gpt-4.1-mini",
  },
};

function urlAwareFetch(): ReturnType<typeof vi.fn> {
  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const body = url.includes("/api/public/infra-extras") ? INFRA_EXTRAS_BODY : INFRA_BODY;
    return Promise.resolve({ ok: true, json: async () => body });
  });
}

describe("<InfraPanel />", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders the VM card, services card, cost card, and container grid", async () => {
    vi.stubGlobal("fetch", urlAwareFetch());
    render(<InfraPanel />);

    await waitFor(() => {
      expect(screen.getByText("INFRASTRUCTURE")).toBeInTheDocument();
    });
    expect(screen.getByText("B2as_v2")).toBeInTheDocument();
    expect(screen.getByText("12.4%")).toBeInTheDocument();
    expect(screen.getByText("38.1%")).toBeInTheDocument();
    expect(screen.getByText("northcentralus")).toBeInTheDocument();
    expect(screen.getByText("postgres + redis")).toBeInTheDocument();
    expect(screen.getByText("$30")).toBeInTheDocument();
    expect(screen.getByText("CTL")).toBeInTheDocument();
    expect(screen.getByText("CR-01")).toBeInTheDocument();
    expect(screen.getByText("UPCOMING")).toBeInTheDocument();
    expect(screen.getByText(/4\/5 UP/)).toBeInTheDocument();
  });

  it("renders an empty placeholder until infra arrives", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    const { container } = render(<InfraPanel />);
    // No INFRASTRUCTURE heading yet -- just the reserved-height div
    expect(container.querySelector("section")).toBeNull();
  });
});
