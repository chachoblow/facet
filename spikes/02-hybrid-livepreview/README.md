# Spike 2 — CodeMirror 6 Hybrid live-preview proof of concept

> Status: **Run. Author judged it passes pass criteria.** Decision D3 stays at Plan A — CodeMirror 6 is viable for Facet for VS Code; Milkdown fallback is not activated.
> Maps to: [Decision D3 — Editor library](../../docs/facet-decisions.md).

## What this tests

Whether CodeMirror 6 can deliver Hybrid live-preview — formatting renders inline, but markdown markers (`**`, `#`, `[]()`) appear when the cursor enters that block — without disproportionate custom plugin work.

This is a *feel* risk, not a correctness risk. Spike 1 asked "does the data survive". Spike 2 asks "does the experience earn its keep, and at what cost in code".

## Run it

```sh
pnpm install
pnpm dev
```

Open the URL Vite prints. The editor loads with bold, italic, headings, and a link.

## What to test

Move the cursor around. As it enters or leaves a formatted block, the markdown markers should toggle:

- `**bold**` shows just **bold** when the cursor is outside; full `**bold**` when inside.
- `*italic*` and `_italic_` behave the same.
- `# Heading` shows the heading text when the cursor is on a different line; the `#` and its trailing space appear when the cursor is on the heading line.
- `[label](url)` shows just `label` styled when the cursor is outside; full `[label](url)` when inside.

### Specific things to feel out

- **Toggle smoothness.** When the cursor crosses into a formatted block, do markers fade in or does the line jump?
- **Cursor at boundaries.** Arrow-left from after `**bold**` — does the cursor land where you expect? Move into the start of a heading line — is the `#` already visible by the time the cursor gets there?
- **Selection across hidden markers.** Shift-select across `**bold**`. Does the selection look continuous? Does Cmd+C / Cmd+V produce the right markdown bytes?
- **Click-to-position.** Click on the rendered bold word. Where does the cursor land?
- **Atomic skipping.** Arrow keys should skip over hidden markers in a single keystroke (this is what `EditorView.atomicRanges` provides). Try it across `**` — does it feel like one cursor step or two?
- **Layout stability.** As markers show and hide, does the document height or word position stay stable, or does everything reflow?

## Pass criteria

The toggling feels natural; cursor and selection are predictable; no jarring layout shifts. Beyond bold/italic/headings/links, can you imagine extending this pattern to lists, blockquotes, code spans, fenced code blocks, and images without it ballooning?

## If it fails

Activate Plan B from Decision D3: switch Facet for VS Code to **Milkdown with a source-mode toggle**. Different model — Milkdown's source of truth is a structured ProseMirror document, not a text buffer — but it ships hybrid behavior built-in and unifies the editor library across all three Surfaces.

## Implementation notes

- Uses CodeMirror's built-in markdown grammar (`@codemirror/lang-markdown`), not Remark. The spike's question is *UX feel*, not parser integration. Wiring Remark in here would add scope without adding signal. The real Facet build will use Remark per the parser-only architecture from Spike 1; the hybrid plugin pattern transfers.
- The plugin in `src/livepreview.ts` walks the lezer syntax tree on every state or selection change. For each formatting node it emits:
  - **mark decorations** to style the rendered content (bold, italic, heading, link), and
  - **replace decorations** to hide the markdown markers when the cursor is outside the block.
- `EditorView.atomicRanges` is wired to the hidden-only set so arrow keys skip across hidden markers in one keystroke. (Mark decorations are deliberately *not* atomic — you still need to be able to place the cursor inside a bold word.)

## File layout

```
spikes/02-hybrid-livepreview/
├── README.md             # this file
├── package.json
├── tsconfig.json
├── index.html
└── src/
    ├── main.ts           # CodeMirror setup
    ├── livepreview.ts    # the hybrid live-preview plugin
    └── styles.css
```
