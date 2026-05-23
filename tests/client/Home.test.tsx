import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Home } from "../../src/client/pages/Home.js";

const STATUS_BODY = [
  {
    slug: "shortlive",
    name: "shortlive",
    code: "CR-01",
    status: "live",
    eta: null,
    lastStatus: "up",
    lastPingAt: new Date(Date.now() - 1_000).toISOString(),
    latencyMs: 50,
  },
  {
    slug: "edgeflag",
    name: "edgeflag",
    code: "CR-04",
    status: "planned",
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
    expect(screen.getByText(/Eleven projects/i)).toBeInTheDocument();
  });

  it("renders a card per project after the status fetch resolves", async () => {
    renderHome();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "shortlive" })).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "edgeflag" })).toBeInTheDocument();
  });

  it("shows an error message when the status fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    renderHome();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/offline/);
    });
  });
});
