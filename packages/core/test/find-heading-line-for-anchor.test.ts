import { describe, expect, it } from "vitest";
import { findHeadingLineForAnchor } from "../src/find-heading-line-for-anchor.js";

describe("findHeadingLineForAnchor", () => {
  it("returns the 0-indexed line of a heading whose slug matches", () => {
    const md = ["# Intro", "", "## My Section", "", "body"].join("\n");
    expect(findHeadingLineForAnchor(md, "my-section")).toBe(2);
  });

  it("matches the second occurrence of a duplicate heading via -1 suffix", () => {
    const md = ["# Setup", "", "first", "", "# Setup", "", "second"].join("\n");
    expect(findHeadingLineForAnchor(md, "setup")).toBe(0);
    expect(findHeadingLineForAnchor(md, "setup-1")).toBe(4);
  });

  it("returns null when no heading slug matches", () => {
    const md = ["# Intro", "", "## My Section"].join("\n");
    expect(findHeadingLineForAnchor(md, "missing")).toBeNull();
  });

  it("returns null on a doc with no headings", () => {
    expect(findHeadingLineForAnchor("just paragraphs", "anything")).toBeNull();
  });
});
