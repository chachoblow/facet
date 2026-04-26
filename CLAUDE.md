# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Monorepo scaffolded — pnpm workspaces, TypeScript project references, esbuild. Node 24 and pnpm 10 are pinned (`.nvmrc`, `engines`, `packageManager`). Spikes 1–3 have run; conclusions live in each `spikes/*/README.md`. Spike 1 is now a permanent test at `packages/core/test/round-trip.test.ts`.

**Impl order steps 1–5 are done.** `apps/vscode/` registers a `CustomTextEditorProvider` (`facet.markdownEditor`) hosting a CodeMirror 6 webview. Edits flow webview → `postMessage` → `WorkspaceEdit` → `TextDocument`; saves write the buffer's bytes verbatim — the v1 structural mechanism for D5. esbuild builds two bundles (extension/Node CJS, webview/browser IIFE); tsconfigs are split so the webview source gets DOM lib without polluting the extension. `priority` is `"option"`, so VS Code's default markdown editor stays primary until impl order step 12 (the activation command). F5 dev loop is in `apps/vscode/.vscode/`; `apps/vscode/fixtures/sample.md` is the playground (and is `.prettierignore`'d so Prettier doesn't fight verbatim writes).

`@facet/core` exposes `parse(markdown): Root` (`packages/core/src/parse.ts`), `findInlineMarks(root): InlineMark[]` (`packages/core/src/find-inline-marks.ts`), `findBlocks(root): Block[]` (`packages/core/src/find-blocks.ts`), and `findTables(root): Table[]` (`packages/core/src/find-tables.ts`). Parse stack is `unified + remark-parse + remark-gfm`, parse-only. `remark-stringify` and `remark-frontmatter` remain `devDependencies` (only the round-trip test imports them; step 6 will promote `remark-frontmatter` to a runtime dependency). `findInlineMarks` returns `strong`/`emphasis`/`link` nodes with outer offsets (`start`/`end`) and inner offsets (`innerStart`/`innerEnd`); links also carry `url`/`title`. `findBlocks` returns `heading` (with `depth` 1–6 and `markerStart`/`markerEnd` covering `# `…`###### `), `blockquote` (outer-only — nested blockquotes deduped to outermost to avoid duplicate per-line `>` decorations), `listItem` (with `ordered` flag, marker range covering `- ` or `1. ` — including any `[ ]` / `[x]` and its trailing space — plus `checked: boolean | null` and `checkboxStart`/`checkboxEnd: number | null` for GFM task lists; plain items get null defaults), and `code` (with `lang: string | null`). `findTables` returns each `table` with outer offsets, an `align` array (`"left"`/`"center"`/`"right"`/`null` per column), an `alignmentRow` range covering the `| --- |` separator (computed from the gap between mdast's header row end and first body row start, since mdast doesn't surface the separator as its own node), and `rows[]` carrying `isHeader` plus per-cell `start`/`end` offsets that share boundaries at the `|` separators. All helpers recurse through every block container, return doc order, and emit empty marker ranges for setext headings (caller must guard).

The webview consumes these via three parallel StateFields. `apps/vscode/src/webview/inline-marks.ts` re-parses on each doc/selection change and uses `Decoration.replace` to hide `start..innerStart` and `innerEnd..end` when the cursor doesn't overlap a mark's outer range, plus `Decoration.mark` on the inner range with `.facet-strong` / `.facet-emphasis` / `.facet-link` classes. `apps/vscode/src/webview/block-marks.ts` does the same shape for blocks: `Decoration.line` per block-line for `.facet-heading-line-{1..6}` / `.facet-blockquote-line` / `.facet-list-line` / `.facet-code-line` / `.facet-code-fence-line` styling, plus `Decoration.replace` to hide `# `, `> `, and `- ` markers when the cursor's line is outside the block's line range (line-based check, not offset-based, so cursor at the end of a heading line still keeps the source visible). Plain unordered list items render their marker as a `• ` widget (`BulletWidget`) when not editing; ordered items keep `1. ` visible. GFM task list items render as a clickable checkbox: unordered tasks emit a single atomic `Decoration.replace` covering `markerStart..checkboxEnd` with a `CheckboxWidget` (combining the marker hide and the widget into one range so the cursor can't land in the hidden gap between them when arrowing up/down); ordered tasks keep `1. ` visible and replace just `[ ]` / `[x]`. Clicking the checkbox dispatches a CodeMirror change built by a pure-function `buildToggleEdit({checked, checkboxStart, checkboxEnd}) → {from, to, insert}` (`apps/vscode/src/webview/task-toggle.ts`) that produces an exact `[ ]` ↔ `[x]` swap; the existing webview → `postMessage` → `WorkspaceEdit` flow handles persistence so the save path stays untouched. `apps/vscode/src/webview/table-marks.ts` follows the same pattern for tables: `Decoration.line` for `.facet-table-line` / `.facet-table-header-line` / `.facet-table-alignment-line`, plus `Decoration.replace` to hide each `|` when the cursor is on a non-table line (cursor-in-table is line-based, mirroring blocks), plus `Decoration.mark` for `.facet-table-cell-{left,center,right}` on cells in non-default-aligned columns. `buildDecorations` and `buildTableDecorations` are exported for cursor-boundary unit tests in `apps/vscode/test/`. Code fences are visible-but-muted, and the table alignment row is muted via opacity rather than collapsed (parked: both want `Decoration.replace({ block: true })` later — see HANDOFF.md). All decorations are styled in `provider.ts`'s HTML using VS Code theme variables. `apps/vscode` hosts vitest alongside `@facet/core`'s test suite, so `pnpm -r test` runs both. **Step 6 (next)** is frontmatter (collapsed block, click to expand).

Common commands (run from repo root):

- `pnpm install` — install workspace deps.
- `pnpm -r build` — build all packages.
- `pnpm -r test` — run all tests.
- `pnpm -r typecheck` — typecheck all packages.
- `pnpm lint` — eslint the workspace.
- `pnpm format` / `pnpm -w format:check` — apply / verify Prettier.

CI runs format:check, lint, typecheck, build, and test on every push and PR (`.github/workflows/ci.yml`).

## Read these before doing substantive work

The design has converged in writing. Skim these in order — they encode constraints that aren't visible from code:

1. `HANDOFF.md` — current state and the immediate next action.
2. `CONTRIBUTING.md` — setup and command reference.
3. `docs/facet-vision.md` — what Facet is for. Check feature ideas against the "Convergence of understanding" articulation.
4. `docs/facet-spec-v1.md` — v1 scope for Facet for VS Code. Includes explicit non-goals; respect them.
5. `docs/facet-decisions.md` — decision log with revisit conditions. Don't relitigate without checking the "When to revisit" criteria.
6. `docs/UBIQUITOUS_LANGUAGE.md` — canonical glossary. Use these terms in code, comments, commits, and prose.

## Architecture in one paragraph

Facet is a family of **Surfaces** over the same Markdown file. V1 is **Facet for VS Code**, a `CustomTextEditorProvider` hosting a webview that runs **CodeMirror 6** in **Hybrid live-preview** mode. **Remark / unified** is the **parser** (not CodeMirror's built-in markdown), specifically so the AST stays consistent with the future web Surfaces (**Facet Review**, **Facet Studio**). In v1, `remark-stringify` is deliberately not used: saves write the CodeMirror buffer verbatim, which is what preserves round-trip fidelity (D5). The git repo is the **Content source of truth**; **Threads** and **Comments** (not in v1) will live in a separate **Collaboration source of truth**. Logic for parsing, frontmatter, and link resolution should live in `packages/core/` so it can be reused by future Surfaces — keep it out of CodeMirror plugins. `packages/core/` should expose parsing and AST queries; it deliberately does not expose markdown stringification in v1.

## Non-negotiable guardrails

These are easy to violate by accident and expensive to undo:

- **Round-trip fidelity (D5).** Saving must produce byte-identical markdown unless the Author actually changed the Document. The mechanism in v1 is structural: CodeMirror owns the text buffer and saves write its bytes verbatim — `remark-stringify` is not called on save. Don't add a save-path serializer. Don't let CodeMirror, Remark config, or any plugin silently normalize list markers, reflow paragraphs, or rewrite link forms. The behavior lock lives at `packages/core/test/round-trip.test.ts` — keep it green and don't disable it. `remark-stringify` is a `devDependency` of `@facet/core` for that test only; don't promote it to `dependencies` or import it from `packages/core/src/`.
- **No custom markdown syntax (D6).** CommonMark + GFM only. No wiki-style `[[links]]`, custom callouts, or embed syntax. Files must render correctly on GitHub, ADO, and any future Surface.
- **Use the canonical terms.** Especially: **Surface** (technical) vs **Facet** (brand), **Thread** vs **Comment**, **Author** vs "user", **Content source of truth** vs **Collaboration source of truth**. The bare word "editor" is overloaded — say **Surface**, **Author**, or name the library (CodeMirror 6, Milkdown) directly.
- **Plan B is real (D3).** If CodeMirror's Hybrid live-preview turns into disproportionate custom-plugin work, switching Facet for VS Code to **Milkdown with a source-mode toggle** is a legitimate move, not a failure. Keep the core (`packages/core/`) library-agnostic so the swap is feasible.
- **V1 is Facet for VS Code only.** Web Surfaces, Threads/Comments, real-time collab, properties panels, paste-image, and toggle-between-modes UX are all explicit non-goals. See the non-goals list in `docs/facet-spec-v1.md` before building anything that smells adjacent.
