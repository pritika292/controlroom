import { describe, it, expect } from "vitest";
import { projects, getLiveProjects, getProject } from "../src/server/projects.js";

describe("project registry", () => {
  it("has 5 entries (live only — planned slots dropped, #81)", () => {
    expect(projects).toHaveLength(5);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(projects)).toBe(true);
  });

  it("getLiveProjects returns the five currently-live projects", () => {
    const live = getLiveProjects();
    const slugs = live.map((p) => p.slug).sort();
    expect(slugs).toEqual(["controlroom", "focusroom", "pg-inspector", "portfolio", "shortlive"]);
  });

  it("codes are contiguous CR-01..CR-05 in registry order", () => {
    const codes = projects.map((p) => p.code);
    expect(codes).toEqual(["CR-01", "CR-02", "CR-03", "CR-04", "CR-05"]);
  });

  it("registry order matches portfolio SidePane order", () => {
    expect(projects.map((p) => p.slug)).toEqual([
      "focusroom",
      "controlroom",
      "pg-inspector",
      "shortlive",
      "portfolio",
    ]);
  });

  it("getProject finds controlroom (now self-registered)", () => {
    const p = getProject("controlroom");
    expect(p).toBeDefined();
    expect(p?.status).toBe("live");
    expect(p?.liveUrl).toBe("https://controlroom.pritika.studio");
    expect(p?.repo).toBe("pritika292/controlroom");
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
