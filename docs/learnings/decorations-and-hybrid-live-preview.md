# Decorations, StateFields, and Hybrid live-preview

What I worked through to understand the editor side of Facet after impl order steps 1–6 landed. Personal reference, not project doctrine — for that, see `CLAUDE.md`, `HANDOFF.md`, and `docs/facet-decisions.md` D3 / D5 / D8.

## The question

How does Facet display formatted text without modifying the bytes on disk?

The parsing learning covers the *save side*: never serialize, never lose anything. This is the companion on the edit side: while the user is typing, how does asterisk-prefixed source render as bold without rewriting the file?

## The chain of reasoning

### 1. The naive answers don't work

"Hide the asterisks." But hide them how? Delete them from the buffer and you've lost data. Preprocess the markdown into HTML and you've lost the buffer-is-truth invariant from the parsing learning. Whatever we do has to leave the bytes alone.

### 2. CodeMirror's primitive: decorations

CodeMirror separates *what's in the buffer* from *how it renders*. The buffer is the canonical text. **Decorations** are a parallel layer of rendering instructions the renderer consults when drawing.

Decorations never modify the buffer. They're advisory: "when you paint these bytes, do something different."

Three decoration types Facet uses:

- `Decoration.replace(from, to)` — visually skip a byte range. Optionally render a widget in its place.
- `Decoration.mark(from, to, class)` — wrap the range in a span with a CSS class.
- `Decoration.line(line, class)` — add a CSS class to a whole line container.

The crucial property: **decorations are not edits.** The buffer doesn't know about them. Save writes the buffer; the decoration layer is invisible to disk. The structural D5 guarantee from the parsing learning extends to the edit path: as long as decorations are the only mechanism we use to alter rendering, the bytes stay verbatim.

### 3. Decorations need to update on every change

The decoration set isn't static. As the user types and as the cursor moves, the set of "what should hide / what should style" changes. CodeMirror's mechanism for derived data that updates in lockstep with editor state is the **StateField**.

A StateField is two functions:

```typescript
StateField.define<DecorationSet>({
  create(state)              { return /* initial value */ },
  update(value, transaction) { return /* new value */ }
})
```

`update` runs on every transaction — every keystroke, cursor move, paste, undo. It returns the new value, which becomes attached to the new editor state. The view layer pulls every decoration-providing StateField and merges them when it paints.

For Facet, each StateField re-parses the doc, calls the relevant `findX` helper from `@facet/core`, and emits the right decorations.

### 4. Four parallel StateFields, one per construct

`inline-marks.ts`, `block-marks.ts`, `table-marks.ts`, `frontmatter-marks.ts`. Independent. No shared state.

Why independent:

- Different constructs have different rules. One big update function with branching is harder to reason about than four small ones with one job each.
- Each `buildDecorations` is a pure function over (doc, cursor) → DecorationSet, trivially testable without booting an editor.
- No real coupling — a heading doesn't need to know about a table; a blockquote doesn't care whether there's frontmatter.
- Adding a new construct (step 7: code highlighting) is "write a fifth `*-marks.ts`" rather than "thread a new case through a monolith."

The cost: four `parse()` calls per transaction. At v1 scale this is invisible. The mechanical fix when it matters is a shared `StateField<Root>` that the four decoration fields read from. Don't preempt — the duplication keeps each field decoupled while the architecture is still settling.

### 5. Hybrid live-preview falls out for free

This is the part that surprised me when it clicked.

Each StateField checks the cursor position before emitting hide-decorations. When the cursor is *inside* a construct's range, the field returns *without* the hide-decorations for that construct. The asterisks become visible automatically. Move the cursor away — they hide again on the next transaction.

There's no mode switch, no "render view" vs "edit view," no special state. One buffer, one render pipeline, decoration set as a function of cursor position. The reveal-on-cursor UX is a side effect of the data flow, not a feature added on top.

Cursor moves don't fight the model either: a cursor move *is* a transaction; transactions trigger StateField updates; the new decoration set reflects the new cursor position; the renderer paints the result. No special-cased "I just moved into a mark, show source" handler.

### 6. The keystroke trace

Pressing `h` at the end of `# Hi`:

1. **Webview (browser sandbox):**
   - CodeMirror's input handler catches the keypress.
   - Creates a transaction: insert `h` at offset 4.
   - Applies it locally — buffer is now `# Hih`.
   - All four StateFields' `update()` run. Each re-parses, recomputes decorations.
   - View repaints. User sees `h` instantly.
   - Webview posts a message to the extension: `{ type: "edit", changes: [...] }`.

2. **Extension (Node.js):**
   - `provider.ts` receives the message.
   - Constructs a `WorkspaceEdit` describing the same insert.
   - Calls `vscode.workspace.applyEdit(workspaceEdit)`.
   - VS Code applies it to the underlying `TextDocument`.

3. **Save (Cmd+S):**
   - VS Code writes the `TextDocument`'s bytes to disk. Verbatim.
   - No serializer. No `remark-stringify`. No normalization.

The webview updates *first*, before the extension. If the webview waited for the round-trip — postMessage out, applyEdit, "ok done" reply — every keystroke would feel laggy. So the webview is the user-facing source of truth in real time, and the extension is a downstream consumer that mirrors it.

### 7. Two parallel buffers

This took a beat to internalize: there are two text buffers in play.

- **CodeMirror's buffer** lives in the webview. It's what the user types into and what decorations layer over.
- **VS Code's `TextDocument`** lives in the extension host. It's what other VS Code features see — dirty indicator, git integration, search-in-files, other extensions.

The postMessage protocol keeps them in sync. Webview → extension is the common case (user typing). Extension → webview happens when something else mutates the file (another extension, a Revert File, a git checkout): VS Code fires a change event on the TextDocument, the provider forwards it to the webview, CodeMirror applies it to its buffer.

Both buffers converge at every steady state. The `TextDocument` is what gets saved; the webview's buffer is what gets edited. They're the same string when nobody's mid-keystroke.

## The structural D5 guarantee

The parsing learning ends at "save writes bytes verbatim." This learning's contribution is to make the guarantee concrete on the edit path:

1. The webview's edits are CodeMirror transactions on its buffer.
2. Those edits propagate to VS Code's `TextDocument` unchanged (a `WorkspaceEdit` describing the same delta).
3. The decoration layer never touches either buffer.
4. Save writes the `TextDocument`'s bytes.

There is no code on the save path that could violate D5. The protection isn't a check; it's the *absence* of any serializer. **The way to break D5 is to add code, not to remove code.**

That's why the CLAUDE.md guardrail is "don't add a save-path serializer" rather than "make sure the save serializer is correct."

## Why this approach is structurally different from True WYSIWYG (re: D3)

The architecture above only works because CodeMirror displays the source. The asterisks are real characters in the buffer; decorations make them invisible when off-cursor; cursor moves bring them back. **The source is what you see, lightly transformed.**

True WYSIWYG (Milkdown, Notion, Word) is structurally different: there's no source on screen. You see formatted text; you press Cmd+B to embolden; the markdown is a serialization that happens behind the scenes. There's nothing to "reveal on cursor" because the source was never visible.

These aren't two configurations of one editor. They're two architectures with different invariants:

| | Hybrid live-preview | True WYSIWYG |
|---|---|---|
| Primary representation | Text buffer | Tree of typed nodes |
| Cursor moves through | Bytes | Nodes |
| Round-trip | Free (buffer = file) | Engineered (every save serializes) |
| Edit primitive | Text patch | Tree mutation |
| Search/grep ergonomics | First-class | Awkward |
| Adding a new construct | Write a `*-marks.ts` StateField | Extend the schema + serializer |

The parsing learning covers why the right column has to engineer round-trip fidelity. This learning makes visible that the *edit experience itself* is structurally different. You're not picking between UX paradigms — you're picking between editor cores.

D3 (Plan B: Milkdown if CodeMirror Hybrid live-preview gets too costly) is therefore a meaningful pivot, not a refactor. Switching would replace `apps/vscode/src/webview/` wholesale, and the structural D5 mechanism would have to be re-engineered — probably via a CST-style annotation layer over the ProseMirror tree. `packages/core/` survives the switch because it speaks mdast, not CodeMirror.

## Takeaways

- Decorations are the right primitive: a parallel rendering layer that never touches the buffer.
- StateFields update derived data in lockstep with the document; for Facet, the derived data is a DecorationSet.
- Four independent StateFields beats one big one — decoupling, testability, easy extension. The 4× re-parse cost is mechanical to fix when it bites.
- Hybrid live-preview is a side effect of "emit hide-decorations only when cursor is outside the construct," not a feature added on top.
- Two buffers stay in sync via postMessage. The `TextDocument` is the *file* truth; the webview's buffer is the *editing* truth.
- D5 is enforced by the absence of code on the save path, not by a check. Adding a serializer is the way to break it.
- Plan B (Milkdown) is a meaningful pivot, not a refactor — the editor core is structurally different.

## See also

- `docs/learnings/parsing-and-roundtrip-fidelity.md` — the parser-side companion
- `apps/vscode/src/webview/{inline,block,table,frontmatter}-marks.ts` — the four StateFields in concrete form
- `apps/vscode/src/provider.ts` — postMessage / WorkspaceEdit plumbing
- `docs/facet-decisions.md` — D3 (Plan B Milkdown), D5 (round-trip fidelity), D8 (line-based reveal vs overlay layer)
- `CLAUDE.md` — the "don't add a save-path serializer" guardrail
