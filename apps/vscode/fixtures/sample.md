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

This is an edit. 
