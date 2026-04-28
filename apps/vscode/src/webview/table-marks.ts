import { findTables, parse } from "@facet/core";
import { type Range, RangeSet, StateField, type Text } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";

const tableLineDeco = Decoration.line({ class: "facet-table-line" });
const headerLineDeco = Decoration.line({ class: "facet-table-header-line" });
const alignmentLineDeco = Decoration.line({ class: "facet-table-alignment-line" });
const alignmentCollapseDeco = Decoration.replace({ block: true });
const hideDeco = Decoration.replace({});
const cellAlignDecos: Record<"left" | "center" | "right", Decoration> = {
  left: Decoration.mark({ class: "facet-table-cell-left" }),
  center: Decoration.mark({ class: "facet-table-cell-center" }),
  right: Decoration.mark({ class: "facet-table-cell-right" }),
};

export function buildTableDecorations(doc: Text, selFrom: number, selTo: number): DecorationSet {
  const tables = findTables(parse(doc.toString()));
  const ranges: Range<Decoration>[] = [];

  for (const table of tables) {
    const startLine = doc.lineAt(table.start);
    const endLine = doc.lineAt(Math.max(table.start, table.end - 1));
    const cursorInTable = isCursorInTable(doc, selFrom, selTo, startLine.number, endLine.number);

    const alignmentLineNo = doc.lineAt(table.alignmentRow.start).number;
    const headerLineNo = table.rows[0] ? doc.lineAt(table.rows[0].start).number : startLine.number;
    for (let n = startLine.number; n <= endLine.number; n++) {
      const lineFrom = doc.line(n).from;
      ranges.push(tableLineDeco.range(lineFrom));
      if (n === headerLineNo) ranges.push(headerLineDeco.range(lineFrom));
      if (n === alignmentLineNo) ranges.push(alignmentLineDeco.range(lineFrom));
    }

    if (!cursorInTable) {
      pushPipeHides(doc, startLine.number, endLine.number, ranges);
      ranges.push(alignmentCollapseDeco.range(table.alignmentRow.start, table.alignmentRow.end));
    }

    pushCellAlignMarks(table, doc, ranges);
  }

  return RangeSet.of(ranges, true);
}

function isCursorInTable(
  doc: Text,
  selFrom: number,
  selTo: number,
  startLineNo: number,
  endLineNo: number,
): boolean {
  const selStart = doc.lineAt(selFrom).number;
  const selEnd = doc.lineAt(selTo).number;
  return selStart <= endLineNo && selEnd >= startLineNo;
}

function pushCellAlignMarks(
  table: ReturnType<typeof findTables>[number],
  doc: Text,
  ranges: Range<Decoration>[],
): void {
  for (const row of table.rows) {
    for (const [colIndex, cell] of row.cells.entries()) {
      const align = table.align[colIndex];
      if (!align) continue;
      let start = cell.start;
      let end = cell.end;
      // mdast cell ranges share boundaries at `|` separators, so the leading
      // pipe is part of every cell's range and the trailing pipe is part of
      // the rightmost cell's range. Trim them so text-align only governs
      // the cell content, not the divider characters.
      if (start < end && doc.sliceString(start, start + 1) === "|") start += 1;
      if (start < end && doc.sliceString(end - 1, end) === "|") end -= 1;
      if (start >= end) continue;
      ranges.push(cellAlignDecos[align].range(start, end));
    }
  }
}

function pushPipeHides(
  doc: Text,
  startLineNo: number,
  endLineNo: number,
  ranges: Range<Decoration>[],
): void {
  for (let n = startLineNo; n <= endLineNo; n++) {
    const line = doc.line(n);
    for (let i = 0; i < line.text.length; i++) {
      if (line.text[i] === "|") {
        const from = line.from + i;
        ranges.push(hideDeco.range(from, from + 1));
      }
    }
  }
}

export const tableMarksField = StateField.define<DecorationSet>({
  create(state) {
    const sel = state.selection.main;
    return buildTableDecorations(state.doc, sel.from, sel.to);
  },
  update(deco, tr) {
    if (!tr.docChanged && !tr.selection) return deco.map(tr.changes);
    const sel = tr.state.selection.main;
    return buildTableDecorations(tr.state.doc, sel.from, sel.to);
  },
  provide: (f) => EditorView.decorations.from(f),
});
