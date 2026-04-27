import { findImages, parse } from "@facet/core";
import { type Range, RangeSet, StateField, type Text } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";

export class ImageWidget extends WidgetType {
  constructor(
    readonly url: string,
    readonly alt: string,
    readonly title: string | null,
  ) {
    super();
  }
  override toDOM(): HTMLElement {
    const img = document.createElement("img");
    img.className = "facet-image";
    img.src = this.url;
    img.alt = this.alt;
    if (this.title !== null) img.title = this.title;
    return img;
  }
  override eq(other: ImageWidget): boolean {
    return this.url === other.url && this.alt === other.alt && this.title === other.title;
  }
}

export type ResolveUrl = (rawUrl: string) => string;

export function buildImageDecorations(
  doc: Text,
  selFrom: number,
  selTo: number,
  resolve: ResolveUrl,
): DecorationSet {
  const images = findImages(parse(doc.toString()));
  if (images.length === 0) return RangeSet.empty;

  const selStartLine = doc.lineAt(selFrom).number;
  const selEndLine = doc.lineAt(selTo).number;

  const ranges: Range<Decoration>[] = [];
  for (const image of images) {
    const startLine = doc.lineAt(image.start).number;
    const endLine = doc.lineAt(Math.max(image.start, image.end - 1)).number;
    const cursorOnImageLine = selStartLine <= endLine && selEndLine >= startLine;
    if (cursorOnImageLine) continue;
    ranges.push(
      Decoration.replace({
        widget: new ImageWidget(resolve(image.url), image.alt, image.title),
      }).range(image.start, image.end),
    );
  }
  return RangeSet.of(ranges, true);
}

export function createImageMarksField(resolve: ResolveUrl): StateField<DecorationSet> {
  return StateField.define<DecorationSet>({
    create(state) {
      const sel = state.selection.main;
      return buildImageDecorations(state.doc, sel.from, sel.to, resolve);
    },
    update(deco, tr) {
      if (!tr.docChanged && !tr.selection) return deco.map(tr.changes);
      const sel = tr.state.selection.main;
      return buildImageDecorations(tr.state.doc, sel.from, sel.to, resolve);
    },
    provide: (f) => EditorView.decorations.from(f),
  });
}
