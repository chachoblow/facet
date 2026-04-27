import { findBlocks, parse } from "@facet/core";
import { type Range, RangeSet, StateField, type Text } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, code: string) => Promise<{ svg: string }>;
};

let mermaidPromise: Promise<MermaidApi> | null = null;
let renderCounter = 0;

function loadMermaid(): Promise<MermaidApi> {
  if (mermaidPromise === null) {
    mermaidPromise = import("mermaid").then((mod) => {
      const m = mod.default as MermaidApi;
      m.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });
      return m;
    });
  }
  return mermaidPromise;
}

export class MermaidWidget extends WidgetType {
  constructor(readonly code: string) {
    super();
  }
  override toDOM(): HTMLElement {
    const el = document.createElement("div");
    el.className = "facet-mermaid";
    el.textContent = "Rendering…";
    void this.render(el);
    return el;
  }
  override eq(other: MermaidWidget): boolean {
    return this.code === other.code;
  }
  private async render(el: HTMLElement): Promise<void> {
    try {
      const mermaid = await loadMermaid();
      const id = `facet-mermaid-${++renderCounter}`;
      const { svg } = await mermaid.render(id, this.code);
      el.innerHTML = svg;
    } catch (err) {
      el.classList.add("facet-mermaid-error");
      el.textContent = `Mermaid render error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
}

const FENCE_RE = /^\s*(```|~~~)/;

export function buildMermaidDecorations(doc: Text, selFrom: number, selTo: number): DecorationSet {
  const root = parse(doc.toString());
  const blocks = findBlocks(root);
  const ranges: Range<Decoration>[] = [];
  const selStartLine = doc.lineAt(selFrom).number;
  const selEndLine = doc.lineAt(selTo).number;

  for (const block of blocks) {
    if (block.type !== "code" || block.lang !== "mermaid") continue;

    const startLine = doc.lineAt(block.start);
    const endLine = doc.lineAt(Math.max(block.start, block.end - 1));
    const cursorInBlock = selStartLine <= endLine.number && selEndLine >= startLine.number;
    if (cursorInBlock) continue;

    const startLineIsFence = FENCE_RE.test(startLine.text);
    const endLineIsFence = startLine.number !== endLine.number && FENCE_RE.test(endLine.text);

    const contentStartLineNum = startLineIsFence ? startLine.number + 1 : startLine.number;
    const contentEndLineNum = endLineIsFence ? endLine.number - 1 : endLine.number;
    let code = "";
    if (contentStartLineNum <= contentEndLineNum) {
      const codeFrom = doc.line(contentStartLineNum).from;
      const codeTo = doc.line(contentEndLineNum).to;
      code = doc.sliceString(codeFrom, codeTo);
    }

    ranges.push(
      Decoration.replace({ block: true, widget: new MermaidWidget(code) }).range(
        block.start,
        block.end,
      ),
    );
  }

  return RangeSet.of(ranges, true);
}

export const mermaidMarksField = StateField.define<DecorationSet>({
  create(state) {
    const sel = state.selection.main;
    return buildMermaidDecorations(state.doc, sel.from, sel.to);
  },
  update(deco, tr) {
    if (!tr.docChanged && !tr.selection) return deco.map(tr.changes);
    const sel = tr.state.selection.main;
    return buildMermaidDecorations(tr.state.doc, sel.from, sel.to);
  },
  provide: (f) => EditorView.decorations.from(f),
});
