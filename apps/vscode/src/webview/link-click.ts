import { findHeadingLineForAnchor } from "@facet/core";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { decideLinkClick } from "./decide-link-click.js";

export function linkClickHandler(post: (url: string) => void): Extension {
  // Hook mousedown — CodeMirror moves the cursor on mousedown, so by the time `click`
  // fires the selection is already inside the link and decideLinkClick would always
  // see "cursor was inside" and decline to follow.
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (event.button !== 0) return false;
      const target = event.target;
      if (!(target instanceof Element)) return false;
      if (!target.closest(".facet-link")) return false;

      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return false;

      const sel = view.state.selection.main;
      const decision = decideLinkClick(view.state.doc.toString(), pos, sel.from, sel.to);
      if (!decision.follow) return false;

      event.preventDefault();

      // Same-file anchor: scroll within this view rather than round-tripping through
      // the extension, which would open a duplicate tab in VS Code's default editor.
      if (decision.url.startsWith("#")) {
        scrollToHeading(view, decision.url.slice(1));
        return true;
      }

      post(decision.url);
      return true;
    },
  });
}

function scrollToHeading(view: EditorView, anchor: string): void {
  const line = findHeadingLineForAnchor(view.state.doc.toString(), anchor);
  if (line === null) return;
  const docLine = view.state.doc.line(line + 1);
  view.dispatch({
    selection: { anchor: docLine.from },
    effects: EditorView.scrollIntoView(docLine.from, { y: "start" }),
  });
}
