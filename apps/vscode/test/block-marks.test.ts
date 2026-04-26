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
