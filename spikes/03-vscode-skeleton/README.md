# Spike 3 — VS Code custom editor + webview skeleton

> Status: **Run. Author judged it passes pass criteria.** The `CustomTextEditorProvider` plumbing — webview ↔ `WorkspaceEdit` ↔ `TextDocument` message loop, dirty propagation, undo/redo, `asWebviewUri()`, theme inheritance, CSP — all behave like a normal VS Code editor. Find/replace is the expected webview limitation (see "A note on find/replace" below); CodeMirror's own search extension will address it in the v1 build. No surprises in the VS Code integration plumbing; the v1 architecture stands.
> Maps to: validates the VS Code integration plumbing assumed by [Decision D2](../../docs/facet-decisions.md) (VS Code as v1 host) and the v1 spec.

## What this tests

Whether the wiring around a `CustomTextEditorProvider` behaves the way a normal VS Code text editor does — *before* a real editor library is layered on top.

This is a **plumbing risk**, not a UX or correctness risk. Spike 1 asked "does the data survive". Spike 2 asked "does the experience earn its keep". Spike 3 asks: "do the integration points VS Code provides — dirty state, undo/redo, theming, `asWebviewUri()`, the message channel — actually work end to end with a custom editor backed by a `TextDocument`?"

The webview is deliberately a `<textarea>`, not an editor library. If something feels off, we want to know it's the VS Code surface, not CodeMirror.

## Architecture in one paragraph

The v1 plan: a `CustomTextEditorProvider` makes VS Code's `TextDocument` the source of truth. Edits flow webview → `WorkspaceEdit` → `TextDocument`; document changes flow back via `onDidChangeTextDocument` → `postMessage` → webview. Dirty state, undo/redo, save, and external-edit reconciliation all fall out of using the document API instead of writing files directly. This spike is exactly that loop, with no editor library in the middle.

## Run it

```sh
pnpm install
pnpm compile
```

Then open this directory in VS Code and press **F5**. A new Extension Development Host window opens with `fixtures/sample.md` already loaded in the spike editor.

If you want to run without F5:

```sh
code --extensionDevelopmentPath=$(pwd) fixtures/sample.md
```

## What to verify

For each item, the answer should be "behaves like a normal VS Code editor".

- [ ] **Webview opens.** Tab shows the textarea with the file contents.
- [ ] **Dirty propagation.** Type into the textarea — the tab gets a dot indicator.
- [ ] **Save.** `Cmd+S` saves; dirty indicator clears; file on disk matches.
- [ ] **Undo / redo.** `Cmd+Z` / `Cmd+Shift+Z` invoke VS Code's undo on the document, and the textarea reflects the result.
- [ ] **External edit.** Edit `fixtures/sample.md` from outside the Extension Development Host (terminal, another VS Code window); the textarea updates without a reopen.
- [ ] **Theme inheritance.** Switch VS Code theme (light → dark → high-contrast); textarea colors track.
- [ ] **`asWebviewUri()`.** A 1×1 pixel image appears at the bottom of the webview, loaded from `fixtures/sample.png`.
- [ ] **CSP.** Open the webview developer tools (Help → Toggle Developer Tools, then pick the webview frame in the dropdown). No CSP violations in console.
- [ ] **Find/replace.** Try `Cmd+F`. Note what happens — see the section below; record the behavior, don't rate it.

## A note on find/replace

VS Code's native Find widget operates on `TextEditor` instances, not on webview content. A custom editor that hosts a `<textarea>` (or any non-editor DOM) doesn't get native find for free — the keystroke usually does nothing, or invokes the webview's built-in browser find on the rendered DOM. This is a known constraint of webview-hosted editors, not a bug in the spike. The real `apps/vscode/` build will get find from CodeMirror's own search extension, which renders inside the webview — different mechanism, same outcome from the Author's point of view.

Record what you observe so the v1 build inherits a known starting point.

## Pass criteria

The first eight checkboxes behave like a normal VS Code editor. Find/replace is the known constraint above; document the behavior and move on.

## If it fails

Failures here usually fall into two buckets:

- **CSP issues.** The script doesn't load, or the image doesn't render. Open the webview devtools and read the CSP error verbatim — the fix is almost always tightening the `script-src` or `img-src` clause. The CSP in `provider.ts:getHtml` is a starting point, not a final answer.
- **Message-passing races.** Typing causes cursor jumps, content reverts, or doubled keystrokes. The webview's update path compares `editor.value !== msg.text` before writing back to avoid the typing-into-yourself echo loop. If that guard is wrong, this is where it shows up.

Both are solvable, but worth knowing about before adding library complexity on top.

## Implementation notes

- **`CustomTextEditorProvider`, not `CustomEditorProvider`.** `.md` is text. The text-backed variant gives us VS Code-managed dirty state and undo/redo for free, which is precisely what we want to verify.
- **No bundler.** `tsc` for the extension, vanilla JS for the webview. Spike, not production. The real `apps/vscode/` will use esbuild per `HANDOFF.md`.
- **Whole-document replace on each edit.** The webview posts the whole textarea contents on every input event; the extension applies a `WorkspaceEdit` that replaces the whole document. This is fine for a spike — undo/redo granularity will be one step per keystroke. The real `apps/vscode/` build will translate CodeMirror's transaction stream into incremental edits.
- **Image probe is in the webview HTML, not in the rendered markdown.** The textarea doesn't render markdown — it shows raw text. The image at the bottom of the webview is loaded by an `<img>` tag in the HTML, with its `src` set via `webview.asWebviewUri()`. That's enough to verify the URI scheme works.
- **`priority: "default"` in `package.json`.** Inside the Extension Development Host, this makes our editor the default for `.md` so F5 opens the spike editor automatically. The real `apps/vscode/` build will revisit this — see the activation command in `HANDOFF.md`'s implementation order.

## File layout

```
spikes/03-vscode-skeleton/
├── README.md             # this file
├── package.json          # VS Code extension manifest
├── tsconfig.json
├── .vscode/
│   ├── launch.json       # F5 → Extension Development Host
│   └── tasks.json        # preLaunchTask: compile
├── src/
│   ├── extension.ts      # activate(); registers the provider
│   └── provider.ts       # CustomTextEditorProvider impl + inline webview HTML
├── media/
│   └── webview.js        # textarea ↔ extension message loop
└── fixtures/
    ├── sample.md         # the document the editor opens
    └── sample.png        # 1×1 PNG, loaded via asWebviewUri()
```
