import { describe, expect, it } from "vitest";
import { findTables } from "../src/find-tables.js";
import { parse } from "../src/parse.js";

describe("findTables", () => {
  it("returns nothing for a doc with no tables", () => {
    expect(findTables(parse("plain paragraph text\n"))).toEqual([]);
  });

  it("finds a 2x2 table with outer start/end covering header through last body row", () => {
    // 0         1         2
    // 0123456789012345678901234567890
    // | a | b |\n| - | - |\n| 1 | 2 |\n
    const md = "| a | b |\n| - | - |\n| 1 | 2 |\n";
    const tables = findTables(parse(md));
    expect(tables).toHaveLength(1);
    expect(tables[0]).toMatchObject({ type: "table", start: 0, end: 29 });
  });

  it("captures column alignment from the separator row", () => {
    const md = "| L | C | R |\n| :- | :-: | -: |\n| 1 | 2 | 3 |\n";
    const tables = findTables(parse(md));
    expect(tables[0]?.align).toEqual(["left", "center", "right"]);
  });

  it("returns null in align for default-aligned columns", () => {
    const md = "| a | b |\n| --- | --- |\n| 1 | 2 |\n";
    const tables = findTables(parse(md));
    expect(tables[0]?.align).toEqual([null, null]);
  });

  it("returns the alignment-row offsets between header and first body row", () => {
    // 0         1         2
    // 0123456789012345678901234567890
    // | a | b |\n| - | - |\n| 1 | 2 |\n
    //           ^^^^^^^^^             alignmentRow: 10..19
    const md = "| a | b |\n| - | - |\n| 1 | 2 |\n";
    const tables = findTables(parse(md));
    expect(tables[0]?.alignmentRow).toEqual({ start: 10, end: 19 });
  });

  it("emits rows in document order with isHeader true on the first row only", () => {
    // 0         1         2         3
    // 0123456789012345678901234567890123456789
    // | a | b |\n| - | - |\n| 1 | 2 |\n| 3 | 4 |\n
    const md = "| a | b |\n| - | - |\n| 1 | 2 |\n| 3 | 4 |\n";
    const rows = findTables(parse(md))[0]?.rows ?? [];
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ isHeader: true, start: 0, end: 9 });
    expect(rows[1]).toMatchObject({ isHeader: false, start: 20, end: 29 });
    expect(rows[2]).toMatchObject({ isHeader: false, start: 30, end: 39 });
  });

  it("emits cells per row with offsets covering each cell's source range", () => {
    // 0         1
    // 0123456789012345678
    // | a | b |\n| - | - |\n| 1 | 2 |\n
    const md = "| a | b |\n| - | - |\n| 1 | 2 |\n";
    const rows = findTables(parse(md))[0]?.rows ?? [];
    expect(rows[0]?.cells).toEqual([
      { start: 0, end: 4 },
      { start: 4, end: 9 },
    ]);
    expect(rows[1]?.cells).toEqual([
      { start: 20, end: 24 },
      { start: 24, end: 29 },
    ]);
  });

  it("returns multiple tables in document order", () => {
    const md =
      "| a | b |\n| - | - |\n| 1 | 2 |\n\n" + // first
      "intermezzo paragraph\n\n" +
      "| c | d |\n| - | - |\n| 3 | 4 |\n"; // second
    const tables = findTables(parse(md));
    expect(tables).toHaveLength(2);
    expect(tables[0]!.start).toBeLessThan(tables[1]!.start);
  });

  it("surfaces tables nested inside a blockquote", () => {
    const md = "> | a | b |\n> | - | - |\n> | 1 | 2 |\n";
    const tables = findTables(parse(md));
    expect(tables).toHaveLength(1);
    expect(tables[0]?.rows).toHaveLength(2);
  });
});
