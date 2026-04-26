# Facet — Handoff Notes

A pickup point for the next working session. Read this first, then dive into the docs it references.

## Where things stand

- **Project**: Facet — a markdown editing experience oriented around shared alignment across humans, AI agents, and future-self.
- **V1 target**: Facet for VS Code, a Hybrid live-preview Surface for `.md` files, built on CodeMirror 6.
- **Long-term vision**: Three Surfaces (Facet for VS Code, Facet Review, Facet Studio) sharing a Remark-based markdown core, with the git repo as the Content source of truth.
- **Repo**: <https://github.com/chachoblow/facet> — public, `main` branch.
- **Status**: Monorepo scaffolded (pnpm workspaces + TypeScript project references + esbuild, Node 24 / pnpm 10 pinned). Spikes 1–3 run; all green-lit Plan A. Spike 1 promoted to a permanent test at `packages/core/test/round-trip.test.ts`. **Impl order steps 1–3 are done**: the VS Code extension hosts a `CustomTextEditorProvider` with a CodeMirror 6 webview; edits flow webview → `postMessage` → `WorkspaceEdit` → `TextDocument`, and saves write the buffer's bytes verbatim — the v1 structural mechanism for D5. `priority` is `"option"` so VS Code's default markdown editor stays primary until impl order step 12. `@facet/core` exposes `parse(markdown): Root` and `findInlineMarks(root): InlineMark[]`. The webview drives a Hybrid live-preview StateField off those: syntax characters of `strong`, `emphasis`, and `link` are hidden when the cursor is outside the mark's outer range and revealed when it enters; the inner content is always mark-decorated with `.facet-strong` / `.facet-emphasis` / `.facet-link` classes.

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

## Immediate next action: impl order step 4

Hybrid live-preview for **blocks** — headings, lists, blockquotes, code — in the CodeMirror 6 webview. The shape carries over from step 3: when the cursor is outside the block, render it formatted (heading sizes, list bullets, blockquote indent, code monospace + background); when the cursor enters the block's line range, reveal the source. Blocks differ from inline marks in two ways: (1) the "syntax" is line-leading (`#`, `>`, `-`, fence lines) rather than wrapping the content, and (2) hiding usually means a `Decoration.line` class plus replacing the line-leading marker, not wrapping a span.

The AST source is again `parse()` from `@facet/core`. Step 3 added `findInlineMarks(root)` returning `{ start, end, innerStart, innerEnd, ... }`; the analog for blocks is something like `findBlocks(root)` returning per-block ranges plus type-specific metadata (heading depth, list ordered/unordered, code lang). Add it to `@facet/core` — keep walking logic out of the webview.

Out of scope this step: tables and task lists (step 5), code-block syntax highlighting (step 7), frontmatter (step 6).

Guardrails worth re-reading first: D5 (round-trip — the structural mechanism is already in place; don't add a save-path serializer) and D6 (CommonMark + GFM only).

The webview decoration pattern lives at `apps/vscode/src/webview/inline-marks.ts` — a `StateField<DecorationSet>` that re-runs `parse()` + `findInlineMarks()` on each doc/selection change. Step 4 will likely add a sibling `block-marks.ts` (or fold both into a shared `marks.ts`) following the same pattern.

## Implementation order

Done:

1. ✅ CodeMirror 6 inside the `CustomTextEditorProvider`, writing the buffer verbatim on save (the production embodiment of D5). esbuild builds two bundles (extension/Node CJS, webview/browser IIFE); tsconfigs are split so the webview gets DOM lib. `priority="option"` keeps VS Code's default markdown editor primary until step 12. F5 dev loop wired in `apps/vscode/.vscode/` with `fixtures/sample.md`.
2. ✅ Remark integration for AST awareness — `@facet/core` exposes `parse(markdown): Root` via `unified + remark-parse + remark-gfm`. Parse-only; `remark-stringify` stays a `devDependency` for the round-trip test. Coverage: ATX headings, ordered/unordered lists, inline links with title, fenced code with language, GFM tables with alignment, GFM task list checked state, GFM strikethrough.
3. ✅ Hybrid live-preview for inline marks (bold, italic, links). `@facet/core` adds `findInlineMarks(root): InlineMark[]` returning outer/inner offsets per `strong`/`emphasis`/`link` (plus `url`/`title` for links). The webview's `inline-marks.ts` `StateField<DecorationSet>` re-parses on each doc/selection change, hides the syntax characters with `Decoration.replace` when the cursor is outside the mark's outer range, and styles the inner with `.facet-strong` / `.facet-emphasis` / `.facet-link`. Nested marks (e.g. emphasis inside strong) are handled.

Ahead, in order:

4. **Next:** Hybrid live-preview for blocks (headings, lists, blockquotes, code).
5. Tables, task lists.
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
- **Open questions for the future** (not v1): Listed at the bottom of [`docs/facet-decisions.md`](docs/facet-decisions.md) — auth, hosting, real-time vs async, Frontmatter properties panel, paste-image, Mermaid PNG export.

## Guardrails for the next session

A few things easy to forget under time pressure:

- **Round-trip fidelity (D5).** The v1 mechanism is structural: CodeMirror owns the text buffer and saves write its bytes verbatim — `remark-stringify` is not called on the save path. Don't add a save-path serializer. Don't let CodeMirror, Remark config, or any plugin silently normalize list markers, reflow paragraphs, or rewrite link forms. The round-trip test at `packages/core/test/round-trip.test.ts` locks Remark behavior — keep it green and don't disable it. `remark-stringify` is a `devDependency` of `@facet/core` for the test only; don't promote it to `dependencies` or import it from `src/`.
- **No custom markdown syntax (D6).** CommonMark + GFM only. No wiki-style `[[links]]`, custom callouts, or embed syntax.
- **Use the canonical terms** from `UBIQUITOUS_LANGUAGE.md`. Especially **Surface** vs **Facet** and **Thread** vs **Comment**.
- **Plan B is real (D3).** If CodeMirror Hybrid live-preview turns into disproportionate custom-plugin work, switching Facet for VS Code to **Milkdown with a source-mode toggle** is a legitimate move, not a failure. Keep `packages/core/` library-agnostic so the swap stays feasible.
