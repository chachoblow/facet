import { Range } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

const hide = Decoration.replace({});
const bold = Decoration.mark({ class: "cm-bold" });
const italic = Decoration.mark({ class: "cm-italic" });
const link = Decoration.mark({ class: "cm-link" });
const heading = (level: number) =>
  Decoration.mark({ class: `cm-heading cm-heading-${level}` });

type Built = { all: DecorationSet; atomic: DecorationSet };

function buildDecorations(view: EditorView): Built {
  const all: Range<Decoration>[] = [];
  const atomic: Range<Decoration>[] = [];
  const sel = view.state.selection.main;

  const pushHide = (from: number, to: number) => {
    if (from === to) return;
    const r = hide.range(from, to);
    all.push(r);
    atomic.push(r);
  };

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        const cursorInside = sel.from <= node.to && sel.to >= node.from;

        if (node.name === "StrongEmphasis" || node.name === "Emphasis") {
          all.push(
            (node.name === "StrongEmphasis" ? bold : italic).range(
              node.from,
              node.to,
            ),
          );
          if (!cursorInside) {
            const child = node.node.cursor();
            if (child.firstChild()) {
              do {
                if (child.name === "EmphasisMark") {
                  pushHide(child.from, child.to);
                }
              } while (child.nextSibling());
            }
          }
          return;
        }

        const m = /^ATXHeading(\d)$/.exec(node.name);
        if (m) {
          const level = Number(m[1]);
          all.push(heading(level).range(node.from, node.to));
          if (!cursorInside) {
            const child = node.node.cursor();
            if (child.firstChild()) {
              do {
                if (child.name === "HeaderMark") {
                  // Hide the # and trailing space (if any) so the rendered
                  // heading isn't preceded by a stray space.
                  const trailing =
                    view.state.sliceDoc(child.to, child.to + 1) === " "
                      ? child.to + 1
                      : child.to;
                  pushHide(child.from, trailing);
                }
              } while (child.nextSibling());
            }
          }
          return;
        }

        if (node.name === "Link") {
          all.push(link.range(node.from, node.to));
          if (!cursorInside) {
            const child = node.node.cursor();
            if (child.firstChild()) {
              do {
                if (child.name === "LinkMark" || child.name === "URL") {
                  pushHide(child.from, child.to);
                }
              } while (child.nextSibling());
            }
          }
          return;
        }
      },
    });
  }

  return {
    all: Decoration.set(all, true),
    atomic: Decoration.set(atomic, true),
  };
}

export function livePreview() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      atomic: DecorationSet;
      constructor(view: EditorView) {
        const built = buildDecorations(view);
        this.decorations = built.all;
        this.atomic = built.atomic;
      }
      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet
        ) {
          const built = buildDecorations(update.view);
          this.decorations = built.all;
          this.atomic = built.atomic;
        }
      }
    },
    {
      decorations: (v) => v.decorations,
      provide: (plugin) =>
        EditorView.atomicRanges.of(
          (view) => view.plugin(plugin)?.atomic ?? Decoration.none,
        ),
    },
  );
}
