import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DeploysPanel } from "../../src/client/components/DeploysPanel.js";

describe("<DeploysPanel />", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders deploy rows with status pill and duration", async () => {
    const now = Date.now();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            sha: "deadbeef00000000",
            actor: "pritika292",
            startedAt: now - 2 * 60 * 1000,
            finishedAt: now - 60 * 1000,
            durationMs: 60_000,
            status: "success",
            runUrl: "https://github.com/x/y/actions/runs/1",
          },
        ],
      }),
    );
    render(<DeploysPanel slug="shortlive" />);
    await waitFor(() => {
      expect(screen.getByText(/success/)).toBeInTheDocument();
    });
    expect(screen.getByText(/deadbee/)).toBeInTheDocument();
    expect(screen.getByText(/1M 0S/)).toBeInTheDocument();
  });

  it("shows an empty-state when there are no deploys", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    render(<DeploysPanel slug="shortlive" />);
    await waitFor(() => {
      expect(screen.getByText(/No deploys yet/i)).toBeInTheDocument();
    });
  });
});
