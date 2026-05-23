import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectCard } from "../../src/client/components/ProjectCard.js";
import type { ProjectStatus } from "../../src/client/hooks/useStatus.js";

function liveStatus(overrides: Partial<ProjectStatus> = {}): ProjectStatus {
  return {
    slug: "shortlive",
    name: "shortlive",
    status: "live",
    lastStatus: "up",
    lastPingAt: new Date(Date.now() - 5_000).toISOString(),
    latencyMs: 42,
    ...overrides,
  };
}

function plannedStatus(overrides: Partial<ProjectStatus> = {}): ProjectStatus {
  return {
    slug: "edgeflag",
    name: "edgeflag",
    status: "planned",
    lastStatus: null,
    lastPingAt: null,
    latencyMs: null,
    ...overrides,
  };
}

describe("<ProjectCard />", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders project name and latency for a live project", () => {
    render(<ProjectCard project={liveStatus()} />);
    expect(screen.getByRole("heading", { name: "shortlive" })).toBeInTheDocument();
    expect(screen.getByText(/42 ms/)).toBeInTheDocument();
  });

  it("shows 'planned' pill for planned projects and skips latency", () => {
    render(<ProjectCard project={plannedStatus()} />);
    expect(screen.getByText("planned", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByText(/ms/)).toBeNull();
  });

  it("shows 'no pings yet' for live projects with no ping data", () => {
    render(<ProjectCard project={liveStatus({ lastPingAt: null, latencyMs: null })} />);
    expect(screen.getByText("no pings yet")).toBeInTheDocument();
  });

  it("does not fetch pings for planned projects", () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchSpy);
    render(<ProjectCard project={plannedStatus()} />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
