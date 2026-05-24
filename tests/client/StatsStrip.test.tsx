import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { StatsStrip } from "../../src/client/components/StatsStrip.js";

describe("<StatsStrip />", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows projects live, deploys this week, commits cached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          projectsLive: 5,
          projectsTotal: 5,
          commitsCached: 42,
          deploysLastWeek: 7,
        }),
      }),
    );
    render(<StatsStrip />);
    await waitFor(() => {
      expect(screen.getByText("5/5")).toBeInTheDocument();
    });
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders an empty placeholder until stats arrive", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})), // never resolves
    );
    const { container } = render(<StatsStrip />);
    // The empty placeholder is a div with aria-hidden; no <dl> until data lands.
    expect(container.querySelector("dl")).toBeNull();
  });
});
