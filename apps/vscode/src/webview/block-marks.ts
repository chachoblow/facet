import { findBlocks, parse } from "@facet/core";
import { type Range, RangeSet, StateField, type Text } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { buildToggleEdit } from "./task-toggle.js";

const hideDeco = Decoration.replace({});

class BulletWidget extends WidgetType {
  override toDOM(): HTMLElement {
    const el = document.createElement("span");
    el.className = "facet-bullet";
    el.textContent = "• ";
    return el;
  }
  override eq(): boolean {
    return true;
  }
}
const bulletDeco = Decoration.replace({ widget: new BulletWidget() });

class CheckboxWidget extends WidgetType {
  constructor(
    private readonly checked: boolean,
    private readonly checkboxStart: number,
    private readonly checkboxEnd: number,
  ) {
    super();
  }
  override toDOM(view: EditorView): HTMLElement {
    const el = document.createElement("input");
    el.type = "checkbox";
    el.checked = this.checked;
    el.className = "facet-task-checkbox";
    el.addEventListener("click", () => {
      const edit = buildToggleEdit({
        checked: this.checked,
        checkboxStart: this.checkboxStart,
        checkboxEnd: this.checkboxEnd,
      });
      view.dispatch({ changes: { from: edit.from, to: edit.to, insert: edit.insert } });
    });
    return el;
  }
  override eq(other: CheckboxWidget): boolean {
    return (
      this.checked === other.checked &&
      this.checkboxStart === other.checkboxStart &&
      this.checkboxEnd === other.checkboxEnd
    );
  }
}

const headingLineDecos = [1, 2, 3, 4, 5, 6].map((d) =>
  Decoration.line({ class: `facet-heading-line-${d}` }),
);
const blockquoteLineDeco = Decoration.line({ class: "facet-blockquote-line" });
const listLineDeco = Decoration.line({ class: "facet-list-line" });
const codeLineDeco = Decoration.line({ class: "facet-code-line" });
const codeFenceLineDeco = Decoration.line({ class: "facet-code-fence-line" });

export function buildDecorations(doc: Text, selFrom: number, selTo: number): DecorationSet {
  const root = parse(doc.toString());
  const blocks = findBlocks(root);
  const ranges: Range<Decoration>[] = [];

  for (const block of blocks) {
    const startLine = doc.lineAt(block.start);
    const endLine = doc.lineAt(Math.max(block.start, block.end - 1));
    const selStartLine = doc.lineAt(selFrom).number;
    const selEndLine = doc.lineAt(selTo).number;
    const cursorInBlock = selStartLine <= endLine.number && selEndLine >= startLine.number;

    if (block.type === "heading") {
      const lineDeco = headingLineDecos[block.depth - 1];
      if (lineDeco) ranges.push(lineDeco.range(startLine.from));
      if (!cursorInBlock && block.markerStart < block.markerEnd) {
        ranges.push(hideDeco.range(block.markerStart, block.markerEnd));
      }
    } else if (block.type === "blockquote") {
      for (let n = startLine.number; n <= endLine.number; n++) {
        const line = doc.line(n);
        ranges.push(blockquoteLineDeco.range(line.from));
        if (!cursorInBlock) {
          const match = /^(\s*)(>+\s?)/.exec(line.text);
          if (match) {
            const prefixOffset = match[1].length;
            const prefixLen = match[2].length;
            const from = line.from + prefixOffset;
            ranges.push(hideDeco.range(from, from + prefixLen));
          }
        }
      }
    } else if (block.type === "listItem") {
      for (let n = startLine.number; n <= endLine.number; n++) {
        ranges.push(listLineDeco.range(doc.line(n).from));
      }
      if (!cursorInBlock) {
        if (block.checked !== null && block.checkboxStart !== null && block.checkboxEnd !== null) {
          // For unordered tasks, swallow the hidden `- ` into the same atomic
          // range as the widget — otherwise the cursor can land at the boundary
          // between the hide and the widget when arrowing up/down.
          const replaceFrom = block.ordered ? block.checkboxStart : block.markerStart;
          ranges.push(
            Decoration.replace({
              widget: new CheckboxWidget(block.checked, block.checkboxStart, block.checkboxEnd),
            }).range(replaceFrom, block.checkboxEnd),
          );
        } else if (!block.ordered && block.markerStart < block.markerEnd) {
          ranges.push(bulletDeco.range(block.markerStart, block.markerEnd));
        }
      }
    } else if (block.type === "code") {
      for (let n = startLine.number; n <= endLine.number; n++) {
        const line = doc.line(n);
        const isFence = /^\s*(```|~~~)/.test(line.text);
        ranges.push((isFence ? codeFenceLineDeco : codeLineDeco).range(line.from));
      }
    }
  }

  return RangeSet.of(ranges, true);
}

export const blockMarksField = StateField.define<DecorationSet>({
  create(state) {
    const sel = state.selection.main;
    return buildDecorations(state.doc, sel.from, sel.to);
  },
  update(deco, tr) {
    if (!tr.docChanged && !tr.selection) return deco.map(tr.changes);
    const sel = tr.state.selection.main;
    return buildDecorations(tr.state.doc, sel.from, sel.to);
  },
  provide: (f) => EditorView.decorations.from(f),
});
