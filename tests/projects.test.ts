import { describe, it, expect } from "vitest";
import { projects, getLiveProjects, getProject } from "../src/server/projects.js";

describe("project registry", () => {
  it("has 14 entries", () => {
    expect(projects).toHaveLength(14);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(projects)).toBe(true);
  });

  it("getLiveProjects returns the four currently-live projects", () => {
    const live = getLiveProjects();
    const slugs = live.map((p) => p.slug).sort();
    expect(slugs).toEqual(["focusroom", "pg-inspector", "portfolio", "shortlive"]);
  });

  it("getProject finds focusroom", () => {
    const p = getProject("focusroom");
    expect(p).toBeDefined();
    expect(p?.status).toBe("live");
    expect(p?.liveUrl).toBe("https://focusroom.pritika.studio");
    expect(p?.repo).toBe("pritika292/focusroom");
  });

  it("getProject finds portfolio with apex-domain liveUrl", () => {
    const p = getProject("portfolio");
    expect(p).toBeDefined();
    expect(p?.status).toBe("live");
    expect(p?.liveUrl).toBe("https://pritika.studio");
    expect(p?.repo).toBe("pritika292/portfolio");
  });

  it("getProject finds shortlive", () => {
    const p = getProject("shortlive");
    expect(p).toBeDefined();
    expect(p?.status).toBe("live");
    expect(p?.liveUrl).toBe("https://shortlive.pritika.studio");
    expect(p?.repo).toBe("pritika292/shortlive");
  });

  it("getProject finds pg-inspector with hardcoded short-subdomain liveUrl", () => {
    const p = getProject("pg-inspector");
    expect(p).toBeDefined();
    expect(p?.status).toBe("live");
    expect(p?.liveUrl).toBe("https://pg.pritika.studio");
    expect(p?.repo).toBe("pritika292/pg-inspector");
    expect(p?.port).toBe(3014);
  });

  it("getProject returns undefined for unknown slug", () => {
    expect(getProject("bogus")).toBeUndefined();
  });
});
