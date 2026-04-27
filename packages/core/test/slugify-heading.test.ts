import { describe, expect, it } from "vitest";
import { slugifyHeading, slugifyHeadings } from "../src/slugify-heading.js";

describe("slugifyHeading", () => {
  it("lowercases ASCII letters and joins words with hyphens", () => {
    expect(slugifyHeading("My Section")).toBe("my-section");
  });

  it("strips ASCII punctuation", () => {
    expect(slugifyHeading("What's New?")).toBe("whats-new");
  });

  it("collapses internal whitespace runs to a single hyphen", () => {
    expect(slugifyHeading("hello   world")).toBe("hello-world");
    expect(slugifyHeading("hello\tworld")).toBe("hello-world");
  });

  it("preserves underscores and hyphens", () => {
    expect(slugifyHeading("my_var-name")).toBe("my_var-name");
  });

  it("trims leading and trailing whitespace", () => {
    expect(slugifyHeading("  hi there  ")).toBe("hi-there");
  });

  it("returns empty string for pure-punctuation input", () => {
    expect(slugifyHeading("!!!")).toBe("");
    expect(slugifyHeading("")).toBe("");
  });
});

describe("slugifyHeadings", () => {
  it("appends -1 / -2 suffixes to repeated slugs", () => {
    expect(slugifyHeadings(["Intro", "Setup", "Intro", "Setup", "Intro"])).toEqual([
      "intro",
      "setup",
      "intro-1",
      "setup-1",
      "intro-2",
    ]);
  });
});
