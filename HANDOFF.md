# Facet — Handoff Notes

A pickup point for the next working session. Read this first, then dive into the docs it references.

## Where things stand

- **Project**: Facet — a markdown editing experience oriented around shared alignment across humans, AI agents, and future-self.
- **V1 target**: Facet for VS Code, a Hybrid live-preview Surface for `.md` files, built on CodeMirror 6.
- **Long-term vision**: Three Surfaces (Facet for VS Code, Facet Review, Facet Studio) sharing a Remark-based markdown core, with the git repo as the Content source of truth.
- **Repo**: <https://github.com/chachoblow/facet> — public, `main` branch.
- **Status**: Monorepo scaffolded (pnpm workspaces + TypeScript project references + esbuild, Node 24 / pnpm 10 pinned). Spikes 1–3 run; all green-lit Plan A. Spike 1 promoted to a permanent test at `packages/core/test/round-trip.test.ts`. **Impl order steps 1–4 are done; step 5 task lists landed (tables remain)**. The VS Code extension hosts a `CustomTextEditorProvider` with a CodeMirror 6 webview; edits flow webview → `postMessage` → `WorkspaceEdit` → `TextDocument`, and saves write the buffer's bytes verbatim — the v1 structural mechanism for D5. `priority` is `"option"` so VS Code's default markdown editor stays primary until impl order step 12. `@facet/core` exposes `parse(markdown): Root`, `findInlineMarks(root): InlineMark[]`, and `findBlocks(root): Block[]`. The webview drives Hybrid live-preview via two parallel StateFields: inline marks (`strong`/`emphasis`/`link`) hide their syntax characters when the cursor is outside the mark's outer range, and blocks (`heading`/`blockquote`/`listItem`/`code`) get line-level decorations plus marker hiding (line-based cursor check) — `# `, `> `, and `- ` markers hide when the cursor's line is outside the block; unordered list items render as `• ` via a `BulletWidget`; ordered list `1. ` markers stay visible; code fences are visible-but-muted (true hide is parked, see Pending below). GFM task list items render as a clickable checkbox: `findBlocks` now exposes `checked: boolean | null` plus `checkboxStart`/`checkboxEnd` on the `listItem` variant (plain items get nulls), and the webview replaces the full `- [ ]` / `- [x]` source with a single atomic `CheckboxWidget` covering `markerStart..checkboxEnd` (combining the marker hide and widget into one range so the cursor can't land in the hidden gap between them when arrowing up/down). Ordered task items keep `1. ` visible and replace just `[ ]` / `[x]`. Clicking dispatches a CodeMirror change built by a pure-function `buildToggleEdit({checked, checkboxStart, checkboxEnd}) → {from, to, insert}` (`apps/vscode/src/webview/task-toggle.ts`) that produces a precise `[ ]` ↔ `[x]` swap; the existing webview → `postMessage` → `WorkspaceEdit` flow handles persistence, so D5 round-trip stays untouched.

## Run it locally

`code apps/vscode` → F5 launches an Extension Development Host with `apps/vscode/fixtures/sample.md` preloaded. Because Facet is registered with `priority: "option"`, the file opens in VS Code's default markdown editor first — right-click the tab → **Reopen Editor With… → Facet** to switch in. Round-trip check: save without changing anything, then `git diff apps/vscode/fixtures/sample.md` should be empty.

## Repository layout

```
facet/
├── apps/
│   └── vscode/              # Facet for VS Code (v1) — CustomTextEditorProvider + CodeMirror 6 webview
├── packages/
│   └── core/                # Markdown parsing, AST queries — currently empty exports (step 2)
├── docs/                    # Design docs
└── spikes/                  # Exploratory POCs (not built or shipped)
```

## Read these first (in order)

1. [`CONTRIBUTING.md`](CONTRIBUTING.md) — setup, commands, and the read-first list mirrored from this file.
2. [`docs/facet-vision.md`](docs/facet-vision.md) — what Facet is for. Check feature ideas against the "Convergence of understanding" articulation.
3. [`docs/facet-spec-v1.md`](docs/facet-spec-v1.md) — v1 scope for Facet for VS Code. Includes explicit non-goals; respect them.
4. [`docs/facet-decisions.md`](docs/facet-decisions.md) — decision log with revisit conditions. Don't relitigate without checking the "When to revisit" criteria.
5. [`docs/UBIQUITOUS_LANGUAGE.md`](docs/UBIQUITOUS_LANGUAGE.md) — canonical glossary. Use these terms in code, comments, commits, and prose.
6. [`CLAUDE.md`](CLAUDE.md) — guardrails for code changes (applies to humans too).

Spike conclusions are in each `spikes/*/README.md` if you need them.

## Immediate next action: impl order step 5 — tables (task lists ✅)

Tables. Parsing is already in place via `remark-gfm` — see `parse.test.ts` for table alignment coverage. The AST gives `table` → `tableRow` → `tableCell` with column-level alignment metadata on the `table` node. The Hybrid live-preview goal is: when the cursor is outside the table, render it as a styled grid (column borders, header-row weighting, alignment); when the cursor is in any cell, reveal the pipe-and-dash source so the Author can edit it.

Likely shape: a `findTables(root): Table[]` helper in `@facet/core` exposing per-row/per-cell ranges plus alignment, and a webview StateField that emits `Decoration.line` on table lines and `Decoration.replace` to hide the `|` separators and the `| --- |` alignment row when the cursor is outside. Can fold into `block-marks.ts` or live in `table-marks.ts` — same `StateField<DecorationSet>` shape that re-runs `parse()` on each doc/selection change.

Tables in v1 are read-as-grid / edit-as-source — no programmatic buffer mutation, no in-place cell editing, no Tab-to-next-cell. That keeps D5 mostly automatic: the source bytes are untouched until the Author types. Watch for any decoration that might tempt a normalization path (e.g. "auto-align column widths" — out of scope; we render visually but never rewrite the source).

Out of scope this step: frontmatter (step 6), code-block syntax highlighting (step 7), images (step 8). Also out of scope: making tables editable as a grid.

Guardrails worth re-reading first: D5 (round-trip — tables don't mutate the buffer in v1, but any code that touches the buffer must keep this true) and D6 (CommonMark + GFM only — tables are GFM, in scope).

Step-5 task lists landed two pieces useful for tables to mirror. (1) `apps/vscode/src/webview/task-toggle.ts` is a pure-function edit builder — pattern-match it if tables ever do mutate the buffer (they shouldn't in v1). (2) The combined-widget approach in `block-marks.ts` (single atomic `Decoration.replace` rather than adjacent hide + widget) is the right move whenever a decoration's source has hidden parts adjacent to widget parts, because adjacent atomic decorations create a cursor-trap at the boundary. Tables hiding `|` separators won't have widget+hide adjacency, so this concern likely doesn't apply — but worth keeping in mind.

Three follow-ups parked from earlier steps (see Pending / parked below): nested blockquotes (`>>` / `>>>`) collapse visually to one quote level (step 4); code fences are visible-but-muted rather than hidden (step 4, fold into step 7); arrow-up/down across decorated lines lands at a surprising source offset because CM tracks pixel-x (step 5, defer to step 13 with a unified custom keymap). All safe to defer.

## Implementation order

Done:

1. ✅ CodeMirror 6 inside the `CustomTextEditorProvider`, writing the buffer verbatim on save (the production embodiment of D5). esbuild builds two bundles (extension/Node CJS, webview/browser IIFE); tsconfigs are split so the webview gets DOM lib. `priority="option"` keeps VS Code's default markdown editor primary until step 12. F5 dev loop wired in `apps/vscode/.vscode/` with `fixtures/sample.md`.
2. ✅ Remark integration for AST awareness — `@facet/core` exposes `parse(markdown): Root` via `unified + remark-parse + remark-gfm`. Parse-only; `remark-stringify` stays a `devDependency` for the round-trip test. Coverage: ATX headings, ordered/unordered lists, inline links with title, fenced code with language, GFM tables with alignment, GFM task list checked state, GFM strikethrough.
3. ✅ Hybrid live-preview for inline marks (bold, italic, links). `@facet/core` adds `findInlineMarks(root): InlineMark[]` returning outer/inner offsets per `strong`/`emphasis`/`link` (plus `url`/`title` for links). The webview's `inline-marks.ts` `StateField<DecorationSet>` re-parses on each doc/selection change, hides the syntax characters with `Decoration.replace` when the cursor is outside the mark's outer range, and styles the inner with `.facet-strong` / `.facet-emphasis` / `.facet-link`. Nested marks (e.g. emphasis inside strong) are handled.
4. ✅ Hybrid live-preview for blocks (headings, lists, blockquotes, code). `@facet/core` adds `findBlocks(root): Block[]` returning per-block ranges + type-specific metadata (`depth` for headings, `ordered` for listItems, `lang` for code). The webview's `block-marks.ts` `StateField<DecorationSet>` mirrors `inline-marks.ts`: `Decoration.line` for `.facet-heading-line-{1..6}` / `.facet-blockquote-line` / `.facet-list-line` / `.facet-code-line` / `.facet-code-fence-line`, plus `Decoration.replace` for marker hiding (`# `, `> `, `- `) when the cursor's line is outside the block's line range. Unordered list markers render as `• ` via a `BulletWidget`; ordered `1. ` markers stay visible. Cursor-in-block is line-based (not offset-based) so cursor at end of a heading line still keeps the source revealed. Tests cover setext headings, task list items, tilde-fenced and indented code in `findBlocks`, plus a `block-marks` `buildDecorations` unit test for the cursor-in-block boundary. Two parked follow-ups (see Pending / parked): nested blockquotes (`>>`/`>>>`) collapse to one visual level, and code fences are visible-but-muted rather than hidden.

Ahead, in order:

5. **Next:** Tables. _(Task lists ✅ — see "Where things stand" for shipping details: `findBlocks` listItem variant gained `checked` + `checkboxStart`/`checkboxEnd`; webview emits a single atomic `CheckboxWidget` over `markerStart..checkboxEnd` for unordered tasks; click dispatches a CodeMirror change built by `buildToggleEdit()` for an exact `[ ]` ↔ `[x]` swap.)_
6. Frontmatter (collapsed block, click to expand).
7. Code block syntax highlighting.
8. Images (local via `asWebviewUri()`, remote direct).
9. Internal link navigation (including anchor links).
10. Mermaid (lazy-loaded, debounced, VS Code theme-mapped).
11. Theme integration (light, dark, high-contrast).
12. Activation command (`"Facet: Set as default markdown editor"`) + "View source" escape hatch.
13. Polish: cursor behavior edge cases, large-file performance.

Each step delivers something demonstrable end-to-end. Acceptance criteria are at the bottom of [`docs/facet-spec-v1.md`](docs/facet-spec-v1.md). Honest test: **point Facet for VS Code at the team's wiki repo and live on it for a week.**

## Pending / parked

- **Auth setup detail**: `gh auth setup-git` was run on the dev machine to make git use the active `gh` account. Switching `gh` accounts now affects which identity pushes to github.com. Switch back to `cpr-wklein` when working on other repos: `gh auth switch --user cpr-wklein`.
- **Commit author email**: Currently using `chachoblow@users.noreply.github.com`. The user has chosen not to attach a real email to Facet commits.
- **Step 4 follow-ups (non-blocking, revisit alongside step 7 / polish)**:
  - **Nested blockquotes (`>>` / `>>>`) collapse visually to a single quote level.** `findBlocks` emits only the outermost blockquote (to avoid duplicate `>` hide-decorations), and the per-line regex `/^(\s*)(>+\s?)/` greedily hides all leading `>` characters as one prefix. Round-trip is safe and editing works (cursor reveals source); the only loss is visual depth communication. Proper fix: emit each nested blockquote as its own block, give each level its own decoration (or a depth attribute), and have the per-line scan hide one `>` per level rather than all at once.
  - **Code fences are visible-but-muted, not hidden.** A `Decoration.replace` on a fence line leaves an empty vertical gap. Doing it correctly needs `Decoration.replace({ block: true })` to collapse the line. Likely fold into step 7 (syntax highlighting), where we'd also want a small `lang` badge in place of the opening fence — `findBlocks` already exposes the `lang` field for that.
- **Step 5 follow-up — arrow-up/down cursor placement across decorated lines (defer to step 13)**: When the visible width of a line's decorated form differs from its source width, CM's default goal-column tracking (pixel-x) lands the cursor at a surprising source offset on the target line. Most visible on task lists: pressing Down from "right of `]`" on `- [ ] foo` lands inside the next item's text instead of "right of `]`" on the bottom line, because the combined `- [ ]` widget consumes less visual width than the `- [ ] ` source it replaces. The bullet widget on plain unordered lists has the same shape (smaller magnitude). Right home is step 13 (cursor edge cases) with a unified custom keymap that preserves source offset when source and target lines have the same structural prefix; a task-list-specific fix would either be redone once more decoration types arrive or expand into the same step-13 work in disguise.
- **Open questions for the future** (not v1): Listed at the bottom of [`docs/facet-decisions.md`](docs/facet-decisions.md) — auth, hosting, real-time vs async, Frontmatter properties panel, paste-image, Mermaid PNG export.

## Guardrails for the next session

A few things easy to forget under time pressure:

- **Round-trip fidelity (D5).** The v1 mechanism is structural: CodeMirror owns the text buffer and saves write its bytes verbatim — `remark-stringify` is not called on the save path. Don't add a save-path serializer. Don't let CodeMirror, Remark config, or any plugin silently normalize list markers, reflow paragraphs, or rewrite link forms. The round-trip test at `packages/core/test/round-trip.test.ts` locks Remark behavior — keep it green and don't disable it. `remark-stringify` is a `devDependency` of `@facet/core` for the test only; don't promote it to `dependencies` or import it from `src/`.
- **No custom markdown syntax (D6).** CommonMark + GFM only. No wiki-style `[[links]]`, custom callouts, or embed syntax.
- **Use the canonical terms** from `UBIQUITOUS_LANGUAGE.md`. Especially **Surface** vs **Facet** and **Thread** vs **Comment**.
- **Plan B is real (D3).** If CodeMirror Hybrid live-preview turns into disproportionate custom-plugin work, switching Facet for VS Code to **Milkdown with a source-mode toggle** is a legitimate move, not a failure. Keep `packages/core/` library-agnostic so the swap stays feasible.
