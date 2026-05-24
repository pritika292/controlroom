import { describe, it, expect } from "vitest";
import { projects, getLiveProjects, getProject } from "../src/server/projects.js";

describe("project registry", () => {
  it("has 12 entries", () => {
    expect(projects).toHaveLength(12);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(projects)).toBe(true);
  });

  it("getLiveProjects returns shortlive and pg-inspector", () => {
    const live = getLiveProjects();
    const slugs = live.map((p) => p.slug).sort();
    expect(slugs).toEqual(["pg-inspector", "shortlive"]);
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
