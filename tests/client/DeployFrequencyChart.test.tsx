import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DeployFrequencyChart } from "../../src/client/components/DeployFrequencyChart.js";

describe("<DeployFrequencyChart />", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders the header with total and per-day average", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          days: 7,
          total: 14,
          buckets: [
            { date: "2026-05-17", count: 0 },
            { date: "2026-05-18", count: 3 },
            { date: "2026-05-19", count: 0 },
            { date: "2026-05-20", count: 5 },
            { date: "2026-05-21", count: 0 },
            { date: "2026-05-22", count: 2 },
            { date: "2026-05-23", count: 4 },
          ],
        }),
      }),
    );

    render(<DeployFrequencyChart />);
    await waitFor(() => {
      expect(screen.getByText(/DEPLOYS \/ LAST 7 DAYS/)).toBeInTheDocument();
    });
    expect(screen.getByText(/14 TOTAL \/ 2\.0 PER DAY/)).toBeInTheDocument();
  });

  it("renders one bar per bucket with aria-labels carrying the date + count", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          days: 3,
          total: 1,
          buckets: [
            { date: "2026-05-21", count: 0 },
            { date: "2026-05-22", count: 0 },
            { date: "2026-05-23", count: 1 },
          ],
        }),
      }),
    );

    render(<DeployFrequencyChart />);
    await waitFor(() => {
      expect(screen.getByLabelText("2026-05-23: 1 deploy")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("2026-05-21: 0 deploys")).toBeInTheDocument();
  });

  it("renders a placeholder while loading and the chart after the fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    const { container } = render(<DeployFrequencyChart />);
    // No header before data lands
    expect(container.textContent).not.toMatch(/DEPLOYS \/ LAST/);
  });
});
