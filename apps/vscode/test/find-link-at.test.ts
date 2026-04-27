import { describe, expect, it } from "vitest";
import { findLinkAt } from "../src/webview/find-link-at.js";

describe("findLinkAt", () => {
  it("returns null when the offset is outside any link", () => {
    const doc = "see [docs](./readme.md) here";
    expect(findLinkAt(doc, 0)).toBeNull();
  });

  it("returns the url and outer bounds when the offset falls inside a link", () => {
    // "see [docs](./readme.md) here"
    //  012345678901234567890123456789
    // link outer: 4..23
    const doc = "see [docs](./readme.md) here";
    expect(findLinkAt(doc, 7)).toEqual({ url: "./readme.md", start: 4, end: 23 });
    expect(findLinkAt(doc, 4)).toEqual({ url: "./readme.md", start: 4, end: 23 });
    expect(findLinkAt(doc, 22)).toEqual({ url: "./readme.md", start: 4, end: 23 });
  });

  it("finds a link nested inside a heading", () => {
    // "# See [spec](./spec.md)"
    //  0123456789012345678901234
    // link outer: 6..22
    const doc = "# See [spec](./spec.md)";
    expect(findLinkAt(doc, 10)).toEqual({ url: "./spec.md", start: 6, end: 23 });
    expect(findLinkAt(doc, 0)).toBeNull();
  });
});
