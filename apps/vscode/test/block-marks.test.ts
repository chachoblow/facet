import { describe, expect, it } from "vitest";
import { Text } from "@codemirror/state";
import { buildDecorations } from "../src/webview/block-marks.js";

// Doc: "# Hello\nnext\n"
//   line 1: "# Hello"   positions 0-6, line break at 7
//   line 2: "next"      positions 8-11, line break at 12
// The heading marker "# " spans positions 0..2.

const doc = Text.of(["# Hello", "next", ""]);

function hasMarkerHide(decorations: ReturnType<typeof buildDecorations>): boolean {
  let found = false;
  decorations.between(0, 2, (from, to) => {
    if (from === 0 && to === 2) {
      found = true;
      return false;
    }
    return undefined;
  });
  return found;
}

describe("block-marks buildDecorations", () => {
  it("keeps the heading marker visible when the cursor is inside the heading line", () => {
    const cursor = 3; // middle of "Hello"
    expect(hasMarkerHide(buildDecorations(doc, cursor, cursor))).toBe(false);
  });

  it("keeps the heading marker visible when the cursor is at the heading line's end-of-line offset", () => {
    // Off-by-one regression guard: an offset-based cursor check would treat
    // position 7 (the line separator) as outside the heading and hide it.
    // The line-based check must keep it visible.
    const cursor = 7;
    expect(hasMarkerHide(buildDecorations(doc, cursor, cursor))).toBe(false);
  });

  it("hides the heading marker when the cursor is on the next line", () => {
    const cursor = 8; // start of "next"
    expect(hasMarkerHide(buildDecorations(doc, cursor, cursor))).toBe(true);
  });
});

// Doc: "- [ ] foo\n\nnext\n"
//   line 1: "- [ ] foo"  positions 0-8, line break at 9
//   line 2: ""           position 10 (blank — separates the list from the next block)
//   line 3: "next"       positions 11-14
// The checkbox "[ ]" spans positions 2..5.
const taskDoc = Text.of(["- [ ] foo", "", "next", ""]);

function hasCheckboxWidget(
  decorations: ReturnType<typeof buildDecorations>,
  from: number,
  to: number,
): boolean {
  let found = false;
  decorations.between(from, to, (a, b, value) => {
    if (a === from && b === to && value.spec.widget?.constructor.name === "CheckboxWidget") {
      found = true;
      return false;
    }
    return undefined;
  });
  return found;
}

describe("block-marks task list checkbox widget", () => {
  it("replaces `- [ ]` with a single checkbox widget when the cursor is on another line", () => {
    // Covers `markerStart..checkboxEnd` (offsets 0..5) as one atomic range so
    // up/down arrows can't land the cursor in the hidden gap between `- ` and `[ ]`.
    const cursor = 11; // start of "next"
    expect(hasCheckboxWidget(buildDecorations(taskDoc, cursor, cursor), 0, 5)).toBe(true);
  });

  it("reveals the `- [ ]` source when the cursor is on the task item's line", () => {
    const cursor = 7; // inside "foo" on line 1
    expect(hasCheckboxWidget(buildDecorations(taskDoc, cursor, cursor), 0, 5)).toBe(false);
  });
});

// Doc: "> outer\n> > nested\n\nelsewhere\n"
//   line 1: "> outer"      offsets 0-6,  newline at 7
//   line 2: "> > nested"   offsets 8-17, newline at 18
//   line 3: ""             offset 19 (blank)
//   line 4: "elsewhere"    offsets 20-28
const nestedBqDoc = Text.of(["> outer", "> > nested", "", "elsewhere", ""]);

function collectHideRanges(
  decorations: ReturnType<typeof buildDecorations>,
): Array<{ from: number; to: number }> {
  const out: Array<{ from: number; to: number }> = [];
  const cur = decorations.iter();
  while (cur.value !== null) {
    if (cur.value.spec.widget === undefined && cur.from < cur.to) {
      out.push({ from: cur.from, to: cur.to });
    }
    cur.next();
  }
  return out;
}

describe("block-marks nested blockquotes", () => {
  it("hides one `>` per level when the cursor is off the blockquote", () => {
    // Cursor on "elsewhere" line 4, offset 20 — outside both blockquotes.
    const hides = collectHideRanges(buildDecorations(nestedBqDoc, 20, 20));
    // Outer (depth 1) hides first `> ` on line 1 [0,2) and on line 2 [8,10).
    // Inner (depth 2) hides second `> ` on line 2 [10,12).
    expect(hides).toContainEqual({ from: 0, to: 2 });
    expect(hides).toContainEqual({ from: 8, to: 10 });
    expect(hides).toContainEqual({ from: 10, to: 12 });
  });

  it("reveals only the cursor's line, keeping sibling lines in the same blockquote hidden", () => {
    // Cursor inside "nested" on line 2 — inside both outer (lines 1-2) and
    // inner (line 2). Per-line reveal means only line 2's hides drop; line 1
    // still hides its outer marker.
    const hides = collectHideRanges(buildDecorations(nestedBqDoc, 12, 12));
    expect(hides).toContainEqual({ from: 0, to: 2 });
    expect(hides.find((h) => h.from === 8 && h.to === 10)).toBeUndefined();
    expect(hides.find((h) => h.from === 10 && h.to === 12)).toBeUndefined();
  });

  it("reveals only line 1 when the cursor is on the outer-only line", () => {
    // Cursor inside "outer" on line 1. Line 1's outer marker reveals; line 2
    // (which the cursor isn't on) keeps both its outer and inner hides.
    const hides = collectHideRanges(buildDecorations(nestedBqDoc, 3, 3));
    expect(hides.find((h) => h.from === 0 && h.to === 2)).toBeUndefined();
    expect(hides).toContainEqual({ from: 8, to: 10 });
    expect(hides).toContainEqual({ from: 10, to: 12 });
  });

  it("emits a depth-encoded line class per blockquote level", () => {
    // Each level emits its own .facet-blockquote-line-N so the CSS can
    // communicate depth visually — without this the same single bar shows
    // for `> outer` and `> > nested`.
    const decorations = buildDecorations(nestedBqDoc, 20, 20);
    const classesAtLine = (offset: number): string[] => {
      const out: string[] = [];
      const cur = decorations.iter();
      while (cur.value !== null) {
        if (cur.from === offset && cur.to === offset && typeof cur.value.spec.class === "string") {
          out.push(cur.value.spec.class);
        }
        cur.next();
      }
      return out;
    };
    // Line 1 ("> outer", offset 0) is inside the outer blockquote only.
    expect(classesAtLine(0)).toContain("facet-blockquote-line-1");
    expect(classesAtLine(0)).not.toContain("facet-blockquote-line-2");
    // Line 2 ("> > nested", offset 8) is inside both outer and inner.
    expect(classesAtLine(8)).toContain("facet-blockquote-line-1");
    expect(classesAtLine(8)).toContain("facet-blockquote-line-2");
  });
});
