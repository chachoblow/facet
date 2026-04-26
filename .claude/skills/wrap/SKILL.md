---
name: wrap
description: End-of-session handoff. Mirror this session's progress into HANDOFF.md and CLAUDE.md, run CI-equivalent checks, and propose per-unit commits. Invoke when the Author says "wrap up", "end of session", "update handoff", or `/wrap`.
---

# `/wrap` — end-of-session handoff update

Bring the canonical handoff docs in sync with the work just done, then propose commits. Don't push.

## Step 1 — figure out what shipped

- `git log --oneline -10` and `git status` — see what's already committed this session vs. what's still uncommitted.
- Re-read `HANDOFF.md` and `CLAUDE.md` to see what currently-claimed state will need updating.
- Use the conversation context to distinguish what was actually completed vs. attempted vs. parked.

## Step 2 — update the docs

These two files share state and must move together. Match the existing section structure — don't invent new sections.

**`HANDOFF.md`**:

- "Where things stand" status bullet — refresh the "Impl order step N is done" line and the one-paragraph summary of what concretely landed.
- "Immediate next action" section — rewrite for the next step. Name the relevant guardrails (D5, D6, etc.), point to the spec section if applicable, and list explicit out-of-scope items so the next session doesn't drift.
- "Implementation order" section — add `✅` to the just-completed step(s); move the **Next:** marker.

**`CLAUDE.md`**:

- "Status" section — mirror HANDOFF's status paragraph. Be concrete about where `packages/core/` and `apps/vscode/` actually stand (not aspirational); call out what's intentionally empty/deferred.

Use canonical terms from `docs/UBIQUITOUS_LANGUAGE.md` (Surface, Author, Document, Thread, Content source of truth, etc.). The bare word "editor" is overloaded — say **Surface**, **Author**, or name the library.

## Step 3 — verify

Run, in order, and surface any failure before committing:

```
pnpm -w format:check && pnpm -r typecheck && pnpm lint && pnpm -r test && pnpm -r build
```

These are the CI gates (`.github/workflows/ci.yml`). Don't commit a broken tree.

## Step 4 — propose commits (don't push)

Per the per-unit-commit convention, split into separate commits — never bundle impl with docs:

1. **Impl commit** (only if there's uncommitted impl/code in this turn). Subject in repo style — short imperative summary of the unit (e.g., `Add parse() to @facet/core via remark-parse + remark-gfm`). Body explains the _why_, not the diff.
2. **Docs commit** for the handoff updates. Subject form: `Update HANDOFF and CLAUDE for impl order step N done`.

Both commits must include the standard `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` trailer.

Confirm with the Author before committing. Never push automatically — wait for an explicit "push".
