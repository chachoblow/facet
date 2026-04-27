import { Annotation, EditorState } from "@codemirror/state";
import { EditorView, basicSetup } from "codemirror";
import { blockMarksField } from "./block-marks.js";
import { codeMarksField, highlighterReady } from "./code-marks.js";
import { frontmatterMarksField } from "./frontmatter-marks.js";
import { createImageMarksField, type ResolveUrl } from "./image-marks.js";
import { inlineMarksField } from "./inline-marks.js";
import { linkClickHandler } from "./link-click.js";
import { resolveImageUrl } from "./resolve-image-url.js";
import { tableMarksField } from "./table-marks.js";

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
};

const vscode = acquireVsCodeApi();

const remote = Annotation.define<boolean>();

let view: EditorView | null = null;

function createView(initialDoc: string, parent: HTMLElement, resolve: ResolveUrl): EditorView {
  const state = EditorState.create({
    doc: initialDoc,
    extensions: [
      basicSetup,
      frontmatterMarksField,
      blockMarksField,
      codeMarksField,
      tableMarksField,
      createImageMarksField(resolve),
      inlineMarksField,
      linkClickHandler((url) => vscode.postMessage({ type: "openLink", url })),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return;
        if (update.transactions.some((t) => t.annotation(remote))) return;
        vscode.postMessage({
          type: "edit",
          text: update.state.doc.toString(),
        });
      }),
    ],
  });

  return new EditorView({ state, parent });
}

function applyRemoteUpdate(text: string): void {
  if (!view) return;
  if (view.state.doc.toString() === text) return;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
    annotations: remote.of(true),
  });
}

window.addEventListener("message", async (event) => {
  const msg = event.data as { type?: string; text?: string; baseUri?: string };
  if (msg.type !== "update" || typeof msg.text !== "string") return;

  if (view === null) {
    const parent = document.getElementById("editor");
    if (!parent) return;
    await highlighterReady;
    const baseUri = msg.baseUri;
    const resolve: ResolveUrl =
      typeof baseUri === "string" && baseUri.length > 0
        ? (url) => resolveImageUrl(url, baseUri)
        : (url) => url;
    view = createView(msg.text, parent, resolve);
  } else {
    applyRemoteUpdate(msg.text);
  }
});

vscode.postMessage({ type: "ready" });
