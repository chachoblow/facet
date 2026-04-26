import { describe, expect, it } from "vitest";
import { findInlineMarks } from "../src/find-inline-marks.js";
import { parse } from "../src/parse.js";

describe("findInlineMarks", () => {
  it("returns nothing for a doc with no inline marks", () => {
    expect(findInlineMarks(parse("plain text\n"))).toEqual([]);
  });

  it("finds a strong mark with outer and inner offsets", () => {
    // 0123456789
    // **bold**
    const marks = findInlineMarks(parse("**bold**\n"));
    expect(marks).toEqual([{ type: "strong", start: 0, end: 8, innerStart: 2, innerEnd: 6 }]);
  });

  it("finds an emphasis mark with outer and inner offsets", () => {
    // *italic*
    const marks = findInlineMarks(parse("*italic*\n"));
    expect(marks).toEqual([{ type: "emphasis", start: 0, end: 8, innerStart: 1, innerEnd: 7 }]);
  });

  it("finds a link with url, title, and inner range covering only the text", () => {
    // [Facet](https://example.com "Home")
    const marks = findInlineMarks(parse('[Facet](https://example.com "Home")\n'));
    expect(marks).toEqual([
      {
        type: "link",
        start: 0,
        end: 35,
        innerStart: 1,
        innerEnd: 6,
        url: "https://example.com",
        title: "Home",
      },
    ]);
  });

  it("represents a link with no title as title: null", () => {
    const marks = findInlineMarks(parse("[Facet](https://example.com)\n"));
    expect(marks).toEqual([
      {
        type: "link",
        start: 0,
        end: 28,
        innerStart: 1,
        innerEnd: 6,
        url: "https://example.com",
        title: null,
      },
    ]);
  });

  it("returns marks in document order", () => {
    // *a* and **b** and [c](u)
    const marks = findInlineMarks(parse("*a* and **b** and [c](u)\n"));
    expect(marks.map((m) => m.type)).toEqual(["emphasis", "strong", "link"]);
    expect(marks.map((m) => m.start)).toEqual([0, 8, 18]);
  });

  it("recurses into nested marks (emphasis inside strong)", () => {
    // **bold *and italic***
    const marks = findInlineMarks(parse("**bold *and italic***\n"));
    expect(marks).toHaveLength(2);
    const strong = marks.find((m) => m.type === "strong");
    const emphasis = marks.find((m) => m.type === "emphasis");
    expect(strong).toMatchObject({ start: 0, end: 21, innerStart: 2, innerEnd: 19 });
    expect(emphasis).toMatchObject({ start: 7, end: 19, innerStart: 8, innerEnd: 18 });
  });

  it("finds marks inside headings", () => {
    // # Hello **world**
    const marks = findInlineMarks(parse("# Hello **world**\n"));
    expect(marks).toEqual([{ type: "strong", start: 8, end: 17, innerStart: 10, innerEnd: 15 }]);
  });

  it("finds marks inside list items", () => {
    // - one *two*
    // - **three** four
    const marks = findInlineMarks(parse("- one *two*\n- **three** four\n"));
    expect(marks.map((m) => m.type)).toEqual(["emphasis", "strong"]);
  });

  it("finds marks inside blockquotes", () => {
    const marks = findInlineMarks(parse("> a [link](u) here\n"));
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ type: "link", url: "u" });
  });

  it("finds marks inside table cells", () => {
    const md = "| h |\n| - |\n| **bold** |\n";
    const marks = findInlineMarks(parse(md));
    expect(marks).toHaveLength(1);
    expect(marks[0]?.type).toBe("strong");
  });

  it("does not return strikethrough (delete) — out of scope for v1 step 3", () => {
    const marks = findInlineMarks(parse("~~gone~~\n"));
    expect(marks).toEqual([]);
  });

  it("ignores inline code spans (not in v1 step 3)", () => {
    const marks = findInlineMarks(parse("`code` and *real*\n"));
    expect(marks.map((m) => m.type)).toEqual(["emphasis"]);
  });
});
