# Facet — Handoff Notes

A pickup point for the next working session. Read this first, then dive into the docs it references.

## Where things stand

- **Project**: Facet — a markdown editing experience oriented around shared alignment across humans, AI agents, and future-self.
- **V1 target**: Facet for VS Code, a Hybrid live-preview Surface for `.md` files, built on CodeMirror 6.
- **Long-term vision**: Three Surfaces (Facet for VS Code, Facet Review, Facet Studio) sharing a Remark-based markdown core, with the git repo as the Content source of truth.
- **Repo**: <https://github.com/chachoblow/facet> — public, `main` branch, currently contains only docs and a `.gitignore`.
- **Status**: Pre-implementation. Design converged. No code yet.

## Read these first (in order)

1. [`docs/facet-vision.md`](docs/facet-vision.md) — what Facet is for and why it exists. The soul of the product.
2. [`docs/facet-spec-v1.md`](docs/facet-spec-v1.md) — v1 technical spec for Facet for VS Code. The concrete scope.
3. [`docs/facet-decisions.md`](docs/facet-decisions.md) — decision log: alternatives considered, reasoning, and revisit conditions.
4. [`docs/UBIQUITOUS_LANGUAGE.md`](docs/UBIQUITOUS_LANGUAGE.md) — canonical glossary. Use these terms in code and prose. Especially watch: **Surface** (technical) vs **Facet** (brand), **Thread** vs **Comment**, **Content source of truth** vs **Collaboration source of truth**.

## Immediate next action: run three de-risking spikes

**Do these before scaffolding anything.** Each is a few hours of work. Any one failing would change the architecture, and it's far cheaper to find out now than after a v1 build.

### Spike 1 — Round-trip fidelity through Remark

**Goal**: Confirm Remark can parse and serialize real-world markdown without unacceptable mutations.

**Method**:
- Collect 50–100 real `.md` files (your team's wiki, GitHub READMEs, your existing notes).
- Run each through `unified().use(remarkParse).use(remarkStringify).process()`.
- Diff input vs output.

**Pass criteria**: Either byte-identical output, or a small known set of mutations (e.g. list marker normalization) that you can either configure away or accept as the v1 fidelity contract.

**If it fails**: Reconsider whether Remark is the right serializer, or whether a different markdown library (e.g. `markdown-it` with custom renderers, or a CodeMirror-native AST) is better suited. This is foundational — it gates Decision D5 (Round-trip fidelity).

**Bonus**: Promote this into a permanent test suite. It's the safety net under everything else.

### Spike 2 — CodeMirror 6 hybrid live-preview proof of concept

**Goal**: Confirm CodeMirror 6 can deliver Obsidian-quality Hybrid live-preview without disproportionate custom work.

**Method**:
- Standalone HTML page (no VS Code yet).
- Render a small markdown document with: bold, italic, headings, links.
- Hide syntax markers (`**`, `_`, `#`, `[]()`) when the cursor leaves the block; show them when it returns.
- Test cursor behavior at block boundaries.

**Pass criteria**: The toggling feels natural; cursor placement is predictable; no jarring layout shifts.

**If it fails or feels disproportionately hard**: Activate Plan B from Decision D3 — switch Facet for VS Code to **Milkdown with a source-mode toggle**. This unifies the editor library across all three Surfaces (Milkdown everywhere) and is a real, supported fallback.

### Spike 3 — VS Code custom editor + webview skeleton

**Goal**: Confirm the VS Code integration plumbing works as expected, before adding any editor library on top.

**Method**:
- Minimal `CustomTextEditorProvider` extension.
- Loads a webview that shows the raw `.md` contents in a `<textarea>` (no editor library).
- User edits → webview posts message → extension host writes to file → file watcher updates webview.
- Verify: dirty state propagates, undo/redo works, find/replace works, theme colors inherit, `asWebviewUri()` resolves a sample image correctly.

**Pass criteria**: All of the above behave like a normal VS Code editor would.

**If it fails**: Surprises here usually mean either CSP issues or message-passing race conditions. Both are solvable but worth knowing about before adding library complexity on top.

---

## After the spikes pass

### Decide repo structure (monorepo or single package)

**Recommendation**: Monorepo from day 1, even if only one package is populated. Lays the right foundation for Facet Review and Facet Studio without forcing premature work.

```
facet/
├── apps/
│   └── vscode/              # Facet for VS Code (v1)
├── packages/
│   └── core/                # Remark parsing, frontmatter, link resolution — shared across Surfaces
└── docs/                    # already exists
```

**Tooling**: pnpm workspaces + TypeScript project references. Avoid Nx/Turborepo until you feel actual pain.

### Scaffold the project

- VS Code extension scaffold (`yo code` or manual)
- TypeScript strict mode
- esbuild for both extension and webview (simplest dual-target setup)
- ESLint + Prettier
- GitHub Actions CI (lint + build + test on push)
- LICENSE (MIT recommended unless you have reason otherwise) and CONTRIBUTING.md
- Promote Spike 1's test harness into the permanent test suite

### Implementation order

Each step delivers something demonstrable end-to-end:

1. CodeMirror 6 in the custom editor, writing back to disk with byte-perfect round-trip
2. Remark integration for AST awareness
3. Hybrid live-preview for inline marks (bold, italic, links)
4. Hybrid live-preview for blocks (headings, lists, blockquotes, code)
5. Tables, task lists
6. Frontmatter (collapsed block, click to expand)
7. Code block syntax highlighting
8. Images (local via `asWebviewUri()`, remote direct)
9. Internal link navigation (including anchor links)
10. Mermaid (lazy-loaded, debounced, VS Code theme-mapped)
11. Theme integration (light, dark, high-contrast)
12. Activation command (`"Facet: Set as default markdown editor"`) + "View source" escape hatch
13. Polish: cursor behavior edge cases, large-file performance

### Validate v1 against real content

The acceptance criteria are at the bottom of [`docs/facet-spec-v1.md`](docs/facet-spec-v1.md). The honest test: **point Facet for VS Code at the team's wiki repo and live on it for a week.** If anything surprises you negatively, fix before telling anyone else.

---

## Pending / parked

- **Auth setup detail**: `gh auth setup-git` was run on the dev machine to make git use the active `gh` account. Switching `gh` accounts now affects which identity pushes to github.com. Switch back to `cpr-wklein` when working on other repos: `gh auth switch --user cpr-wklein`.
- **Commit author email**: Currently using `chachoblow@users.noreply.github.com`. If you want a real email on Facet commits, run `git config user.email "your@email"` inside `~/code/facet`.
- **Open questions for the future** (not v1): Listed at the bottom of [`docs/facet-decisions.md`](docs/facet-decisions.md) — auth, hosting, real-time vs async, Frontmatter properties panel, paste-image, Mermaid PNG export.

## Guardrails for the next session

A few things easy to forget under time pressure:

- **Use the canonical terms** from `UBIQUITOUS_LANGUAGE.md` in any new docs or code. Especially **Surface** vs **Facet** and **Thread** vs **Comment**.
- **Round-trip fidelity is non-negotiable** (Decision D5). Don't ship a v1 that mutates real-world markdown.
- **No custom markdown syntax** (Decision D6). Stay within CommonMark + GFM. The "publish as code" wiki vision depends on it.
- **Plan B is real** (Decision D3). If CodeMirror's Hybrid live-preview turns into a swamp, switching Facet for VS Code to Milkdown is a legitimate move, not a failure.
