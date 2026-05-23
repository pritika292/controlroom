import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProjectCard } from "../../src/client/components/ProjectCard.js";
import type { ProjectStatus } from "../../src/client/hooks/useStatus.js";

function liveStatus(overrides: Partial<ProjectStatus> = {}): ProjectStatus {
  return {
    slug: "shortlive",
    name: "shortlive",
    code: "CR-01",
    status: "live",
    eta: null,
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
    code: "CR-04",
    status: "planned",
    eta: "Q3 2026",
    lastStatus: null,
    lastPingAt: null,
    latencyMs: null,
    ...overrides,
  };
}

function renderCard(project: ProjectStatus): void {
  render(
    <MemoryRouter>
      <ProjectCard project={project} />
    </MemoryRouter>,
  );
}

describe("<ProjectCard />", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders project name, code, and latency for a live project", () => {
    renderCard(liveStatus());
    expect(screen.getByRole("heading", { name: "shortlive" })).toBeInTheDocument();
    expect(screen.getByText("CR-01")).toBeInTheDocument();
    expect(screen.getByText("42MS")).toBeInTheDocument();
  });

  it("shows the ETA for planned projects and skips latency", () => {
    renderCard(plannedStatus());
    expect(screen.getByText("Q3 2026")).toBeInTheDocument();
    expect(screen.queryByText(/MS$/)).toBeNull();
  });

  it("shows 'NO PINGS YET' for live projects with no ping data", () => {
    renderCard(liveStatus({ lastPingAt: null, latencyMs: null }));
    expect(screen.getByText("NO PINGS YET")).toBeInTheDocument();
  });

  it("does not fetch pings for planned projects", () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchSpy);
    renderCard(plannedStatus());
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("wraps the live card in a link to the project detail page", () => {
    renderCard(liveStatus());
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/p/shortlive");
  });
});
