# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Pre-implementation. The repo currently contains only design docs, a README, and a `.gitignore` — no source, no `package.json`, no build/lint/test commands yet. Do not invent commands; the scaffold has not been chosen.

If asked to scaffold or write code, follow the plan in `HANDOFF.md` (spikes first, then monorepo + VS Code extension). The intended toolchain at scaffold time is **pnpm workspaces + TypeScript project references + esbuild**, with the structure `apps/vscode/` and `packages/core/`.

## Read these before doing substantive work

The design has converged in writing. Skim these in order — they encode constraints that aren't visible from code (because there is none):

1. `HANDOFF.md` — current state and the three de-risking spikes that should run before any scaffolding.
2. `docs/facet-vision.md` — what Facet is for. Check feature ideas against the "Convergence of understanding" articulation.
3. `docs/facet-spec-v1.md` — v1 scope for Facet for VS Code. Includes explicit non-goals; respect them.
4. `docs/facet-decisions.md` — decision log with revisit conditions. Don't relitigate without checking the "When to revisit" criteria.
5. `docs/UBIQUITOUS_LANGUAGE.md` — canonical glossary. Use these terms in code, comments, commits, and prose.

## Architecture in one paragraph

Facet is a family of **Surfaces** over the same Markdown file. V1 is **Facet for VS Code**, a `CustomTextEditorProvider` hosting a webview that runs **CodeMirror 6** in **Hybrid live-preview** mode. **Remark / unified** is the **parser** (not CodeMirror's built-in markdown), specifically so the AST stays consistent with the future web Surfaces (**Facet Review**, **Facet Studio**). In v1, `remark-stringify` is deliberately not used: saves write the CodeMirror buffer verbatim, which is what preserves round-trip fidelity (D5). The git repo is the **Content source of truth**; **Threads** and **Comments** (not in v1) will live in a separate **Collaboration source of truth**. Logic for parsing, frontmatter, and link resolution should live in `packages/core/` so it can be reused by future Surfaces — keep it out of CodeMirror plugins. `packages/core/` should expose parsing and AST queries; it deliberately does not expose markdown stringification in v1.

## Non-negotiable guardrails

These are easy to violate by accident and expensive to undo:

- **Round-trip fidelity (D5).** Saving must produce byte-identical markdown unless the Author actually changed the Document. The mechanism in v1 is structural: CodeMirror owns the text buffer and saves write its bytes verbatim — `remark-stringify` is not called on save. Don't add a save-path serializer. Don't let CodeMirror, Remark config, or any plugin silently normalize list markers, reflow paragraphs, or rewrite link forms. Promote `spikes/01-roundtrip-fidelity/` into a permanent test the moment `packages/core/` exists; its job is to guard against `remark-stringify` re-entering the save path and to track Remark parsing changes.
- **No custom markdown syntax (D6).** CommonMark + GFM only. No wiki-style `[[links]]`, custom callouts, or embed syntax. Files must render correctly on GitHub, ADO, and any future Surface.
- **Use the canonical terms.** Especially: **Surface** (technical) vs **Facet** (brand), **Thread** vs **Comment**, **Author** vs "user", **Content source of truth** vs **Collaboration source of truth**. The bare word "editor" is overloaded — say **Surface**, **Author**, or name the library (CodeMirror 6, Milkdown) directly.
- **Plan B is real (D3).** If CodeMirror's Hybrid live-preview turns into disproportionate custom-plugin work, switching Facet for VS Code to **Milkdown with a source-mode toggle** is a legitimate move, not a failure. Keep the core (`packages/core/`) library-agnostic so the swap is feasible.
- **V1 is Facet for VS Code only.** Web Surfaces, Threads/Comments, real-time collab, properties panels, paste-image, and toggle-between-modes UX are all explicit non-goals. See the non-goals list in `docs/facet-spec-v1.md` before building anything that smells adjacent.
