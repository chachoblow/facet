import { describe, expect, it } from "vitest";
import { Text } from "@codemirror/state";
import { type Decoration } from "@codemirror/view";
import { MermaidWidget, buildMermaidDecorations } from "../src/webview/mermaid-marks.js";

function collect(
  decorations: ReturnType<typeof buildMermaidDecorations>,
): Array<{ from: number; to: number; value: Decoration }> {
  const out: Array<{ from: number; to: number; value: Decoration }> = [];
  const cur = decorations.iter();
  while (cur.value !== null) {
    out.push({ from: cur.from, to: cur.to, value: cur.value });
    cur.next();
  }
  return out;
}

// Doc: ```mermaid\ngraph TD\nA-->B\n```\nafter\n
//   line 1: "```mermaid"  offsets 0..10,  \n at 10
//   line 2: "graph TD"    offsets 11..19, \n at 19
//   line 3: "A-->B"       offsets 20..25, \n at 25
//   line 4: "```"         offsets 26..29, \n at 29
//   line 5: "after"       offsets 30..35, \n at 35
//   line 6: ""            offset 36
const mermaidDoc = Text.of(["```mermaid", "graph TD", "A-->B", "```", "after", ""]);

describe("mermaid-marks buildMermaidDecorations", () => {
  it("emits no decorations for a doc with no code blocks", () => {
    const doc = Text.of(["# heading", "plain prose", ""]);
    expect(buildMermaidDecorations(doc, 0, 0, "dark").size).toBe(0);
  });

  it("emits no decorations for a non-mermaid fenced code block", () => {
    // Doc: ```ts\nconst x = 1;\n```\n
    const doc = Text.of(["```ts", "const x = 1;", "```", ""]);
    // Cursor on a different line (line 4, the trailing empty line).
    expect(buildMermaidDecorations(doc, doc.length, doc.length, "dark").size).toBe(0);
  });

  it("collapses the whole mermaid block into a single MermaidWidget when cursor is off the block", () => {
    // Cursor on line 5 ("after") — well outside the block.
    const decos = buildMermaidDecorations(mermaidDoc, 30, 30, "dark");
    const all = collect(decos);
    expect(all).toHaveLength(1);
    const replace = all[0];
    expect(replace.from).toBe(0);
    expect(replace.to).toBe(29);
    expect(replace.value.spec.block).toBe(true);
    const widget = replace.value.spec.widget as MermaidWidget;
    expect(widget).toBeInstanceOf(MermaidWidget);
    expect(widget.code).toBe("graph TD\nA-->B");
  });

  it("forwards the theme argument into the MermaidWidget", () => {
    const decos = buildMermaidDecorations(mermaidDoc, 30, 30, "default");
    const all = collect(decos);
    const widget = all[0].value.spec.widget as MermaidWidget;
    expect(widget.theme).toBe("default");
  });

  it("reveals source when the cursor is on the opening fence line", () => {
    // Cursor at offset 5 — middle of "```mermaid".
    const decos = buildMermaidDecorations(mermaidDoc, 5, 5, "dark");
    expect(decos.size).toBe(0);
  });

  it("reveals source when the cursor is on a content line", () => {
    // Cursor at offset 22 — middle of "A-->B" on line 3.
    expect(buildMermaidDecorations(mermaidDoc, 22, 22, "dark").size).toBe(0);
  });

  it("reveals source when the cursor is on the closing fence line", () => {
    // Cursor at offset 27 — middle of the closing "```" on line 4.
    expect(buildMermaidDecorations(mermaidDoc, 27, 27, "dark").size).toBe(0);
  });

  it("toggles two mermaid blocks independently based on cursor line", () => {
    // Doc:
    //   line 1: "```mermaid"  offsets 0..10,  \n at 10
    //   line 2: "A-->B"        offsets 11..16, \n at 16
    //   line 3: "```"          offsets 17..20, \n at 20
    //   line 4: "between"      offsets 21..28, \n at 28
    //   line 5: "```mermaid"   offsets 29..39, \n at 39
    //   line 6: "C-->D"         offsets 40..45, \n at 45
    //   line 7: "```"           offsets 46..49, \n at 49
    //   line 8: ""              offset 50
    const doc = Text.of([
      "```mermaid",
      "A-->B",
      "```",
      "between",
      "```mermaid",
      "C-->D",
      "```",
      "",
    ]);

    // Cursor on line 2 ("A-->B", first block) — first block revealed, second collapsed.
    const decosTop = buildMermaidDecorations(doc, 12, 12, "dark");
    const top = collect(decosTop);
    expect(top).toHaveLength(1);
    expect(top[0].from).toBe(29);
    expect(top[0].to).toBe(49);
    expect((top[0].value.spec.widget as MermaidWidget).code).toBe("C-->D");

    // Cursor on line 6 ("C-->D", second block) — second revealed, first collapsed.
    const decosBot = buildMermaidDecorations(doc, 41, 41, "dark");
    const bot = collect(decosBot);
    expect(bot).toHaveLength(1);
    expect(bot[0].from).toBe(0);
    expect(bot[0].to).toBe(20);
    expect((bot[0].value.spec.widget as MermaidWidget).code).toBe("A-->B");

    // Cursor on line 4 ("between") — both collapsed.
    const decosMid = buildMermaidDecorations(doc, 22, 22, "dark");
    const mid = collect(decosMid);
    expect(mid).toHaveLength(2);
  });
});

describe("MermaidWidget", () => {
  it("eq() returns true for widgets with identical code and theme", () => {
    const a = new MermaidWidget("graph TD\nA-->B", "dark");
    const b = new MermaidWidget("graph TD\nA-->B", "dark");
    expect(a.eq(b)).toBe(true);
  });

  it("eq() returns false for widgets with different code", () => {
    const a = new MermaidWidget("graph TD\nA-->B", "dark");
    const b = new MermaidWidget("graph TD\nA-->C", "dark");
    expect(a.eq(b)).toBe(false);
  });

  it("eq() returns false for widgets with the same code but different theme", () => {
    const a = new MermaidWidget("graph TD\nA-->B", "dark");
    const b = new MermaidWidget("graph TD\nA-->B", "default");
    expect(a.eq(b)).toBe(false);
  });
});
