import { describe, expect, it } from "vitest";
import { findImages } from "../src/find-images.js";
import { parse } from "../src/parse.js";

describe("findImages", () => {
  it("returns nothing for a doc with no images", () => {
    expect(findImages(parse("plain text\n"))).toEqual([]);
  });

  it("finds a basic image with outer offsets, url, alt, and null title", () => {
    // 0         1
    // 0123456789012
    // ![alt](url)
    const images = findImages(parse("![alt](url)\n"));
    expect(images).toEqual([
      { start: 0, end: 11, url: "url", alt: "alt", title: null },
    ]);
  });

  it("captures the title when present", () => {
    // ![alt](url "title")
    const images = findImages(parse('![alt](url "title")\n'));
    expect(images).toEqual([
      { start: 0, end: 19, url: "url", alt: "alt", title: "title" },
    ]);
  });

  it("returns alt as empty string when alt is empty", () => {
    // ![](url)
    const images = findImages(parse("![](url)\n"));
    expect(images).toEqual([{ start: 0, end: 8, url: "url", alt: "", title: null }]);
  });

  it("returns multiple images in document order", () => {
    // ![a](u) and ![b](v)
    const images = findImages(parse("![a](u) and ![b](v)\n"));
    expect(images).toEqual([
      { start: 0, end: 7, url: "u", alt: "a", title: null },
      { start: 12, end: 19, url: "v", alt: "b", title: null },
    ]);
  });

  it("finds an image inside a heading", () => {
    // # Look ![pic](u)
    const images = findImages(parse("# Look ![pic](u)\n"));
    expect(images).toEqual([{ start: 7, end: 16, url: "u", alt: "pic", title: null }]);
  });

  it("finds an image inside a list item", () => {
    // - ![alt](u)
    const images = findImages(parse("- ![alt](u)\n"));
    expect(images).toEqual([{ start: 2, end: 11, url: "u", alt: "alt", title: null }]);
  });

  it("finds an image inside a blockquote", () => {
    // > ![alt](u)
    const images = findImages(parse("> ![alt](u)\n"));
    expect(images).toEqual([{ start: 2, end: 11, url: "u", alt: "alt", title: null }]);
  });

  it("finds an image inside a table cell", () => {
    const md = "| h |\n| - |\n| ![alt](u) |\n";
    const images = findImages(parse(md));
    expect(images).toEqual([{ start: 14, end: 23, url: "u", alt: "alt", title: null }]);
  });

  it("finds an image wrapped in a link (image-in-link pattern)", () => {
    // [![alt](u)](https://example.com)
    const images = findImages(parse("[![alt](u)](https://example.com)\n"));
    expect(images).toEqual([{ start: 1, end: 10, url: "u", alt: "alt", title: null }]);
  });

  it("does not return reference-style images (out of scope for v1 step 8)", () => {
    // ![alt][ref] is mdast `imageReference`, not `image`
    const images = findImages(parse("![alt][ref]\n\n[ref]: url\n"));
    expect(images).toEqual([]);
  });

  it("recognises a remote https url", () => {
    const md = "![logo](https://example.com/logo.png)\n";
    const images = findImages(parse(md));
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      url: "https://example.com/logo.png",
      alt: "logo",
      title: null,
    });
  });
});
