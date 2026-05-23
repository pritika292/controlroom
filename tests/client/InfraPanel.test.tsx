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
    { code: "CR-02", name: "hookrelay", role: "planned", up: false },
  ],
  cost: { monthlyUsd: 30, note: "estimate at on-demand prices" },
};

describe("<InfraPanel />", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders the VM card, services card, cost card, and container grid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => INFRA_BODY }));
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
    expect(screen.getByText("CR-02")).toBeInTheDocument();
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
