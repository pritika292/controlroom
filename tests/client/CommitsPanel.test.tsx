import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CommitsPanel } from "../../src/client/components/CommitsPanel.js";

describe("<CommitsPanel />", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders a row per commit, linking to the GitHub commit URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { sha: "aaa1111aaa", author: "pritika292", message: "first", ts: Date.now() - 1000 },
          { sha: "bbb2222bbb", author: "pritika292", message: "second", ts: Date.now() - 500 },
        ],
      }),
    );

    render(<CommitsPanel slug="shortlive" repo="pritika292/shortlive" />);
    await waitFor(() => {
      expect(screen.getByText("first")).toBeInTheDocument();
    });
    expect(screen.getByText("second")).toBeInTheDocument();
    const link = screen.getByText("first").closest("a");
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/pritika292/shortlive/commit/aaa1111aaa",
    );
  });

  it("shows an empty-state when there are no cached commits", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    render(<CommitsPanel slug="shortlive" repo="pritika292/shortlive" />);
    await waitFor(() => {
      expect(screen.getByText(/No commits cached yet/i)).toBeInTheDocument();
    });
  });
});
