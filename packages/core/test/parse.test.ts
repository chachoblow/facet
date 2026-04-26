import { describe, expect, it } from "vitest";
import type { List, Paragraph, Table } from "mdast";
import { parse } from "../src/parse.js";

describe("parse", () => {
  it("parses ATX headings with depth", () => {
    const root = parse("# One\n\n## Two\n\n### Three\n");
    const headings = root.children.filter((n) => n.type === "heading");
    expect(headings.map((h) => h.depth)).toEqual([1, 2, 3]);
  });

  it("parses unordered and ordered lists", () => {
    const root = parse("- a\n- b\n\n1. first\n2. second\n");
    const lists = root.children.filter((n): n is List => n.type === "list");
    expect(lists).toHaveLength(2);
    expect(lists[0]).toMatchObject({ ordered: false });
    expect(lists[1]).toMatchObject({ ordered: true, start: 1 });
  });

  it("parses inline links with url and title", () => {
    const root = parse('See [Facet](https://example.com "Home").\n');
    const para = root.children[0] as Paragraph;
    const link = para.children.find((c) => c.type === "link");
    expect(link).toMatchObject({
      type: "link",
      url: "https://example.com",
      title: "Home",
    });
  });

  it("parses fenced code blocks with language info", () => {
    const root = parse("```ts\nconst x: number = 1;\n```\n");
    expect(root.children[0]).toMatchObject({
      type: "code",
      lang: "ts",
      value: "const x: number = 1;",
    });
  });

  it("parses GFM tables with alignment", () => {
    const md = "| L | C | R |\n| :- | :-: | -: |\n| 1 | 2 | 3 |\n";
    const root = parse(md);
    const table = root.children[0] as Table;
    expect(table.type).toBe("table");
    expect(table.align).toEqual(["left", "center", "right"]);
    expect(table.children).toHaveLength(2); // header + 1 row
  });

  it("parses GFM task list items with checked state", () => {
    const root = parse("- [x] done\n- [ ] todo\n- [ ] also todo\n");
    const list = root.children[0] as List;
    expect(list.children.map((item) => item.checked)).toEqual([true, false, false]);
  });

  it("parses GFM strikethrough as a delete node", () => {
    const root = parse("~~gone~~ kept\n");
    const para = root.children[0] as Paragraph;
    expect(para.children[0]).toMatchObject({ type: "delete" });
  });
});
