import { describe, expect, it } from "vitest";
import { findBlocks } from "../src/find-blocks.js";
import { parse } from "../src/parse.js";

describe("findBlocks", () => {
  it("returns nothing for a doc with no block-level structure", () => {
    expect(findBlocks(parse("plain paragraph text\n"))).toEqual([]);
  });

  it("finds an ATX heading with marker range covering '# '", () => {
    // 0123456789
    // # Hello\n
    const blocks = findBlocks(parse("# Hello\n"));
    expect(blocks).toEqual([
      { type: "heading", depth: 1, start: 0, end: 7, markerStart: 0, markerEnd: 2 },
    ]);
  });

  it("captures heading depth for ## through ######", () => {
    const md = "## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six\n";
    const depths = findBlocks(parse(md))
      .filter((b) => b.type === "heading")
      .map((b) => (b.type === "heading" ? b.depth : null));
    expect(depths).toEqual([2, 3, 4, 5, 6]);
  });

  it("finds an unordered list item with marker range covering '- '", () => {
    // - one\n
    const blocks = findBlocks(parse("- one\n"));
    expect(blocks).toEqual([
      {
        type: "listItem",
        ordered: false,
        checked: null,
        start: 0,
        end: 5,
        markerStart: 0,
        markerEnd: 2,
        checkboxStart: null,
        checkboxEnd: null,
      },
    ]);
  });

  it("finds an ordered list item with marker range covering '1. '", () => {
    // 1. first\n
    const blocks = findBlocks(parse("1. first\n"));
    expect(blocks).toEqual([
      {
        type: "listItem",
        ordered: true,
        checked: null,
        start: 0,
        end: 8,
        markerStart: 0,
        markerEnd: 3,
        checkboxStart: null,
        checkboxEnd: null,
      },
    ]);
  });

  it("emits each list item separately", () => {
    const blocks = findBlocks(parse("- one\n- two\n- three\n"));
    expect(blocks).toHaveLength(3);
    expect(blocks.every((b) => b.type === "listItem")).toBe(true);
  });

  it("propagates ordered context to nested list items", () => {
    // - outer
    //   1. inner
    const md = "- outer\n  1. inner\n";
    const items = findBlocks(parse(md)).filter((b) => b.type === "listItem");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ ordered: false });
    expect(items[1]).toMatchObject({ ordered: true });
  });

  it("finds a blockquote covering all of its lines", () => {
    // > a
    // > b
    const blocks = findBlocks(parse("> a\n> b\n"));
    const bq = blocks.find((b) => b.type === "blockquote");
    expect(bq).toBeDefined();
    expect(bq).toMatchObject({ type: "blockquote", start: 0 });
    expect(bq!.end).toBe(7);
  });

  it("finds blocks nested inside a blockquote", () => {
    // > # heading
    // > - item
    const blocks = findBlocks(parse("> # heading\n> - item\n"));
    const types = blocks.map((b) => b.type);
    expect(types).toContain("blockquote");
    expect(types).toContain("heading");
    expect(types).toContain("listItem");
  });

  it("finds a fenced code block with language", () => {
    const md = "```js\nconsole.log(1);\n```\n";
    const code = findBlocks(parse(md)).find((b) => b.type === "code");
    expect(code).toEqual({ type: "code", lang: "js", start: 0, end: 25 });
  });

  it("finds a tilde-fenced code block with language", () => {
    const md = "~~~js\nconsole.log(1);\n~~~\n";
    const code = findBlocks(parse(md)).find((b) => b.type === "code");
    expect(code).toEqual({ type: "code", lang: "js", start: 0, end: 25 });
  });

  it("finds an indented (4-space) code block", () => {
    // Four-space-indented lines are CommonMark code blocks with no fence,
    // so the webview's fence regex won't match — they style as plain code lines.
    const md = "    plain code\n    more code\n";
    const code = findBlocks(parse(md)).find((b) => b.type === "code");
    expect(code).toMatchObject({ type: "code", lang: null, start: 0 });
  });

  it("represents a fenced code block with no language as lang: null", () => {
    const md = "```\nplain\n```\n";
    const code = findBlocks(parse(md)).find((b) => b.type === "code");
    expect(code).toMatchObject({ type: "code", lang: null });
  });

  it("returns blocks in document order", () => {
    const md = "# a\n\n- b\n\n> c\n\n```\nd\n```\n";
    const types = findBlocks(parse(md)).map((b) => b.type);
    expect(types).toEqual(["heading", "listItem", "blockquote", "code"]);
  });

  it("does not surface paragraphs or thematic breaks", () => {
    const blocks = findBlocks(parse("a paragraph\n\n---\n\nanother\n"));
    expect(blocks).toEqual([]);
  });

  it("returns checked:false and a checkbox range for `- [ ] foo`", () => {
    // 0123456789
    // - [ ] foo\n
    //   ^^^        checkboxStart=2, checkboxEnd=5
    const item = findBlocks(parse("- [ ] foo\n")).find((b) => b.type === "listItem");
    expect(item).toEqual({
      type: "listItem",
      ordered: false,
      checked: false,
      start: 0,
      end: 9,
      markerStart: 0,
      markerEnd: 6,
      checkboxStart: 2,
      checkboxEnd: 5,
    });
  });

  it("returns checked:true for `- [x] done`", () => {
    // 0123456789
    // - [x] done\n
    const item = findBlocks(parse("- [x] done\n")).find((b) => b.type === "listItem");
    expect(item).toMatchObject({
      type: "listItem",
      ordered: false,
      checked: true,
      checkboxStart: 2,
      checkboxEnd: 5,
    });
  });

  it("returns checked + checkbox range on an ordered task list", () => {
    // 0123456789
    // 1. [ ] x\n     checkbox at [3..6)
    const item = findBlocks(parse("1. [ ] x\n")).find((b) => b.type === "listItem");
    expect(item).toMatchObject({
      type: "listItem",
      ordered: true,
      checked: false,
      checkboxStart: 3,
      checkboxEnd: 6,
    });
  });

  it("emits each blockquote level when blockquotes are nested, with depth", () => {
    // > outer
    // > > nested
    const blockquotes = findBlocks(parse("> outer\n> > nested\n")).filter(
      (b) => b.type === "blockquote",
    );
    expect(blockquotes).toHaveLength(2);
    expect(blockquotes[0]).toMatchObject({ type: "blockquote", depth: 1, start: 0 });
    expect(blockquotes[1]).toMatchObject({ type: "blockquote", depth: 2 });
    // Inner block must come after the outer in offset-sorted order, and must
    // start somewhere on the second line (after the outer's first `>`).
    expect(blockquotes[1].start).toBeGreaterThan(blockquotes[0].start);
  });

  it("attaches depth: 1 to a single-level blockquote", () => {
    const bq = findBlocks(parse("> a\n> b\n")).find((b) => b.type === "blockquote");
    expect(bq).toMatchObject({ type: "blockquote", depth: 1 });
  });

  it("emits an empty marker range for a setext heading", () => {
    // Heading
    // =======
    const heading = findBlocks(parse("Heading\n=======\n")).find((b) => b.type === "heading");
    expect(heading).toBeDefined();
    expect(heading).toMatchObject({ type: "heading", depth: 1 });
    if (heading?.type === "heading") {
      expect(heading.markerStart).toBe(heading.markerEnd);
    }
  });
});
