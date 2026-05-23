import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { IncidentBanner } from "../../src/client/components/IncidentBanner.js";

const HIGH_OPEN = {
  id: "current",
  severity: "high",
  project: "shortlive",
  title: "shortlive is down",
  opened: new Date().toISOString(),
  closed: null,
  bodyHtml: "<p>investigating</p>",
};
const HIGH_CLOSED = { ...HIGH_OPEN, id: "old", closed: new Date().toISOString() };
const LOW_OPEN = { ...HIGH_OPEN, id: "low", severity: "low" };

describe("<IncidentBanner />", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders nothing when there are no incidents", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    const { container } = render(<IncidentBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when high-severity incidents are all closed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => [HIGH_CLOSED] }),
    );
    const { container } = render(<IncidentBanner />);
    // Give the effect a moment, then assert no banner.
    await new Promise((r) => setTimeout(r, 30));
    expect(container.querySelector("[role='alert']")).toBeNull();
  });

  it("renders nothing for open low-severity incidents", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [LOW_OPEN] }));
    const { container } = render(<IncidentBanner />);
    await new Promise((r) => setTimeout(r, 30));
    expect(container.querySelector("[role='alert']")).toBeNull();
  });

  it("renders an alert for an open high-severity incident", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [HIGH_OPEN] }));
    render(<IncidentBanner />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByText("shortlive is down")).toBeInTheDocument();
    expect(screen.getByText(/investigating/)).toBeInTheDocument();
  });
});
