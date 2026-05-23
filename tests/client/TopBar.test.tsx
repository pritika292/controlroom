import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TopBar } from "../../src/client/components/TopBar.js";

describe("<TopBar />", () => {
  it("renders STATUS and ABOUT nav links", () => {
    render(
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /^STATUS$/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /^ABOUT$/ })).toHaveAttribute("href", "/about");
  });

  it("renders the ThemeToggle button", () => {
    render(
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("button", { name: /switch to (light|dark) mode/i }),
    ).toBeInTheDocument();
  });

  it("renders the CONTROLROOM logo text", () => {
    render(
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>,
    );
    expect(screen.getByText("CONTROLROOM")).toBeInTheDocument();
  });
});
