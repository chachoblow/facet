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
