# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Monorepo scaffolded — pnpm workspaces, TypeScript project references, esbuild. Node 24 and pnpm 10 are pinned (`.nvmrc`, `engines`, `packageManager`). Spikes 1–3 have run; conclusions live in each `spikes/*/README.md`. Spike 1 is now a permanent test at `packages/core/test/round-trip.test.ts`.

`apps/vscode/` builds and registers a stub `Facet: Hello` command — the real `CustomTextEditorProvider` + webview wiring is impl order step 1 in `HANDOFF.md`. `packages/core/src/index.ts` is intentionally empty; parsing logic lands when impl order step 2 does.

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
