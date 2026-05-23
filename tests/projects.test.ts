import { describe, it, expect } from "vitest";
import { projects, getLiveProjects, getProject } from "../src/server/projects.js";

describe("project registry", () => {
  it("has 11 entries", () => {
    expect(projects).toHaveLength(11);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(projects)).toBe(true);
  });

  it("getLiveProjects returns only shortlive", () => {
    const live = getLiveProjects();
    expect(live).toHaveLength(1);
    expect(live[0]?.slug).toBe("shortlive");
  });

  it("getProject finds shortlive", () => {
    const p = getProject("shortlive");
    expect(p).toBeDefined();
    expect(p?.status).toBe("live");
    expect(p?.liveUrl).toBe("https://shortlive.pritika.studio");
    expect(p?.repo).toBe("pritika292/shortlive");
  });

  it("getProject returns undefined for unknown slug", () => {
    expect(getProject("bogus")).toBeUndefined();
  });
});
