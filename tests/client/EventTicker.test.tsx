import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventTicker } from "../../src/client/components/EventTicker.js";

describe("<EventTicker />", () => {
  it("shows a waiting message when no events have arrived", () => {
    render(<EventTicker events={[]} />);
    expect(screen.getByText(/WAITING FOR FIRST EVENT/)).toBeInTheDocument();
  });

  it("renders a one-line summary per status_change event", () => {
    const now = Date.now();
    render(
      <EventTicker
        events={[
          {
            ts: now - 2_000,
            name: "status_change",
            data: { slug: "shortlive", status: "up", previous: "down" },
          },
          {
            ts: now - 60_000,
            name: "status_change",
            data: { slug: "shortlive", status: "down", previous: "up" },
          },
        ]}
      />,
    );
    // Two entries both mention SHORTLIVE; one transition each direction.
    expect(screen.getAllByText(/SHORTLIVE/)).toHaveLength(2);
    expect(screen.getByText(/DOWN → UP/)).toBeInTheDocument();
    expect(screen.getByText(/UP → DOWN/)).toBeInTheDocument();
  });

  it("renders the SSE CONNECTED label for hello events", () => {
    render(<EventTicker events={[{ ts: Date.now(), name: "hello", data: { ok: true } }]} />);
    expect(screen.getByText(/SSE CONNECTED/)).toBeInTheDocument();
  });
});
