# Contributing to Facet

## Setup

- Node 24 (`.nvmrc`).
- pnpm 10 (pinned via `packageManager` in `package.json`).
- `pnpm install` at the repo root.

## Commands

All run from the repo root:

| Command                | What it does                  |
| ---------------------- | ----------------------------- |
| `pnpm -r build`        | Build every workspace package |
| `pnpm -r test`         | Run every package's tests     |
| `pnpm -r typecheck`    | Typecheck every package       |
| `pnpm lint`            | Lint the workspace            |
| `pnpm format`          | Apply Prettier                |
| `pnpm -w format:check` | Verify Prettier formatting    |

CI runs all of the above; please run them locally before opening a PR.

## Read first

The design has converged in writing; check the decisions before relitigating.

1. [`HANDOFF.md`](HANDOFF.md) — current state and immediate next steps.
2. [`docs/facet-vision.md`](docs/facet-vision.md) — what Facet is for.
3. [`docs/facet-spec-v1.md`](docs/facet-spec-v1.md) — v1 scope and non-goals.
4. [`docs/facet-decisions.md`](docs/facet-decisions.md) — decision log.
5. [`docs/UBIQUITOUS_LANGUAGE.md`](docs/UBIQUITOUS_LANGUAGE.md) — canonical glossary.
6. [`CLAUDE.md`](CLAUDE.md) — guardrails for code changes (applies to humans too).

## Guardrails

- Use the canonical terms from the glossary (Surface vs Facet, Thread vs Comment, etc.).
- **Round-trip fidelity (D5)** and **no custom markdown syntax (D6)** are non-negotiable in v1. Read the relevant entries in `docs/facet-decisions.md` before touching the save path or extending markdown.
- Major architectural changes go through a spike first (see `spikes/` for examples).

## Repository layout

- `apps/vscode/` — Facet for VS Code (v1 target).
- `packages/core/` — Markdown parsing, AST queries; shared across future Surfaces. Deliberately does not expose markdown stringification in v1.
- `docs/` — design docs.
- `spikes/` — exploratory proofs of concept; not built or shipped.
