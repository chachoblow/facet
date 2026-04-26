import { describe, expect, it } from "vitest";
import { Text } from "@codemirror/state";
import { type Decoration } from "@codemirror/view";
import { buildTableDecorations } from "../src/webview/table-marks.js";

// Table doc shared across tests:
// 0         1         2         3
// 0123456789012345678901234567890123
// | a | b |\n| - | - |\n| 1 | 2 |\n\nend\n
//                                   ^ blank line at 30, "end" at 31
// A blank line is required between the table and "end" — without it, GFM
// extends the table to include "end" as a malformed body row.
const tableDoc = Text.of(["| a | b |", "| - | - |", "| 1 | 2 |", "", "end", ""]);

function decorationsAt(
  decorations: ReturnType<typeof buildTableDecorations>,
  from: number,
  to: number,
  predicate: (value: Parameters<Parameters<typeof decorations.between>[2]>[2]) => boolean,
): boolean {
  let found = false;
  decorations.between(from, to, (a, b, value) => {
    if (a === from && b === to && predicate(value)) {
      found = true;
      return false;
    }
    return undefined;
  });
  return found;
}

function hasLineClass(
  decorations: ReturnType<typeof buildTableDecorations>,
  lineStart: number,
  className: string,
): boolean {
  return decorationsAt(
    decorations,
    lineStart,
    lineStart,
    (v) => v.spec.class === className || (v.spec.class as string)?.includes(className),
  );
}

describe("table-marks buildTableDecorations", () => {
  it("emits no decorations for a doc with no tables", () => {
    const doc = Text.of(["plain paragraph", ""]);
    expect(buildTableDecorations(doc, 0, 0).size).toBe(0);
  });

  it("emits .facet-table-line on every line of a table", () => {
    const decos = buildTableDecorations(tableDoc, 31, 31); // cursor on "end" line
    expect(hasLineClass(decos, 0, "facet-table-line")).toBe(true);
    expect(hasLineClass(decos, 10, "facet-table-line")).toBe(true);
    expect(hasLineClass(decos, 20, "facet-table-line")).toBe(true);
  });

  it("hides each pipe when the cursor is outside the table", () => {
    // | a | b |
    // ^   ^   ^   pipes at offsets 0, 4, 8
    const decos = buildTableDecorations(tableDoc, 31, 31); // cursor on "end" line
    const pipes = collectByPredicate(
      decos,
      (from, to, v) => to === from + 1 && v.spec.widget === undefined,
    );
    expect(pipes.map((p) => p.from)).toEqual([0, 4, 8, 10, 14, 18, 20, 24, 28]);
  });

  it("does not hide pipes when the cursor is on any line of the table", () => {
    // Cursor on line 2 (alignment row), offset 12 = inside "| - | - |"
    const decos = buildTableDecorations(tableDoc, 12, 12);
    const pipes = collectByPredicate(
      decos,
      (from, to, v) => to === from + 1 && v.spec.widget === undefined,
    );
    expect(pipes).toEqual([]);
  });

  it("emits .facet-table-alignment-line on the separator row", () => {
    const decos = buildTableDecorations(tableDoc, 31, 31);
    expect(hasLineClass(decos, 10, "facet-table-alignment-line")).toBe(true);
    // Other table lines should NOT carry it.
    expect(hasLineClass(decos, 0, "facet-table-alignment-line")).toBe(false);
    expect(hasLineClass(decos, 20, "facet-table-alignment-line")).toBe(false);
  });

  it("emits .facet-table-header-line on the header row only", () => {
    const decos = buildTableDecorations(tableDoc, 31, 31);
    expect(hasLineClass(decos, 0, "facet-table-header-line")).toBe(true);
    expect(hasLineClass(decos, 10, "facet-table-header-line")).toBe(false);
    expect(hasLineClass(decos, 20, "facet-table-header-line")).toBe(false);
  });

  it("emits .facet-table-cell-{align} marks on each non-default-aligned cell", () => {
    // | L | C | R |\n| :- | :-: | -: |\n| 1 | 2 | 3 |\n
    const alignedDoc = Text.of(["| L | C | R |", "| :- | :-: | -: |", "| 1 | 2 | 3 |", ""]);
    // Cursor at end-of-doc. Doc length = 13+1+17+1+13+1 = 46
    const decos = buildTableDecorations(alignedDoc, 46, 46);
    const marks = collectByPredicate(
      decos,
      (_from, _to, v) =>
        typeof v.spec.class === "string" && v.spec.class.startsWith("facet-table-cell-"),
    );
    // 3 cells per row × 2 body+header rows that have content = 6 cells. (Skip the alignment row.)
    expect(marks).toHaveLength(6);
    // Header row cells at offsets 0..4 (left), 4..8 (center), 8..13 (right)
    const headerLeft = marks.find((m) => m.from === 0 && m.to === 4);
    expect(headerLeft).toBeDefined();
  });
});

function collectByPredicate(
  decorations: ReturnType<typeof buildTableDecorations>,
  predicate: (from: number, to: number, value: Decoration) => boolean,
): Array<{ from: number; to: number }> {
  const out: Array<{ from: number; to: number }> = [];
  const cur = decorations.iter();
  while (cur.value !== null) {
    if (predicate(cur.from, cur.to, cur.value)) {
      out.push({ from: cur.from, to: cur.to });
    }
    cur.next();
  }
  return out;
}
