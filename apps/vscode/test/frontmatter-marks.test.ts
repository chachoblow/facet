import { describe, expect, it } from "vitest";
import { Text } from "@codemirror/state";
import { type Decoration } from "@codemirror/view";
import { buildFrontmatterDecorations } from "../src/webview/frontmatter-marks.js";

// Frontmatter doc shared across tests:
// 0    5    10   15   20  24
// 0123456789012345678901234567
// ---\nfoo: bar\n---\n# Heading\n
//                 ^^^ closing fence ends at offset 16; "# Heading" starts at 17
const fmDoc = Text.of(["---", "foo: bar", "---", "# Heading", ""]);

function collectByPredicate(
  decorations: ReturnType<typeof buildFrontmatterDecorations>,
  predicate: (from: number, to: number, value: Decoration) => boolean,
): Array<{ from: number; to: number; value: Decoration }> {
  const out: Array<{ from: number; to: number; value: Decoration }> = [];
  const cur = decorations.iter();
  while (cur.value !== null) {
    if (predicate(cur.from, cur.to, cur.value)) {
      out.push({ from: cur.from, to: cur.to, value: cur.value });
    }
    cur.next();
  }
  return out;
}

describe("frontmatter-marks buildFrontmatterDecorations", () => {
  it("emits no decorations for a doc with no frontmatter", () => {
    const doc = Text.of(["# Just a heading", ""]);
    expect(buildFrontmatterDecorations(doc, 0, 0).size).toBe(0);
  });

  it("replaces the full frontmatter range with a single widget when the cursor is on a body line", () => {
    // Cursor at offset 17 — start of "# Heading" line (line 4).
    const decos = buildFrontmatterDecorations(fmDoc, 17, 17);
    const widgets = collectByPredicate(decos, (_from, _to, v) => v.spec.widget !== undefined);
    expect(widgets).toHaveLength(1);
    expect(widgets[0]).toMatchObject({ from: 0, to: 16 });
  });

  it("emits the widget as a block-level replace so the multi-line range collapses vertical space", () => {
    // Cursor on body line — widget should be visible and block-level.
    const decos = buildFrontmatterDecorations(fmDoc, 17, 17);
    const widgets = collectByPredicate(decos, (_from, _to, v) => v.spec.widget !== undefined);
    expect(widgets).toHaveLength(1);
    expect(widgets[0].value.spec.block).toBe(true);
  });

  it("reveals the frontmatter source when the cursor is on the opening fence line", () => {
    // Cursor at offset 0 — opening `---` line.
    const decos = buildFrontmatterDecorations(fmDoc, 0, 0);
    expect(decos.size).toBe(0);
  });

  it("reveals the frontmatter source when the cursor is on a YAML body line", () => {
    // Cursor at offset 6 — middle of "foo: bar" line.
    const decos = buildFrontmatterDecorations(fmDoc, 6, 6);
    expect(decos.size).toBe(0);
  });

  it("reveals the frontmatter source when the cursor is on the closing fence line", () => {
    // Cursor at offset 14 — start of closing `---` line.
    const decos = buildFrontmatterDecorations(fmDoc, 14, 14);
    expect(decos.size).toBe(0);
  });
});
