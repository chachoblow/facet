import { EditorState } from "@codemirror/state";
import { EditorView, drawSelection, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { livePreview } from "./livepreview";
import "./styles.css";

const sample = `# Hybrid live-preview

A paragraph with **bold text** and *italic text* and a [link to nowhere](https://example.com) all in one.

## Second heading

Another paragraph with **two bold runs** and **another one**, plus an _italic_ for variety.

### Third level

Try arrowing across the markers: cursor entering a block should reveal the syntax, leaving should hide it again.
`;

new EditorView({
  state: EditorState.create({
    doc: sample,
    extensions: [
      history(),
      drawSelection(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      markdown(),
      livePreview(),
      EditorView.lineWrapping,
    ],
  }),
  parent: document.getElementById("editor")!,
});
