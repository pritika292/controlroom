import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IssuesPanel } from "../../src/client/components/IssuesPanel.js";

interface FakeIssue {
  project: string;
  number: number;
  title: string;
  state: "open" | "closed";
  openedAt: number;
  closedAt: number | null;
  url: string;
}

function mk(num: number, state: "open" | "closed", title = `issue ${num}`): FakeIssue {
  return {
    project: "shortlive",
    number: num,
    title,
    state,
    openedAt: Date.now() - num * 1000,
    closedAt: state === "closed" ? Date.now() - num * 500 : null,
    url: `https://github.com/p/p/issues/${num}`,
  };
}

function fetchMockBy(byState: { open?: FakeIssue[]; closed?: FakeIssue[]; all?: FakeIssue[] }) {
  return vi.fn(async (url: string) => {
    const body = url.includes("state=closed")
      ? (byState.closed ?? [])
      : url.includes("state=all")
        ? (byState.all ?? [])
        : (byState.open ?? []);
    return { ok: true, json: async () => body };
  });
}

describe("<IssuesPanel />", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("defaults to OPEN, renders one row per issue with a GitHub link", async () => {
    vi.stubGlobal(
      "fetch",
      fetchMockBy({ open: [mk(1, "open", "first"), mk(2, "open", "second")] }),
    );
    render(<IssuesPanel />);

    await waitFor(() => {
      expect(screen.getByText("first")).toBeInTheDocument();
    });
    expect(screen.getByText("second")).toBeInTheDocument();
    const link = screen.getByText("first").closest("a");
    expect(link).toHaveAttribute("href", "https://github.com/p/p/issues/1");
  });

  it("switches to CLOSED when its tab is clicked", async () => {
    vi.stubGlobal(
      "fetch",
      fetchMockBy({
        open: [mk(1, "open", "open ticket")],
        closed: [mk(9, "closed", "closed ticket")],
      }),
    );
    render(<IssuesPanel />);

    await waitFor(() => {
      expect(screen.getByText("open ticket")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: /closed/i }));

    await waitFor(() => {
      expect(screen.getByText("closed ticket")).toBeInTheDocument();
    });
  });

  it("shows the empty-state when no issues match", async () => {
    vi.stubGlobal("fetch", fetchMockBy({ open: [] }));
    render(<IssuesPanel />);
    await waitFor(() => {
      expect(screen.getByText(/no open issues/i)).toBeInTheDocument();
    });
  });
});
