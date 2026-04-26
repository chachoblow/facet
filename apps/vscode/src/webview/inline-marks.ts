import { findInlineMarks, parse } from "@facet/core";
import { type Range, RangeSet, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";

const hideDeco = Decoration.replace({});
const strongDeco = Decoration.mark({ class: "facet-strong" });
const emphasisDeco = Decoration.mark({ class: "facet-emphasis" });
const linkDeco = Decoration.mark({ class: "facet-link" });

function buildDecorations(doc: string, selFrom: number, selTo: number): DecorationSet {
  const root = parse(doc);
  const marks = findInlineMarks(root);
  const ranges: Range<Decoration>[] = [];

  for (const mark of marks) {
    const styleDeco =
      mark.type === "strong" ? strongDeco : mark.type === "emphasis" ? emphasisDeco : linkDeco;
    ranges.push(styleDeco.range(mark.innerStart, mark.innerEnd));

    const cursorOverlapsMark = selFrom < mark.end && selTo > mark.start;
    if (!cursorOverlapsMark) {
      ranges.push(hideDeco.range(mark.start, mark.innerStart));
      ranges.push(hideDeco.range(mark.innerEnd, mark.end));
    }
  }

  return RangeSet.of(ranges, true);
}

export const inlineMarksField = StateField.define<DecorationSet>({
  create(state) {
    const sel = state.selection.main;
    return buildDecorations(state.doc.toString(), sel.from, sel.to);
  },
  update(deco, tr) {
    if (!tr.docChanged && !tr.selection) return deco.map(tr.changes);
    const sel = tr.state.selection.main;
    return buildDecorations(tr.state.doc.toString(), sel.from, sel.to);
  },
  provide: (f) => EditorView.decorations.from(f),
});
