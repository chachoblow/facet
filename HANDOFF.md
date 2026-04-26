# Facet — Handoff Notes

A pickup point for the next working session. Read this first, then dive into the docs it references.

## Where things stand

- **Project**: Facet — a markdown editing experience oriented around shared alignment across humans, AI agents, and future-self.
- **V1 target**: Facet for VS Code, a Hybrid live-preview Surface for `.md` files, built on CodeMirror 6.
- **Long-term vision**: Three Surfaces (Facet for VS Code, Facet Review, Facet Studio) sharing a Remark-based markdown core, with the git repo as the Content source of truth.
- **Repo**: <https://github.com/chachoblow/facet> — public, `main` branch.
- **Status**: Monorepo scaffolded (pnpm workspaces + TypeScript project references + esbuild, Node 24 / pnpm 10 pinned). Spikes 1–3 run; all green-lit Plan A. Spike 1 promoted to a permanent test at `packages/core/test/round-trip.test.ts`. **Impl order steps 1–5 are done.** The VS Code extension hosts a `CustomTextEditorProvider` with a CodeMirror 6 webview; edits flow webview → `postMessage` → `WorkspaceEdit` → `TextDocument`, and saves write the buffer's bytes verbatim — the v1 structural mechanism for D5. `priority` is `"option"` so VS Code's default markdown editor stays primary until impl order step 12. `@facet/core` exposes `parse(markdown): Root`, `findInlineMarks(root): InlineMark[]`, `findBlocks(root): Block[]`, and `findTables(root): Table[]`. The webview drives Hybrid live-preview via three parallel StateFields: inline marks (`strong`/`emphasis`/`link`) hide their syntax characters when the cursor is outside the mark's outer range; blocks (`heading`/`blockquote`/`listItem`/`code`) get line-level decorations plus marker hiding (line-based cursor check) — `# `, `> `, and `- ` markers hide when the cursor's line is outside the block, unordered list items render as `• ` via a `BulletWidget`, ordered list `1. ` markers stay visible, code fences are visible-but-muted (true hide is parked, see Pending below); and tables render as a styled grid (`.facet-table-line` / `.facet-table-header-line` / `.facet-table-alignment-line` line decorations, plus per-cell `.facet-table-cell-{left,center,right}` marks for non-default-aligned columns) with each `|` hidden via `Decoration.replace` when the cursor is on a non-table line, and pipes returning when the cursor is on any line of the table. GFM task list items render as a clickable checkbox: `findBlocks` exposes `checked: boolean | null` plus `checkboxStart`/`checkboxEnd` on the `listItem` variant (plain items get nulls), and the webview replaces the full `- [ ]` / `- [x]` source with a single atomic `CheckboxWidget` covering `markerStart..checkboxEnd` (combining the marker hide and widget into one range so the cursor can't land in the hidden gap between them when arrowing up/down). Ordered task items keep `1. ` visible and replace just `[ ]` / `[x]`. Clicking dispatches a CodeMirror change built by a pure-function `buildToggleEdit({checked, checkboxStart, checkboxEnd}) → {from, to, insert}` (`apps/vscode/src/webview/task-toggle.ts`) that produces a precise `[ ]` ↔ `[x]` swap; the existing webview → `postMessage` → `WorkspaceEdit` flow handles persistence, so D5 round-trip stays untouched.

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

## Immediate next action: impl order step 6 — frontmatter

Frontmatter. The v1 spec (`docs/facet-spec-v1.md` §"Frontmatter") calls for YAML frontmatter rendered as a **collapsed, styled block** at the top of the Document, click-to-expand to edit raw YAML. **No properties-panel UI in v1** — that's an explicit non-goal.

Parser plumbing isn't in place yet. `remark-frontmatter` is already a `devDependency` of `@facet/core` (used by the round-trip test), but `parse.ts` doesn't load it — frontmatter currently parses as a paragraph or YAML-ish text. Step 1: promote `remark-frontmatter` to `dependencies` and wire it into the unified pipeline in `packages/core/src/parse.ts`. Confirm via `parse.test.ts` that `---\nfoo: bar\n---` produces a `yaml` node at the top of the AST.

Step 2: add a `findFrontmatter(root): Frontmatter | null` helper in `@facet/core`. Likely shape: `{ start: number; end: number }` covering the outer fence-to-fence range. Mirror the `findBlocks` / `findTables` TDD pattern.

Step 3: a webview StateField (parallel to `block-marks.ts` / `table-marks.ts`) that emits a single `Decoration.replace` over the frontmatter range with a clickable widget when collapsed; on click, the widget either dispatches a selection change to land the cursor inside the frontmatter (mirroring how cursor-in-block reveals source) or toggles a per-StateField `expanded` flag. Cursor-in-frontmatter reveals the raw YAML for editing, mirroring the read-as-rendered / edit-as-source pattern that's already established for headings, lists, blockquotes, code, and tables.

Out of scope this step: properties-panel UI (explicit non-goal), schema-aware editing, properties autocomplete. Also out of scope: code-block syntax highlighting (step 7), images (step 8).

Guardrails worth re-reading first: D5 (round-trip — frontmatter must round-trip byte-identically; the YAML body is just text, but the `---` fences and trailing newlines need to survive verbatim — `remark-stringify` is still not on the save path) and D6 (CommonMark + GFM only — YAML frontmatter is the one widely-supported pseudo-extension; lock it down here so the next session doesn't reach for TOML or `+++` fences).

Three follow-ups parked from earlier steps (see Pending / parked below): nested blockquotes (`>>` / `>>>`) collapse visually to one quote level (step 4); code fences are visible-but-muted rather than hidden (step 4, fold into step 7); arrow-up/down across decorated lines lands at a surprising source offset because CM tracks pixel-x (step 5, defer to step 13 with a unified custom keymap). All safe to defer.

Two cosmetic items deferred from step 5 (acceptable for v1, fold into polish): the alignment row is muted via opacity rather than collapsed (same trade-off as the code-fence true-hide), and cell-align marks use `display: inline-block` so the leading `|` of cells 2+ inherits the alignment when the cursor is inside the table. Both are CSS-only and easy to retune later.

## Implementation order

Done:

1. ✅ CodeMirror 6 inside the `CustomTextEditorProvider`, writing the buffer verbatim on save (the production embodiment of D5). esbuild builds two bundles (extension/Node CJS, webview/browser IIFE); tsconfigs are split so the webview gets DOM lib. `priority="option"` keeps VS Code's default markdown editor primary until step 12. F5 dev loop wired in `apps/vscode/.vscode/` with `fixtures/sample.md`.
2. ✅ Remark integration for AST awareness — `@facet/core` exposes `parse(markdown): Root` via `unified + remark-parse + remark-gfm`. Parse-only; `remark-stringify` stays a `devDependency` for the round-trip test. Coverage: ATX headings, ordered/unordered lists, inline links with title, fenced code with language, GFM tables with alignment, GFM task list checked state, GFM strikethrough.
3. ✅ Hybrid live-preview for inline marks (bold, italic, links). `@facet/core` adds `findInlineMarks(root): InlineMark[]` returning outer/inner offsets per `strong`/`emphasis`/`link` (plus `url`/`title` for links). The webview's `inline-marks.ts` `StateField<DecorationSet>` re-parses on each doc/selection change, hides the syntax characters with `Decoration.replace` when the cursor is outside the mark's outer range, and styles the inner with `.facet-strong` / `.facet-emphasis` / `.facet-link`. Nested marks (e.g. emphasis inside strong) are handled.
4. ✅ Hybrid live-preview for blocks (headings, lists, blockquotes, code). `@facet/core` adds `findBlocks(root): Block[]` returning per-block ranges + type-specific metadata (`depth` for headings, `ordered` for listItems, `lang` for code). The webview's `block-marks.ts` `StateField<DecorationSet>` mirrors `inline-marks.ts`: `Decoration.line` for `.facet-heading-line-{1..6}` / `.facet-blockquote-line` / `.facet-list-line` / `.facet-code-line` / `.facet-code-fence-line`, plus `Decoration.replace` for marker hiding (`# `, `> `, `- `) when the cursor's line is outside the block's line range. Unordered list markers render as `• ` via a `BulletWidget`; ordered `1. ` markers stay visible. Cursor-in-block is line-based (not offset-based) so cursor at end of a heading line still keeps the source revealed. Tests cover setext headings, task list items, tilde-fenced and indented code in `findBlocks`, plus a `block-marks` `buildDecorations` unit test for the cursor-in-block boundary. Two parked follow-ups (see Pending / parked): nested blockquotes (`>>`/`>>>`) collapse to one visual level, and code fences are visible-but-muted rather than hidden.
5. ✅ Tables (and task lists, which landed earlier in step 5). `@facet/core` adds `findTables(root): Table[]` returning outer offsets, column `align` (`"left"`/`"center"`/`"right"`/`null`), an `alignmentRow` range covering the `| --- |` separator (computed from the gap between mdast's header row end and first body row start, since mdast doesn't surface the separator as its own node), and per-row/per-cell ranges with an `isHeader` flag. The webview's `table-marks.ts` `StateField<DecorationSet>` emits `Decoration.line` for `.facet-table-line` / `.facet-table-header-line` / `.facet-table-alignment-line`, hides each `|` with `Decoration.replace` when the cursor is on a non-table line, and applies `.facet-table-cell-{left,center,right}` `Decoration.mark` to cells in non-default-aligned columns. Cursor-in-table is line-based, mirroring blocks. Tests cover the empty-doc tracer, line classes, pipe hide on/off, alignment-row class, header class, and cell-align marks. Task list piece: `findBlocks` listItem variant gained `checked` + `checkboxStart`/`checkboxEnd`; webview emits a single atomic `CheckboxWidget` over `markerStart..checkboxEnd` for unordered tasks; click dispatches a CodeMirror change built by `buildToggleEdit()` for an exact `[ ]` ↔ `[x]` swap. Two parked cosmetics (see Pending / parked): the alignment row is muted via opacity rather than collapsed, and cell-align marks bleed onto the leading `|` of cells 2+ when pipes are visible.

Ahead, in order:

6. **Next:** Frontmatter (collapsed block, click to expand).
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
- **Step 5 cosmetic follow-ups for tables (non-blocking, revisit during polish)**:
  - **Alignment row is muted via opacity, not collapsed.** `.facet-table-alignment-line` applies `opacity: 0.55` and a smaller font-size, but the line still occupies vertical space. Same trade-off as the code-fence true-hide above (and the right fix is the same: `Decoration.replace({ block: true })` over the line range). Fold into the same polish pass.
  - **Cell-align marks bleed onto the leading `|`.** The `.facet-table-cell-{left,center,right}` marks span each cell's full source range (which includes the leading `|` for cells 2+), so when the cursor is inside the table and pipes are visible, the leading pipe of a centered or right-aligned cell inherits the alignment. Cosmetically minor — only visible during edit mode. Fix is to scope the mark to the cell's content (between pipes), or move alignment to a per-line decoration that targets specific child elements.
- **Open questions for the future** (not v1): Listed at the bottom of [`docs/facet-decisions.md`](docs/facet-decisions.md) — auth, hosting, real-time vs async, Frontmatter properties panel, paste-image, Mermaid PNG export.

## Guardrails for the next session

A few things easy to forget under time pressure:

- **Round-trip fidelity (D5).** The v1 mechanism is structural: CodeMirror owns the text buffer and saves write its bytes verbatim — `remark-stringify` is not called on the save path. Don't add a save-path serializer. Don't let CodeMirror, Remark config, or any plugin silently normalize list markers, reflow paragraphs, or rewrite link forms. The round-trip test at `packages/core/test/round-trip.test.ts` locks Remark behavior — keep it green and don't disable it. `remark-stringify` is a `devDependency` of `@facet/core` for the test only; don't promote it to `dependencies` or import it from `src/`.
- **No custom markdown syntax (D6).** CommonMark + GFM only. No wiki-style `[[links]]`, custom callouts, or embed syntax.
- **Use the canonical terms** from `UBIQUITOUS_LANGUAGE.md`. Especially **Surface** vs **Facet** and **Thread** vs **Comment**.
- **Plan B is real (D3).** If CodeMirror Hybrid live-preview turns into disproportionate custom-plugin work, switching Facet for VS Code to **Milkdown with a source-mode toggle** is a legitimate move, not a failure. Keep `packages/core/` library-agnostic so the swap stays feasible.
