import { Annotation, Compartment, EditorState } from "@codemirror/state";
import { EditorView, basicSetup } from "codemirror";
import { blockMarksField } from "./block-marks.js";
import { createCodeMarksField, highlighterReady } from "./code-marks.js";
import { frontmatterMarksField } from "./frontmatter-marks.js";
import { createImageMarksField, type ResolveUrl } from "./image-marks.js";
import { inlineMarksField } from "./inline-marks.js";
import { linkClickHandler } from "./link-click.js";
import { createMermaidMarksField } from "./mermaid-marks.js";
import { resolveImageUrl } from "./resolve-image-url.js";
import { tableMarksField } from "./table-marks.js";
import { type VsCodeThemeKind, pickMermaidTheme, pickShikiTheme } from "../theme-kind.js";

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
};

const vscode = acquireVsCodeApi();

const remote = Annotation.define<boolean>();

const vscodeTheme = EditorView.theme({
  ".cm-gutters": {
    backgroundColor: "var(--vscode-editorGutter-background)",
    color: "var(--vscode-editorLineNumber-foreground)",
    border: "none",
    borderRight: "1px solid var(--vscode-editorWidget-border, transparent)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--vscode-editorGutter-background)",
    color: "var(--vscode-editorLineNumber-activeForeground)",
  },
});

let view: EditorView | null = null;
let activeThemeKind: VsCodeThemeKind = "dark";
const themeCompartment = new Compartment();

function themedFields(
  kind: VsCodeThemeKind,
): [ReturnType<typeof createCodeMarksField>, ReturnType<typeof createMermaidMarksField>] {
  return [
    createCodeMarksField(pickShikiTheme(kind)),
    createMermaidMarksField(pickMermaidTheme(kind)),
  ];
}

function createView(initialDoc: string, parent: HTMLElement, resolve: ResolveUrl): EditorView {
  const state = EditorState.create({
    doc: initialDoc,
    extensions: [
      basicSetup,
      vscodeTheme,
      frontmatterMarksField,
      blockMarksField,
      themeCompartment.of(themedFields(activeThemeKind)),
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

function applyThemeKind(kind: VsCodeThemeKind): void {
  if (kind === activeThemeKind) return;
  activeThemeKind = kind;
  if (view) {
    view.dispatch({ effects: themeCompartment.reconfigure(themedFields(kind)) });
  }
}

function applyRemoteUpdate(text: string): void {
  if (!view) return;
  if (view.state.doc.toString() === text) return;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
    annotations: remote.of(true),
  });
}

function isThemeKind(value: unknown): value is VsCodeThemeKind {
  return (
    value === "light" ||
    value === "dark" ||
    value === "high-contrast" ||
    value === "high-contrast-light"
  );
}

window.addEventListener("message", async (event) => {
  const msg = event.data as {
    type?: string;
    text?: string;
    baseUri?: string;
    themeKind?: unknown;
  };
  if (msg.type !== "update" || typeof msg.text !== "string") return;

  if (isThemeKind(msg.themeKind)) {
    if (view === null) {
      activeThemeKind = msg.themeKind;
    } else {
      applyThemeKind(msg.themeKind);
    }
  }

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
