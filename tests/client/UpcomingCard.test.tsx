import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UpcomingCard } from "../../src/client/components/UpcomingCard.js";
import type { ProjectStatus } from "../../src/client/hooks/useStatus.js";

function planned(name: string, code: string): ProjectStatus {
  return {
    slug: name,
    name,
    code,
    tagline: "",
    description: "",
    tech: [],
    status: "planned",
    repo: `pritika292/${name}`,
    liveUrl: null,
    eta: "Q4 2026",
    lastStatus: null,
    lastPingAt: null,
    latencyMs: null,
  };
}

describe("<UpcomingCard />", () => {
  it("renders nothing when there are no planned projects", () => {
    const { container } = render(<UpcomingCard planned={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the count and lists each planned slug + code", () => {
    render(
      <UpcomingCard planned={[planned("hookrelay", "CR-02"), planned("flowforge", "CR-03")]} />,
    );
    expect(screen.getByText("UPCOMING")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("hookrelay")).toBeInTheDocument();
    expect(screen.getByText("flowforge")).toBeInTheDocument();
    expect(screen.getByText("CR-02")).toBeInTheDocument();
    expect(screen.getByText("CR-03")).toBeInTheDocument();
  });
});
