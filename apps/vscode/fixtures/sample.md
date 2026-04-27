---
title: Sample document
tags: [facet, fixture]
author: wesley
---

# Facet — sample document

A scratch fixture for the F5 dev loop. Edit, save, and confirm the bytes round-trip.

## What to try

- Type into this paragraph and watch the dirty indicator on the tab.
- `Cmd+S` saves; `git diff fixtures/sample.md` should be empty if you didn't change anything.
- `Cmd+Z` / `Cmd+Shift+Z` for undo / redo.
- Edit this file from another window or terminal — the editor should reflect the change without reopen.

## Some content to preserve

1. First item
2. Second item
   - Nested
   - **Bold** and *italic*
   - **Bold *and italic***
3. Third item with [a link](https://example.com)

- [ ] Click this checkbox — saving should produce a `[ ]` → `[x]` diff and nothing else.
- [x] Already-done item — clicking should flip it back to `[ ]`.
- Plain item next to task items.

> Blockquote with `inline code`.

```ts
const greeting: string = "hello, facet";
console.log(greeting);
```

| Col A | Col B | Col C |
| ----- | ----- | ------ |
| 1     | one   | 2|
| 2     | two   | # | 

| Left | Center | Right |
| :--- | :----: | ----: |
| a    |   b    |     c |
| dd   |   ee   |    ff |

## Images

A local SVG resolved via `asWebviewUri()`:


A remote https image (paste any public URL to verify CSP + remote rendering):

![Remote](https://codemirror.net/style/logo/overleaf.png)

## Links

Click semantics: plain click on a rendered link follows it; clicking once the source is revealed (cursor inside the link) just positions the cursor.

- Remote: [CodeMirror docs](https://codemirror.net/docs/) — should open in the system browser.
- Internal: [open notes.md](./notes.md) — opens the sibling fixture in Facet.
- Anchor in another file: [first Setup](./notes.md#setup) — opens `notes.md` and scrolls to its first `## Setup`.
- Anchor with collision suffix: [second Setup](./notes.md#setup-1) — same file, scrolls to the duplicate heading.
- Anchor in this file: [jump to "What to try"](#what-to-try) — should scroll this editor to that heading.
- mailto: [say hi](mailto:hi@example.com) — should open the system mail client.

This is an edit. 
