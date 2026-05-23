import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Home } from "../../src/client/pages/Home.js";

const STATUS_BODY = [
  {
    slug: "shortlive",
    name: "shortlive",
    status: "live",
    lastStatus: "up",
    lastPingAt: new Date(Date.now() - 1_000).toISOString(),
    latencyMs: 50,
  },
  {
    slug: "edgeflag",
    name: "edgeflag",
    status: "planned",
    lastStatus: null,
    lastPingAt: null,
    latencyMs: null,
  },
];

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

  it("renders the page title and tagline", async () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "controlroom" })).toBeInTheDocument();
    expect(screen.getByText(/Live status across every project/i)).toBeInTheDocument();
  });

  it("renders a card per project after the status fetch resolves", async () => {
    render(<Home />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "shortlive" })).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "edgeflag" })).toBeInTheDocument();
  });

  it("shows an error message when the status fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<Home />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/offline/);
    });
  });
});
