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
3. Third item with [a link](https://example.com)

> Blockquote with `inline code`.

```ts
const greeting: string = "hello, facet";
console.log(greeting);
```

| Col A | Col B |
| ----- | ----- |
| 1     | one   |
| 2     | two   |

This is an edit. 
