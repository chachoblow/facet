import { findBlocks, parse } from "@facet/core";
import { type Range, RangeSet, StateField, type Text } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";
import githubDark from "@shikijs/themes/github-dark";
import bash from "@shikijs/langs/bash";
import css from "@shikijs/langs/css";
import go from "@shikijs/langs/go";
import html from "@shikijs/langs/html";
import javascript from "@shikijs/langs/javascript";
import json from "@shikijs/langs/json";
import markdown from "@shikijs/langs/markdown";
import python from "@shikijs/langs/python";
import rust from "@shikijs/langs/rust";
import tsx from "@shikijs/langs/tsx";
import typescript from "@shikijs/langs/typescript";
import yaml from "@shikijs/langs/yaml";

const THEME = "github-dark";

let highlighterInstance: HighlighterCore | null = null;

export const highlighterReady: Promise<void> = createHighlighterCore({
  themes: [githubDark],
  langs: [bash, css, go, html, javascript, json, markdown, python, rust, tsx, typescript, yaml],
  engine: createJavaScriptRegexEngine(),
}).then((h) => {
  highlighterInstance = h;
});

export function getHighlighter(): HighlighterCore | null {
  return highlighterInstance;
}

class LangBadgeWidget extends WidgetType {
  constructor(private readonly lang: string) {
    super();
  }
  override toDOM(): HTMLElement {
    const el = document.createElement("div");
    el.className = "facet-code-lang-badge";
    el.textContent = this.lang;
    return el;
  }
  override eq(other: LangBadgeWidget): boolean {
    return this.lang === other.lang;
  }
}

const codeLineDeco = Decoration.line({ class: "facet-code-line" });
const codeFenceLineDeco = Decoration.line({ class: "facet-code-fence-line" });
const fenceCollapseDeco = Decoration.replace({ block: true });

function isFenceLineText(text: string): boolean {
  return /^\s*(```|~~~)/.test(text);
}

export function buildCodeDecorations(
  doc: Text,
  selFrom: number,
  selTo: number,
  hl: HighlighterCore | null,
): DecorationSet {
  const root = parse(doc.toString());
  const blocks = findBlocks(root);
  const ranges: Range<Decoration>[] = [];

  for (const block of blocks) {
    if (block.type !== "code") continue;

    const startLine = doc.lineAt(block.start);
    const endLine = doc.lineAt(Math.max(block.start, block.end - 1));
    const selStartLine = doc.lineAt(selFrom).number;
    const selEndLine = doc.lineAt(selTo).number;
    const cursorInBlock = selStartLine <= endLine.number && selEndLine >= startLine.number;

    const startLineIsFence = isFenceLineText(startLine.text);
    const endLineIsFence = startLine.number !== endLine.number && isFenceLineText(endLine.text);

    for (let n = startLine.number; n <= endLine.number; n++) {
      const line = doc.line(n);
      const isFence =
        (n === startLine.number && startLineIsFence) || (n === endLine.number && endLineIsFence);
      ranges.push((isFence ? codeFenceLineDeco : codeLineDeco).range(line.from));
    }

    if (!cursorInBlock) {
      if (startLineIsFence) {
        const spec = block.lang
          ? { block: true, widget: new LangBadgeWidget(block.lang) }
          : { block: true };
        ranges.push(Decoration.replace(spec).range(startLine.from, startLine.to));
      }
      if (endLineIsFence) {
        ranges.push(fenceCollapseDeco.range(endLine.from, endLine.to));
      }
    }

    if (hl && block.lang && startLineIsFence) {
      const contentStartLineNum = startLine.number + 1;
      const contentEndLineNum = endLineIsFence ? endLine.number - 1 : endLine.number;
      if (contentStartLineNum <= contentEndLineNum) {
        const codeFrom = doc.line(contentStartLineNum).from;
        const codeTo = doc.line(contentEndLineNum).to;
        const code = doc.sliceString(codeFrom, codeTo);
        let tokenLines: { content: string; color?: string }[][] | null = null;
        try {
          tokenLines = hl.codeToTokensBase(code, { lang: block.lang, theme: THEME });
        } catch {
          tokenLines = null;
        }
        if (tokenLines) {
          for (let i = 0; i < tokenLines.length; i++) {
            const lineNum = contentStartLineNum + i;
            if (lineNum > contentEndLineNum) break;
            const line = doc.line(lineNum);
            let col = 0;
            for (const tok of tokenLines[i]) {
              if (tok.color && tok.content.length > 0) {
                const from = line.from + col;
                const to = from + tok.content.length;
                ranges.push(
                  Decoration.mark({
                    attributes: { style: `color: ${tok.color}` },
                  }).range(from, to),
                );
              }
              col += tok.content.length;
            }
          }
        }
      }
    }
  }

  return RangeSet.of(ranges, true);
}

export const codeMarksField = StateField.define<DecorationSet>({
  create(state) {
    const sel = state.selection.main;
    return buildCodeDecorations(state.doc, sel.from, sel.to, highlighterInstance);
  },
  update(deco, tr) {
    if (!tr.docChanged && !tr.selection) return deco.map(tr.changes);
    const sel = tr.state.selection.main;
    return buildCodeDecorations(tr.state.doc, sel.from, sel.to, highlighterInstance);
  },
  provide: (f) => EditorView.decorations.from(f),
});
