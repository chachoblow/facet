import { describe, expect, it } from "vitest";
import { Text } from "@codemirror/state";
import { type Decoration } from "@codemirror/view";
import { buildCodeDecorations } from "../src/webview/code-marks.js";

function collect(
  decorations: ReturnType<typeof buildCodeDecorations>,
): Array<{ from: number; to: number; value: Decoration }> {
  const out: Array<{ from: number; to: number; value: Decoration }> = [];
  const cur = decorations.iter();
  while (cur.value !== null) {
    out.push({ from: cur.from, to: cur.to, value: cur.value });
    cur.next();
  }
  return out;
}

function lineDecoClasses(decos: ReturnType<typeof buildCodeDecorations>, at: number): string[] {
  const classes: string[] = [];
  decos.between(at, at, (from, _to, value) => {
    if (from === at && value.spec.class) classes.push(value.spec.class as string);
    return undefined;
  });
  return classes;
}

function fenceCollapseAt(
  decos: ReturnType<typeof buildCodeDecorations>,
  from: number,
  to: number,
): Decoration | null {
  let found: Decoration | null = null;
  decos.between(from, to, (a, b, value) => {
    if (a === from && b === to && value.spec.block === true) {
      found = value;
      return false;
    }
    return undefined;
  });
  return found;
}

// Doc: ```javascript\nconst x = 1;\n```\nnext\n
//   line 1: "```javascript"  offsets 0..13,  \n at 13
//   line 2: "const x = 1;"   offsets 14..26, \n at 26
//   line 3: "```"             offsets 27..30, \n at 30
//   line 4: "next"            offsets 31..35
const fencedDoc = Text.of(["```javascript", "const x = 1;", "```", "next", ""]);

describe("code-marks buildCodeDecorations — fenced with lang", () => {
  it("collapses both fences and emits line classes when the cursor is outside the block", () => {
    const decos = buildCodeDecorations(fencedDoc, 31, 31, null, "github-dark");

    expect(lineDecoClasses(decos, 0)).toContain("facet-code-fence-line");
    expect(lineDecoClasses(decos, 14)).toContain("facet-code-line");
    expect(lineDecoClasses(decos, 27)).toContain("facet-code-fence-line");

    const opening = fenceCollapseAt(decos, 0, 13);
    expect(opening).not.toBeNull();
    expect(opening?.spec.widget?.constructor.name).toBe("LangBadgeWidget");

    const closing = fenceCollapseAt(decos, 27, 30);
    expect(closing).not.toBeNull();
    expect(closing?.spec.widget).toBeUndefined();
  });

  it("does not collapse fences when the cursor is on the opening fence", () => {
    const decos = buildCodeDecorations(fencedDoc, 0, 0, null, "github-dark");
    expect(fenceCollapseAt(decos, 0, 13)).toBeNull();
    expect(fenceCollapseAt(decos, 27, 30)).toBeNull();
    // Line classes still present.
    expect(lineDecoClasses(decos, 0)).toContain("facet-code-fence-line");
    expect(lineDecoClasses(decos, 14)).toContain("facet-code-line");
  });

  it("does not collapse fences when the cursor is on a content line", () => {
    const decos = buildCodeDecorations(fencedDoc, 14, 14, null, "github-dark");
    expect(fenceCollapseAt(decos, 0, 13)).toBeNull();
    expect(fenceCollapseAt(decos, 27, 30)).toBeNull();
  });

  it("does not collapse fences when the cursor is on the closing fence", () => {
    const decos = buildCodeDecorations(fencedDoc, 27, 27, null, "github-dark");
    expect(fenceCollapseAt(decos, 0, 13)).toBeNull();
    expect(fenceCollapseAt(decos, 27, 30)).toBeNull();
  });
});

// Doc: ```\nfoo\n```\n
//   line 1: "```"  offsets 0..3,  \n at 3
//   line 2: "foo"  offsets 4..7,  \n at 7
//   line 3: "```"  offsets 8..11, \n at 11
//   line 4: ""     offset 12
const fencedNoLangDoc = Text.of(["```", "foo", "```", ""]);

describe("code-marks buildCodeDecorations — fenced without lang", () => {
  it("collapses the opening fence with no widget when there is no lang", () => {
    const decos = buildCodeDecorations(fencedNoLangDoc, 12, 12, null, "github-dark");
    const opening = fenceCollapseAt(decos, 0, 3);
    expect(opening).not.toBeNull();
    expect(opening?.spec.widget).toBeUndefined();

    const closing = fenceCollapseAt(decos, 8, 11);
    expect(closing).not.toBeNull();
  });
});

// Doc: "    foo\n    bar\n"
//   Indented (4-space) code block — no fences.
//   line 1: "    foo"  offsets 0..7
//   line 2: "    bar"  offsets 8..15
//   line 3: ""         offset 16
const indentedDoc = Text.of(["    foo", "    bar", ""]);

describe("code-marks buildCodeDecorations — indented code block", () => {
  it("emits content line classes and never collapses anything", () => {
    const decos = buildCodeDecorations(indentedDoc, 16, 16, null, "github-dark");
    expect(lineDecoClasses(decos, 0)).toContain("facet-code-line");
    expect(lineDecoClasses(decos, 8)).toContain("facet-code-line");
    // No facet-code-fence-line on either content line.
    expect(lineDecoClasses(decos, 0)).not.toContain("facet-code-fence-line");
    expect(lineDecoClasses(decos, 8)).not.toContain("facet-code-fence-line");

    // No block replace anywhere in the doc.
    const all = collect(decos);
    const blocks = all.filter((d) => d.value.spec.block === true);
    expect(blocks).toHaveLength(0);
  });
});

describe("code-marks buildCodeDecorations — no code blocks", () => {
  it("emits no decorations for a plain prose doc", () => {
    const doc = Text.of(["# Heading", "Some text.", ""]);
    expect(buildCodeDecorations(doc, 0, 0, null, "github-dark").size).toBe(0);
  });
});

// Doc: ```mermaid\ngraph TD\nA-->B\n```\nafter\n
//   line 1: "```mermaid"  offsets 0..10,  \n at 10
//   line 2: "graph TD"    offsets 11..19, \n at 19
//   line 3: "A-->B"       offsets 20..25, \n at 25
//   line 4: "```"         offsets 26..29, \n at 29
//   line 5: "after"       offsets 30..35
const mermaidDoc = Text.of(["```mermaid", "graph TD", "A-->B", "```", "after", ""]);

describe("code-marks buildCodeDecorations — theme propagation", () => {
  it("forwards the theme argument to the highlighter", () => {
    const calls: { lang: string; theme: string }[] = [];
    const fakeHl = {
      codeToTokensBase(_code: string, opts: { lang: string; theme: string }) {
        calls.push({ lang: opts.lang, theme: opts.theme });
        return [];
      },
    };
    buildCodeDecorations(fencedDoc, 31, 31, fakeHl as never, "github-light");
    expect(calls).toEqual([{ lang: "javascript", theme: "github-light" }]);
  });
});

describe("code-marks buildCodeDecorations — mermaid blocks", () => {
  it("emits line classes but no fence collapse for a mermaid block (cursor off)", () => {
    const decos = buildCodeDecorations(mermaidDoc, 30, 30, null, "github-dark");
    // Line classes still present so source-mode styling matches other code blocks.
    expect(lineDecoClasses(decos, 0)).toContain("facet-code-fence-line");
    expect(lineDecoClasses(decos, 11)).toContain("facet-code-line");
    expect(lineDecoClasses(decos, 20)).toContain("facet-code-line");
    expect(lineDecoClasses(decos, 26)).toContain("facet-code-fence-line");
    // No fence collapse — mermaid-marks owns cursor-off rendering.
    expect(fenceCollapseAt(decos, 0, 10)).toBeNull();
    expect(fenceCollapseAt(decos, 26, 29)).toBeNull();
  });
});
