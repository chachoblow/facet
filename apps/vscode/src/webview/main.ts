import { Annotation, EditorState } from "@codemirror/state";
import { EditorView, basicSetup } from "codemirror";

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
};

const vscode = acquireVsCodeApi();

const remote = Annotation.define<boolean>();

let view: EditorView | null = null;

function createView(initialDoc: string, parent: HTMLElement): EditorView {
  const state = EditorState.create({
    doc: initialDoc,
    extensions: [
      basicSetup,
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

window.addEventListener("message", (event) => {
  const msg = event.data as { type?: string; text?: string };
  if (msg.type !== "update" || typeof msg.text !== "string") return;

  if (view === null) {
    const parent = document.getElementById("editor");
    if (!parent) return;
    view = createView(msg.text, parent);
  } else {
    applyRemoteUpdate(msg.text);
  }
});

vscode.postMessage({ type: "ready" });
