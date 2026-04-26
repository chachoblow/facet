import { findFrontmatter, parse } from "@facet/core";
import { type Range, RangeSet, StateField, type Text } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";

class FrontmatterWidget extends WidgetType {
  constructor(private readonly innerStart: number) {
    super();
  }
  override toDOM(view: EditorView): HTMLElement {
    const el = document.createElement("span");
    el.className = "facet-frontmatter-widget";
    el.textContent = "⌃ Frontmatter";
    el.addEventListener("click", () => {
      view.dispatch({ selection: { anchor: this.innerStart } });
      view.focus();
    });
    return el;
  }
  override eq(other: FrontmatterWidget): boolean {
    return this.innerStart === other.innerStart;
  }
}

export function buildFrontmatterDecorations(
  doc: Text,
  selFrom: number,
  selTo: number,
): DecorationSet {
  const fm = findFrontmatter(parse(doc.toString()));
  if (!fm) return RangeSet.empty;

  const startLine = doc.lineAt(fm.start);
  const endLine = doc.lineAt(Math.max(fm.start, fm.end - 1));
  const selStartLine = doc.lineAt(selFrom).number;
  const selEndLine = doc.lineAt(selTo).number;
  const cursorInFrontmatter = selStartLine <= endLine.number && selEndLine >= startLine.number;

  const ranges: Range<Decoration>[] = [];
  if (!cursorInFrontmatter) {
    // Land cursor just after the opening `---\n` so the reveal naturally triggers.
    const innerStart = Math.min(fm.end, startLine.from + startLine.length + 1);
    ranges.push(
      Decoration.replace({ widget: new FrontmatterWidget(innerStart) }).range(fm.start, fm.end),
    );
  }
  return RangeSet.of(ranges, true);
}

export const frontmatterMarksField = StateField.define<DecorationSet>({
  create(state) {
    const sel = state.selection.main;
    return buildFrontmatterDecorations(state.doc, sel.from, sel.to);
  },
  update(deco, tr) {
    if (!tr.docChanged && !tr.selection) return deco.map(tr.changes);
    const sel = tr.state.selection.main;
    return buildFrontmatterDecorations(tr.state.doc, sel.from, sel.to);
  },
  provide: (f) => [
    EditorView.decorations.from(f),
    // Treat the collapsed widget as a single atomic unit so arrow keys jump
    // over it instead of landing at unpredictable offsets inside the replaced
    // range (CM's pixel-x goal-column logic falls apart over a multi-line
    // replace). Click still places the cursor inside the frontmatter to edit.
    EditorView.atomicRanges.of((view) => view.state.field(f)),
  ],
});
