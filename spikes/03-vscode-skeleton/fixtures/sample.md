# Spike 3 sample

This file is opened by the Facet Spike 3 custom editor. The webview is intentionally a `<textarea>` — no markdown rendering, no editor library — so that anything that feels off is the VS Code surface, not CodeMirror.

## Things to try

- Type into the textarea. The tab should show a dirty indicator (a dot).
- `Cmd+S` to save. Dirty indicator should clear; the file on disk should match.
- `Cmd+Z` / `Cmd+Shift+Z` for undo / redo.
- Edit this file from outside the Extension Development Host (terminal, another VS Code window) and watch the textarea update.
- Switch the VS Code theme; the textarea colors should track.
- `Cmd+F` to try find. Note what happens — the spike's README explains why this is the one item that won't behave like a normal editor.

## Image link

This image syntax is just text in the textarea — the spike doesn't render markdown:

![A blue pixel](sample.png)

The 1×1 pixel at the bottom of the webview is loaded by the webview HTML directly via `asWebviewUri()`, which is what verifies that VS Code's webview URI scheme works for local resources.
