import { describe, expect, it } from "vitest";
import { Text } from "@codemirror/state";
import { type Decoration } from "@codemirror/view";
import { ImageWidget, buildImageDecorations } from "../src/webview/image-marks.js";

const identity = (url: string): string => url;

function collectByPredicate(
  decorations: ReturnType<typeof buildImageDecorations>,
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

const widgetPredicate = (_from: number, _to: number, v: Decoration) => v.spec.widget !== undefined;

describe("image-marks buildImageDecorations", () => {
  it("emits no decorations for a doc with no images", () => {
    const doc = Text.of(["plain text", ""]);
    expect(buildImageDecorations(doc, 0, 0, identity).size).toBe(0);
  });

  it("replaces a basic image with a widget when the cursor is on a different line", () => {
    // Line 1: "intro" (0..5)         \n at 5
    // Line 2: "![alt](u)" (6..15)    \n at 15
    // Line 3: "outro" (16..21)
    const doc = Text.of(["intro", "![alt](u)", "outro", ""]);

    // Cursor on line 1 — image hidden by widget.
    const decosAbove = buildImageDecorations(doc, 0, 0, identity);
    const widgetsAbove = collectByPredicate(decosAbove, widgetPredicate);
    expect(widgetsAbove).toHaveLength(1);
    expect(widgetsAbove[0]).toMatchObject({ from: 6, to: 15 });

    // Cursor on line 3 — image still hidden.
    const decosBelow = buildImageDecorations(doc, 18, 18, identity);
    const widgetsBelow = collectByPredicate(decosBelow, widgetPredicate);
    expect(widgetsBelow).toHaveLength(1);
    expect(widgetsBelow[0]).toMatchObject({ from: 6, to: 15 });
  });

  it("reveals image source when the cursor is on the image's line", () => {
    const doc = Text.of(["intro", "![alt](u)", "outro", ""]);
    // Cursor at offset 10 — middle of the image syntax on line 2.
    const decos = buildImageDecorations(doc, 10, 10, identity);
    expect(decos.size).toBe(0);
  });

  it("renders widgets independently for two images on different lines", () => {
    // Line 1: "![a](u)" (0..7)   \n at 7
    // Line 2: "![b](v)" (8..15)  \n at 15
    const doc = Text.of(["![a](u)", "![b](v)", ""]);

    // Cursor on line 1 — line 1 image revealed, line 2 image hidden.
    const decosTop = buildImageDecorations(doc, 0, 0, identity);
    const widgetsTop = collectByPredicate(decosTop, widgetPredicate);
    expect(widgetsTop).toHaveLength(1);
    expect(widgetsTop[0]).toMatchObject({ from: 8, to: 15 });

    // Cursor on line 2 — line 2 image revealed, line 1 image hidden.
    const decosBot = buildImageDecorations(doc, 9, 9, identity);
    const widgetsBot = collectByPredicate(decosBot, widgetPredicate);
    expect(widgetsBot).toHaveLength(1);
    expect(widgetsBot[0]).toMatchObject({ from: 0, to: 7 });
  });

  it("reveals both images on the same line when the cursor is on that line", () => {
    // Line 1: "a ![one](u) b ![two](v)" (0..23)  \n at 23
    // Line 2: "second" (24..30)
    const doc = Text.of(["a ![one](u) b ![two](v)", "second", ""]);

    // Cursor on line 1 — both images revealed.
    const decosOnLine = buildImageDecorations(doc, 5, 5, identity);
    expect(decosOnLine.size).toBe(0);

    // Cursor on line 2 — both images get widgets.
    const decosOff = buildImageDecorations(doc, 24, 24, identity);
    const widgets = collectByPredicate(decosOff, widgetPredicate);
    expect(widgets).toHaveLength(2);
    expect(widgets[0]).toMatchObject({ from: 2, to: 11 });
    expect(widgets[1]).toMatchObject({ from: 14, to: 23 });
  });

  it("decorates an image inside a heading without touching the heading marker", () => {
    // Line 1: "# Plain" (0..7)              \n at 7
    // Line 2: "# Look ![pic](u)" (8..24)    \n at 24
    const doc = Text.of(["# Plain", "# Look ![pic](u)", ""]);

    const decos = buildImageDecorations(doc, 0, 0, identity);
    const widgets = collectByPredicate(decos, widgetPredicate);
    expect(widgets).toHaveLength(1);
    expect(widgets[0]).toMatchObject({ from: 15, to: 24 });
  });

  it("decorates an image inside a list item", () => {
    // Line 1: "- ![alt](u)" (0..11)  \n at 11
    // Line 2: "- text" (12..18)
    const doc = Text.of(["- ![alt](u)", "- text", ""]);

    const decos = buildImageDecorations(doc, 12, 12, identity);
    const widgets = collectByPredicate(decos, widgetPredicate);
    expect(widgets).toHaveLength(1);
    expect(widgets[0]).toMatchObject({ from: 2, to: 11 });
  });

  it("passes the raw url through the resolver and surfaces the resolved url on the widget", () => {
    // Line 1: "intro" (0..5), Line 2: "![alt](logo.png)" (6..22), Line 3: ""
    const doc = Text.of(["intro", "![alt](logo.png)", ""]);
    const calls: string[] = [];
    const resolve = (url: string): string => {
      calls.push(url);
      return `resolved://${url}`;
    };

    const decos = buildImageDecorations(doc, 0, 0, resolve);
    const widgets = collectByPredicate(decos, widgetPredicate);
    expect(widgets).toHaveLength(1);
    expect(calls).toEqual(["logo.png"]);

    const widget = widgets[0]?.value.spec.widget as ImageWidget;
    expect(widget).toBeInstanceOf(ImageWidget);
    expect(widget.url).toBe("resolved://logo.png");
    expect(widget.alt).toBe("alt");
    expect(widget.title).toBeNull();
  });

  it("propagates the title through to the widget when present", () => {
    // Line 1: "p" (0..1), Line 2: '![a](u "Hello")' (2..17)
    const doc = Text.of(["p", '![a](u "Hello")', ""]);
    const decos = buildImageDecorations(doc, 0, 0, identity);
    const widgets = collectByPredicate(decos, widgetPredicate);
    expect(widgets).toHaveLength(1);
    const widget = widgets[0]?.value.spec.widget as ImageWidget;
    expect(widget.title).toBe("Hello");
  });
});
